import assert from 'node:assert/strict';
import test from 'node:test';
import { getWebhookFailureStatus, isSupportedEvolutionEvent, normalizeEvolutionEventName } from '../diamante-intelligence.webhook-utils';

test('normaliza MESSAGES_UPSERT da Evolution API', () => {
  assert.equal(normalizeEvolutionEventName('MESSAGES_UPSERT'), 'messages_upsert');
});

test('aceita separadores alternativos de versões e payloads', () => {
  assert.equal(normalizeEvolutionEventName('messages.upsert'), 'messages_upsert');
  assert.equal(normalizeEvolutionEventName(' Messages-UpsErt '), 'messages_upsert');
});

test('não converte eventos diferentes em mensagens recebidas', () => {
  assert.equal(normalizeEvolutionEventName('CONNECTION_UPDATE'), 'connection_update');
  assert.equal(normalizeEvolutionEventName('QRCODE_UPDATED'), 'qrcode_updated');
});

test('valor vazio ou ausente resulta em string vazia', () => {
  assert.equal(normalizeEvolutionEventName(undefined), '');
  assert.equal(normalizeEvolutionEventName(null), '');
  assert.equal(normalizeEvolutionEventName('   '), '');
});

test('extrai mensagem de texto no payload data.key/data.message', async () => {
  const { extractEvolutionTextMessage } = await import('../diamante-intelligence.webhook-utils');
  assert.deepEqual(extractEvolutionTextMessage({
    event: 'MESSAGES_UPSERT',
    data: { key: { id: 'abc', remoteJid: '351910000000@s.whatsapp.net', fromMe: false }, message: { conversation: ' Olá ' } },
  }), { id: 'abc', jid: '351910000000@s.whatsapp.net', text: 'Olá', fromMe: false });
});

test('extrai extendedTextMessage da variante messages[0]', async () => {
  const { extractEvolutionTextMessage } = await import('../diamante-intelligence.webhook-utils');
  assert.deepEqual(extractEvolutionTextMessage({
    data: { messages: [{ key: { id: 'def', remoteJid: '351910000000@s.whatsapp.net' }, message: { extendedTextMessage: { text: 'Preciso de ajuda' } } }] },
  }), { id: 'def', jid: '351910000000@s.whatsapp.net', text: 'Preciso de ajuda', fromMe: false });
});

test('ignora payloads sem identificador, remetente ou texto suportado', async () => {
  const { extractEvolutionTextMessage } = await import('../diamante-intelligence.webhook-utils');
  assert.equal(extractEvolutionTextMessage({ data: { key: { id: 'x' }, message: { conversation: 'Olá' } } }), null);
  assert.equal(extractEvolutionTextMessage({ data: { key: { remoteJid: 'x' }, message: { conversation: 'Olá' } } }), null);
  assert.equal(extractEvolutionTextMessage({ data: { key: { id: 'x', remoteJid: 'x' }, message: { audioMessage: {} } } }), null);
});

test('falha antes do envio fica failed e pode ser repetida segundo a política', () => {
  assert.equal(getWebhookFailureStatus(false), 'failed');
});

test('falha depois de iniciar envio fica unknown e nunca deve ser repetida automaticamente', () => {
  assert.equal(getWebhookFailureStatus(true), 'unknown');
});


test('exige evento MESSAGES_UPSERT explícito antes de processar payload', () => {
  assert.equal(isSupportedEvolutionEvent('MESSAGES_UPSERT'), true);
  assert.equal(isSupportedEvolutionEvent('messages.upsert'), true);
  assert.equal(isSupportedEvolutionEvent(undefined), false);
  assert.equal(isSupportedEvolutionEvent(''), false);
  assert.equal(isSupportedEvolutionEvent('CONNECTION_UPDATE'), false);
});
