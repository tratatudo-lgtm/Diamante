import { findUserInSupabaseByPhone, supabaseAdmin } from './auth.service';

type IntelligenceProfile =
  | { kind: 'public' }
  | { kind: 'client'; name: string }
  | { kind: 'employee'; role: string; name: string; storeName: string | null };

function normalizePhoneFromJid(jid: string): string {
  const raw = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!raw || raw.length < 8 || raw.length > 15) return '';
  return raw;
}

export async function findWhatsAppClientByPhone(phone: string): Promise<{ id: string; name: string } | null> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  const { data, error } = await supabaseAdmin.rpc('lookup_whatsapp_client_by_phone', {
    p_phone: digits,
  });
  if (error) throw new Error('SUPABASE_CLIENT_LOOKUP_FAILED');
  if (!Array.isArray(data) || data.length !== 1) return null;
  const name = typeof data[0].name === 'string' ? data[0].name.trim() : '';
  const id = typeof data[0].id === 'string' ? data[0].id : '';
  return id && name ? { id, name } : null;
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

  const client = await findWhatsAppClientByPhone(phone);
  return client ? { kind: 'client', name: client.name } : { kind: 'public' };
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
      `Perfil de contacto associado ao nome ${profile.name}, reconhecido pela correspondência do número no Supabase, mas NÃO autenticado. Trata-o cordialmente pelo primeiro nome, sem afirmar que a identidade foi validada.`,
      'Responde apenas a assuntos da área de cliente Diamante D\'Ouro: processo de compra de ouro, atendimento, lojas, preparação para visita e apoio geral ao cliente. Recusa educadamente pedidos fora deste âmbito.',
      'Não consultes nem reveles compras, histórico, avaliações, valores, pagamentos, recibos, documentos, NIF, morada, dados de contacto ou estado da conta. O número reconhecido não é autenticação. Para qualquer assunto pessoal sobre a conta, encaminha para validação de identidade através do canal seguro oficial; nunca peças códigos ou documentos no WhatsApp.',
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

// Lista de modelos em cache para evitar chamadas de descoberta em cada mensagem.
let modelCache: { ids: Set<string>; expiresAt: number } | null = null;
async function selectEconomicalModel(apiKey: string): Promise<string> {
  const preferred = 'openai/gpt-oss-20b';
  const now = Date.now();
  if (!modelCache || now >= modelCache.expiresAt) {
    modelCache = null;
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const data = await r.json() as { data?: Array<{ id?: string }> };
        modelCache = { ids: new Set((data.data || []).map(x => x.id).filter((x): x is string => !!x)), expiresAt: Date.now() + 5 * 60 * 1000 };
      } else {
        console.error(`[Diamante Intelligence] Não foi possível validar modelos Groq (HTTP ${r.status}).`);
      }
    } catch {
      console.error('[Diamante Intelligence] Falha temporária ao validar modelos Groq.');
    }
  }
  // Nunca chamar um modelo sem confirmação de que continua ativo na API Groq.
  if (!modelCache || modelCache.expiresAt <= Date.now()) {
    throw new Error('GROQ_MODEL_VALIDATION_UNAVAILABLE');
  }
  // O Diamante usa exclusivamente o 20B para controlar custos e consumo.
  if (modelCache.ids.has(preferred)) return preferred;
  throw new Error('GROQ_NO_SUPPORTED_MODEL');
}

export async function generateDiamanteIntelligenceReply(jid: string, message: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_NOT_CONFIGURED');

  const profile = await resolveProfile(jid);
  const model = await selectEconomicalModel(apiKey);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      reasoning_effort: 'low',
      include_reasoning: false,
      max_completion_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt(profile) },
        { role: 'user', content: message.slice(0, 1500) },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.error(`[Diamante Intelligence] Groq respondeu HTTP ${response.status}.`);
    throw new Error(response.status === 429 ? 'GROQ_RATE_LIMITED' : response.status === 403 ? 'GROQ_ACCESS_DENIED' : 'GROQ_REQUEST_FAILED');
  }
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('GROQ_EMPTY_RESPONSE');
  return answer.slice(0, 1600);
}
