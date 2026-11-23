import test from 'node:test';
import assert from 'node:assert/strict';
import { ownsClientTransaction, parsePrivateReceiptPath } from '../whatsapp-client-ownership';

const alice = '00000000-0000-4000-8000-000000000101';
const bob = '00000000-0000-4000-8000-000000000102';

test('customer A only owns their own purchase', () => {
  assert.equal(ownsClientTransaction(alice, { cliente_id: alice }), true);
  assert.equal(ownsClientTransaction(alice, { cliente_id: bob }), false);
  assert.equal(ownsClientTransaction(bob, { cliente_id: alice }), false);
  assert.equal(ownsClientTransaction(alice, null), false);
  assert.equal(ownsClientTransaction('', { cliente_id: alice }), false);
});

test('private receipt path rejects external and traversal links', () => {
  assert.equal(parsePrivateReceiptPath('recibos/2026/abc.pdf', 'recibos'), '2026/abc.pdf');
  assert.equal(parsePrivateReceiptPath('2026/abc.pdf', 'recibos'), '2026/abc.pdf');
  for (const invalid of [
    'https://example.com/receipt.pdf', '/public/receipt.pdf',
    '../other.pdf', '2026/../other.pdf', '2026//receipt.pdf',
    '2026/receipt.pdf?token=abc', '2026/receipt.png',
    '2026\\receipt.pdf', null, '',
  ]) assert.equal(parsePrivateReceiptPath(invalid, 'recibos'), null);
  assert.equal(parsePrivateReceiptPath('2026/receipt.pdf', ''), null);
});
