import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEvolutionEventName } from '../diamante-intelligence.webhook-utils';

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
