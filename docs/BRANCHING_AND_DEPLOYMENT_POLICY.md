# Diamante OS — política permanente de branches e deploy

Última actualização: 2026-11-19

## Fonte única de verdade

- Repositório: `tratatudo-lgtm/Diamante`.
- Branch principal oficial: `main`.
- O código actualmente validado e instalado no VPS foi alinhado com `main` no commit inicial desta política: `7858f2fdf8d8c9f4ed558cb7d97249ea1361e467`.
- A branch operacional anterior `fix/purchase-idempotent-replay-20261116` fica preservada como referência histórica durante a transição. Não criar novas funcionalidades nela.
- A antiga `main` foi preservada sem alterações em `archive/main-before-realignment-20261119`. Não desenvolver nem fazer deploy a partir desta branch de arquivo.

## Regras obrigatórias de desenvolvimento

1. Toda a nova funcionalidade ou correção nasce numa branch curta criada a partir da `main` actualizada.
2. Integrar alterações exclusivamente por Pull Request para `main`; não fazer commits directos em `main`, excepto documentação operacional urgente e de baixo risco.
3. Antes de integrar: rever diff, executar CI, TypeScript, testes unitários, build e testes PostgreSQL aplicáveis. Corrigir falhas; não declarar CI verde com base em execuções de commits antigos.
4. PRs devem indicar migrações Supabase, impacto em dados, riscos, testes e plano de rollback.
5. Não misturar históricos de branches antigos por merge artificial. Recuperar alterações antigas por PRs específicos e revisão de conteúdo.
6. Não apagar nem reescrever a branch de arquivo.

## Regras obrigatórias para VPS

1. O VPS é ambiente integrado de testes/pré-produção, não é produção do cliente.
2. Antes de deploy: confirmar branch, `git status` limpo, SHA local, SHA de `origin/main`, CI verde desse SHA e compatibilidade das migrações Supabase.
3. Deploy apenas de um SHA identificado e validado de `main`; usar fast-forward, nunca `git reset --hard`, force-push ou pull de branches de feature.
4. Não executar `supabase db push`, `migration repair` nem SQL de migração sem reconciliação explícita do histórico, comparação de SQL, dependências e plano de recuperação.
5. Após deploy: verificar health local e público, logs, reinícios de contentores, domínios admin/loja e testes funcionais críticos.
6. Se qualquer pré-condição falhar, parar. Não contornar a falha com merge ou deploy forçado.

## Supabase e dados

- O histórico remoto de migrações é autoridade para o estado aplicado; nomes/timestamps isolados não provam equivalência SQL.
- Preservar todas as entradas remotas e dados existentes. Nunca reparar ou renumerar migrações aplicadas para esconder divergências.
- Distinguir tabelas/colunas existentes, políticas RLS, grants, funções RPC e permissões Storage. Verificar cada camada.
- Manter evidência das verificações e das alterações no GitHub.

## Estado da realinhamento de 2026-11-19

- A antiga `main` (SHA `b4d4b82d6f8a9e5949159d7e8db4720b8fffa02b`) foi arquivada em `archive/main-before-realignment-20261119`.
- A `main` foi realinhada para o commit `7858f2fdf8d8c9f4ed558cb7d97249ea1361e467`, que já estava no VPS e na branch operacional.
- A diferença histórica da antiga `main` era apenas o workflow `.github/workflows/vps-remote-diagnostics.yml` no lado antigo; o conteúdo antigo completo permanece recuperável na branch de arquivo.
- Esta operação não fez deploy, não alterou Supabase e não reiniciou serviços.

## Regra de continuidade para qualquer sessão/agente

Antes de alterar código, consultar este documento e confirmar o SHA actual de `main` e do VPS. Tratar `main` como única linha de desenvolvimento e deploy. Nunca assumir que uma branch antiga, PR fechada, memória de conversa ou SHA previamente observado continua actual. Registar novas decisões de arquitectura/branching neste ficheiro através de commit.
