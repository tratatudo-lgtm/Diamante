import { findUserInSupabaseByPhone, supabaseAdmin } from './auth.service';

type IntelligenceProfile =
  | { kind: 'public' }
  | { kind: 'client' }
  | { kind: 'employee'; role: string; name: string; storeName: string | null };

function normalizePhoneFromJid(jid: string): string {
  const raw = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!raw || raw.length < 8 || raw.length > 15) return '';
  return raw;
}

async function resolveProfile(jid: string): Promise<IntelligenceProfile> {
  const phone = normalizePhoneFromJid(jid);
  if (!phone) return { kind: 'public' };

  const employee = await findUserInSupabaseByPhone(phone);
  if (employee?.ativo === true) {
    return {
      kind: 'employee',
      role: employee.role,
      name: employee.nome_completo,
      storeName: employee.loja_nome || null,
    };
  }

  // Reconhecimento de contacto, não autenticação: não concede acesso a dados pessoais.
  const variants = phone.startsWith('351')
    ? [phone, `+${phone}`, phone.slice(3), `+${phone.slice(3)}`]
    : [phone, `+${phone}`];
  const { data: clients, error } = await supabaseAdmin
    .from('clientes')
    .select('id')
    .in('telemovel', variants)
    .limit(2);
  if (!error && Array.isArray(clients) && clients.length === 1) return { kind: 'client' };
  return { kind: 'public' };
}

function systemPrompt(profile: IntelligenceProfile): string {
  const base = [
    'És o Diamante Intelligence, assistente virtual oficial da rede Diamante D\'Ouro em Portugal.',
    'Responde sempre em português europeu, com clareza, cordialidade e concisão.',
    'A atividade da empresa é compra de ouro, não venda de ouro nem pagamentos em prestações.',
    'Nunca inventes preços, cotações, moradas, horários, regras ou dados operacionais.',
    'Não solicites NIF, documentos de identificação, palavras-passe, códigos OTP ou dados bancários pelo WhatsApp.',
    'Não reveles dados de clientes, funcionários, compras, saldos, relatórios ou informação interna.',
    'Não afirmes que executaste operações no sistema. Não aproves compras, pagamentos, transferências ou alterações.',
    'Quando a questão exigir consulta de dados reais, decisão ou intervenção humana, explica que deve ser tratada pela equipa.',
  ];

  if (profile.kind === 'public') {
    base.push(
      'Perfil: público não autenticado. Dá apenas informação geral sobre o processo de compra de ouro.',
      'Para avaliações, valores atualizados, marcações ou casos concretos, encaminha para uma loja ou colaborador.',
    );
  } else if (profile.kind === 'client') {
    base.push(
      'Perfil reconhecido como contacto de cliente registado, mas não autenticado.',
      'Não confirmes a existência de registos, compras, valores, documentos ou qualquer dado pessoal. Dá apenas informação geral e encaminha assuntos individuais para uma loja.',
    );
  } else {
    const role = profile.role.toLowerCase();
    const roleLabel = role === 'admin' ? 'administrador' : role === 'gerente' ? 'gerente' : 'funcionário';
    base.push(
      `Perfil de funcionário ativo reconhecido. Nome: ${profile.name}. Função: ${roleLabel}. Loja associada: ${profile.storeName || 'não indicada'}.`,
      'Podes explicar procedimentos gerais e orientar tarefas, mas não tens autorização para consultar ou divulgar registos internos nesta versão.',
      role === 'admin'
        ? 'Para indicadores globais, auditoria e decisões administrativas, encaminha para os módulos autorizados do painel de administração.'
        : role === 'gerente'
          ? 'Orienta o gerente para o painel da sua loja. Não reveles dados de outras lojas nem informação financeira sensível.'
          : 'Orienta o funcionário para os procedimentos aprovados e para o gerente da loja quando necessário.',
    );
  }
  return base.join('\n');
}

export async function generateDiamanteIntelligenceReply(jid: string, message: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_NOT_CONFIGURED');

  const profile = await resolveProfile(jid);
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 350,
      messages: [
        { role: 'system', content: systemPrompt(profile) },
        { role: 'user', content: message.slice(0, 4000) },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    console.error(`[Diamante Intelligence] Groq respondeu HTTP ${response.status}.`);
    throw new Error('GROQ_REQUEST_FAILED');
  }
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('GROQ_EMPTY_RESPONSE');
  return answer.slice(0, 3500);
}
