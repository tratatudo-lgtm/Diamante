# Diamante OS — plano de reconstrução segura

Estado: branch isolada de preparação. Este documento não altera o comportamento da aplicação.

## Base de trabalho
- Repositório: tratatudo-lgtm/Diamante
- Branch: rebuild/diamante-douro-secure
- Base: dfa7ba0841d12f55d5d22f9a2ef1b961bd112bed
- A branch foi criada a partir do HEAD de main confirmado em 2026-11-12.
- Não fazer merge nem deploy automático desta branch.

## Limites obrigatórios
1. Não modificar o projeto Supabase existente nem executar schema/migrations.
2. Não eliminar, recriar ou substituir utilizadores Auth, funcionários, lojas, transações, políticas RLS, triggers ou funções.
3. Não misturar o repositório Tratatudo-V2.
4. Não alterar a VPS/produção nesta fase.
5. Nunca colocar SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, Evolution API key ou outras credenciais no frontend, no Git ou em logs.
6. Nenhuma operação administrativa pode confiar em telefone, role, user ID ou permissões enviados em headers/body sem validar uma sessão assinada e o funcionário ativo na BD.

## Achados iniciais confirmados no código desta branch

### Críticos
- `server.ts`: `/api/v1/admin/dashboard/pending` e `/authorize` autorizam com base apenas no header `x-user-phone` comparado com um número fixo. Deve ser removido e substituído por autenticação Bearer validada no servidor e autorização por funcionário ativo.
- `server.ts`: `/api/admin/war-room`, `/api/war-room` e `/admin/war-room` consultam tabelas com o cliente Service Role sem middleware de autenticação. Devem ficar protegidos e com escopo de dados por permissões.
- `server.ts`: CORS global usa `origin: true` com credenciais. Deve usar allowlist explícita e rejeitar origens desconhecidas.
- Socket.IO aceita qualquer origem e permite entrar em salas e enviar mensagens sem autenticação/autorização. É necessário validar a sessão no handshake e controlar a autorização das salas.

### Importantes
- `auth.routes.ts`: pedido OTP tem armazenamento duplicado em dois Maps e lógica Evolution duplicada face a `auth.service.ts`. Consolidar num único serviço.
- `auth.service.ts`: OTP em memória perde-se com reinício e não é partilhado entre instâncias. Até existir armazenamento persistente aprovado, manter execução de instância única, invalidar códigos após reinício e aplicar limites por telefone/IP.
- `auth.service.ts`: a procura por telefone deve rejeitar correspondências ambíguas; nunca escolher um funcionário arbitrariamente.
- `src/context/AuthContext.tsx`: a restauração de sessão baseada em `localStorage.otp_phone` não é autenticação. Deve validar o token no backend; não reconstruir uma sessão a partir do telefone.
- `src/context/AuthContext.tsx`: não usar role `admin` como fallback quando faltam metadados. Falhar fechado.
- `src/components/auth/LoginPage.tsx`: guardar o token OTP é aceitável apenas como token próprio da API, nunca como sessão Supabase. As chamadas protegidas devem enviar Authorization Bearer.
- `whatsapp.service.ts`: não simular envios OTP em produção; falhar fechado quando Evolution não está configurada ou falha.

## Arquitetura-alvo inicial
- Manter o Supabase atual como fonte única da verdade.
- Manter OTP WhatsApp como mecanismo de entrada, emitindo um JWT próprio da API com validade curta e claims mínimas.
- O backend valida assinatura, expiração, utilizador e funcionário ativo em cada pedido protegido; a role e loja são sempre reobtidas da BD, nunca confiadas ao cliente.
- Não apresentar o JWT próprio como Supabase access_token nem fabricar refresh tokens Supabase.
- Operações com Service Role permanecem exclusivamente no backend e após autorização explícita por endpoint.
- O frontend não deve assumir que o JWT próprio permite consultas diretas a tabelas protegidas por RLS. Essas consultas devem usar sessão Supabase real ou endpoints backend autorizados.
- A compatibilidade com o login por email/password só pode manter-se se a autenticação Supabase for validada e o perfil corresponder ao mesmo UUID de Auth.

## Sequência de implementação e validação
1. Inventariar todas as rotas HTTP, WebSocket e chamadas frontend, incluindo rotas administrativas e de dados.
2. Fechar os bypasses de autenticação/autorização e normalizar o fluxo OTP num único serviço.
3. Corrigir a restauração de sessão no frontend e garantir que não há fallback de role.
4. Proteger WebSocket e restringir CORS.
5. Adicionar testes negativos: sem token, token inválido/expirado, funcionário inativo, role insuficiente, telefone forjado, ID forjado, origem não autorizada e sala WebSocket não autorizada.
6. Executar lint/build/testes e revisão manual dos diffs.
7. Preparar deploy apenas numa VPS nova/staging, sem tocar na VPS atual.
8. Validar login de utilizadores reais e permissões por loja antes de qualquer migração.
9. Só depois de aprovação específica, planear cutover e rollback.

## Condições de aceitação
- Nenhum endpoint administrativo acessível sem token válido e funcionário ativo.
- Nenhuma autorização baseada em telefone ou role fornecidos pelo browser.
- Nenhuma rota Service Role pública.
- Nenhum fallback de autenticação ou sucesso fictício em falha de BD/Evolution.
- Login OTP WhatsApp funcional sem alterar IDs ou dados existentes.
- Permissões testadas para admin e utilizadores de loja.
- Build e testes passam; produção permanece inalterada até aprovação de deploy.
