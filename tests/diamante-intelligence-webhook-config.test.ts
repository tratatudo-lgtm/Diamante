import assert from 'node:assert/strict';
import test from 'node:test';
import { configureDiamanteIntelligenceWebhook } from '../diamante-intelligence.webhook-config';

const ENV_KEYS = [
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE',
  'EVOLUTION_WEBHOOK_SECRET',
  'PUBLIC_URL',
  'APP_URL',
] as const;

test('configuração do webhook Evolution é segura e não bloqueia o arranque', async (t) => {
  const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;
  const logs: string[] = [];
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  t.after(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    console.error = originalError;
    console.log = originalLog;
  });

  console.warn = (...args: unknown[]) => logs.push(args.join(' '));
  console.error = (...args: unknown[]) => logs.push(args.join(' '));
  console.log = (...args: unknown[]) => logs.push(args.join(' '));

  for (const key of ENV_KEYS) delete process.env[key];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response('{}', { status: 201 });
  }) as typeof fetch;

  await t.test('não chama Evolution quando faltam variáveis obrigatórias', async () => {
    requests.length = 0;
    await configureDiamanteIntelligenceWebhook();
    assert.equal(requests.length, 0);
    assert.ok(logs.some((entry) => entry.includes('faltam variáveis obrigatórias')));
  });

  await t.test('envia apenas MESSAGES_UPSERT e mantém segredo fora dos logs', async () => {
    process.env.EVOLUTION_API_URL = 'https://evolution.example/';
    process.env.EVOLUTION_API_KEY = 'api-key-test';
    process.env.EVOLUTION_INSTANCE = 'diamante-os';
    process.env.EVOLUTION_WEBHOOK_SECRET = 'webhook-secret-test';
    process.env.PUBLIC_URL = 'https://diamante.example/';

    requests.length = 0;
    logs.length = 0;
    await configureDiamanteIntelligenceWebhook();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://evolution.example/webhook/set/diamante-os');
    assert.equal(requests[0].init?.method, 'POST');

    const headers = new Headers(requests[0].init?.headers);
    assert.equal(headers.get('apikey'), 'api-key-test');
    const body = JSON.parse(String(requests[0].init?.body));
    assert.deepEqual(body.events, ['MESSAGES_UPSERT']);
    assert.equal(body.enabled, true);
    assert.equal(body.webhookByEvents, false);
    assert.equal(body.webhookBase64, false);
    assert.equal(body.url, 'https://diamante.example/api/webhooks/evolution/diamante-intelligence');
    assert.equal(body.headers['x-diamante-webhook-secret'], 'webhook-secret-test');
    assert.ok(!logs.join(' ').includes('webhook-secret-test'));
    assert.ok(!logs.join(' ').includes('api-key-test'));
  });

  await t.test('HTTP não-2xx é registado sem revelar credenciais', async () => {
    globalThis.fetch = (async () => new Response('denied', { status: 401 })) as typeof fetch;
    logs.length = 0;
    await configureDiamanteIntelligenceWebhook();
    assert.ok(logs.some((entry) => entry.includes('HTTP 401')));
    assert.ok(!logs.join(' ').includes('webhook-secret-test'));
    assert.ok(!logs.join(' ').includes('api-key-test'));
  });

  await t.test('falha de rede não propaga erro para o arranque', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network failure with webhook-secret-test');
    }) as typeof fetch;
    logs.length = 0;
    await assert.doesNotReject(configureDiamanteIntelligenceWebhook());
    assert.ok(logs.some((entry) => entry.includes('Não foi possível configurar')));
    assert.ok(!logs.join(' ').includes('webhook-secret-test'));
  });
});
