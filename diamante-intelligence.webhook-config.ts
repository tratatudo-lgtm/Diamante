/** Configure the Evolution instance to deliver only incoming message events to Diamante OS. */
export async function configureDiamanteIntelligenceWebhook(): Promise<void> {
  const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY || '';
  const instance = process.env.EVOLUTION_INSTANCE || 'diamante-os';
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET || '';
  const publicBase = (process.env.PUBLIC_URL || process.env.APP_URL || '').replace(/\/+$/, '');
  if (!baseUrl || !apiKey || !instance || !secret || !publicBase) {
    console.warn('[Diamante Intelligence] Webhook Evolution não configurado: faltam variáveis obrigatórias.');
    return;
  }
  try {
    const response = await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: `${publicBase}/api/webhooks/evolution/diamante-intelligence`,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT'],
          headers: { 'x-diamante-webhook-secret': secret },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error(`[Diamante Intelligence] Evolution recusou a configuração do webhook (HTTP ${response.status}).`);
      return;
    }
    console.log('[Diamante Intelligence] Webhook Evolution configurado para mensagens recebidas.');
  } catch {
    console.error('[Diamante Intelligence] Não foi possível configurar o webhook Evolution.');
  }
}
