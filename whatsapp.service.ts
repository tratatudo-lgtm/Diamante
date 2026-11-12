// PATH: whatsapp.service.ts
/**
 * Serviço de Integração com a Evolution API para envio de mensagens WhatsApp
 * Instância padrão: 'diamante-os'
 */

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Normaliza números de telefone portugueses para o formato internacional exigido pela Evolution API (ex: 3519XXXXXXXX)
 */
export function formatPortuguesePhone(rawPhone: string): string {
  // Remove todos os caracteres não numéricos exceto '+'
  let cleaned = rawPhone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Se tem 9 dígitos e começa por 9, adiciona o indicativo de Portugal (351)
  if (cleaned.length === 9 && cleaned.startsWith('9')) {
    return `351${cleaned}`;
  }

  // Se já tem o 351 mas sem o +, devolve como está
  if (cleaned.startsWith('351') && cleaned.length >= 12) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Envia o código OTP de 6 dígitos via Evolution API (endpoint message/sendText na instância diamante-os)
 */
export async function sendWhatsAppOtp(phone: string, otpCode: string): Promise<SendOtpResult> {
  const evolutionUrl = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
  const evolutionKey = process.env.EVOLUTION_API_KEY || '';
  const instanceName = process.env.EVOLUTION_INSTANCE || 'diamante-os';

  const formattedNumber = formatPortuguesePhone(phone);
  const messageText = `*Diamante OS v2*\n\nO seu código de segurança é: *${otpCode}*\n\nEste código é pessoal, confidencial e expira dentro de 5 minutos.\nSe não solicitou este código, ignore esta mensagem.`;

  console.log(`[WhatsApp Service] A preparar envio de OTP para ${formattedNumber} via instância '${instanceName}'`);

  // Simulação só é permitida fora de produção e nunca regista o código OTP.
  if (!evolutionKey || !process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_INSTANCE) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'Evolution API não está configurada para produção.' };
    }
    return { success: true, messageId: `dev-sim-${Date.now()}`, simulated: true };
  }

  try {
    const targetUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey,
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: messageText,
        options: {
          delay: 1200,
          presence: 'composing',
        },
      }),
      signal: AbortSignal.timeout(2000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data?.message || data?.error || `HTTP ${response.status}: Falha no envio Evolution API`;
      console.error(`[WhatsApp Service] Erro na Evolution API (${response.status}):`, errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }

    console.log(`[WhatsApp Service] OTP entregue com sucesso à Evolution API para o número ${formattedNumber}`);
    return {
      success: true,
      messageId: data?.key?.id || data?.id || 'sent',
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Erro de conexão com a Evolution API';
    console.error('[WhatsApp Service] Falha de comunicação de rede:', errMessage);

    // Em modo dev, não bloqueia o fluxo caso o container ainda esteja a subir
    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        messageId: `fallback-dev-${Date.now()}`,
        simulated: true,
      };
    }

    return {
      success: false,
      error: errMessage,
    };
  }
}
