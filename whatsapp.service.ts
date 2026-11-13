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
  const digits = String(rawPhone).replace(/\D/g, '');
  let nationalNumber: string;

  if (digits.length === 9) {
    nationalNumber = digits;
  } else if (digits.length === 12 && digits.startsWith('351')) {
    nationalNumber = digits.slice(3);
  } else {
    return '';
  }

  if (!/^[289]\d{8}$/.test(nationalNumber)) {
    return '';
  }

  return `351${nationalNumber}`;
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

  console.log('[WhatsApp Service] A preparar envio de OTP.');

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
      console.error(`[WhatsApp Service] Erro na Evolution API (HTTP ${response.status}).`);
      return {
        success: false,
        error: 'Falha no envio pela Evolution API.',
      };
    }

    console.log('[WhatsApp Service] OTP aceite pela Evolution API.');
    return {
      success: true,
      messageId: data?.key?.id || data?.id || 'sent',
    };
  } catch (error: unknown) {
    console.error('[WhatsApp Service] Falha de comunicação de rede.');

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
      error: 'Falha de comunicação com a Evolution API.',
    };
  }
}
