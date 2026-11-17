import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeDeclarationFile, requiresSecondPurchaseApproval } from '../store-purchase-validation';

const asBase64 = (value: Buffer) => value.toString('base64');

test('accepts supported declaration formats when signatures match', () => {
  const fixtures: Array<[string, Buffer]> = [
    ['application/pdf', Buffer.from('%PDF-1.7 test')],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', Buffer.from('RIFFxxxxWEBP')],
  ];

  for (const [mimeType, file] of fixtures) {
    assert.deepEqual(decodeDeclarationFile(asBase64(file), mimeType), file);
  }
});

test('rejects unsupported MIME types and mismatched file signatures', () => {
  const pdf = asBase64(Buffer.from('%PDF-1.7 test'));
  assert.equal(decodeDeclarationFile(pdf, 'text/plain'), null);
  assert.equal(decodeDeclarationFile(pdf, 'image/png'), null);
});

test('rejects malformed, empty and oversized Base64 uploads', () => {
  assert.equal(decodeDeclarationFile('', 'application/pdf'), null);
  assert.equal(decodeDeclarationFile('%%%not-base64%%%', 'application/pdf'), null);
  assert.equal(decodeDeclarationFile(asBase64(Buffer.alloc(6 * 1024 * 1024 + 1, 1)), 'application/pdf'), null);
});

test('requires a second signature when the first signature already exists', () => {
  assert.equal(requiresSecondPurchaseApproval({
    primeira_aprovacao_por: 'admin-1',
    valor_final: 900,
  }, false, 1000), true);
  assert.equal(requiresSecondPurchaseApproval({
    primeira_aprovacao_por: 'admin-1',
    valor_final: 900,
  }, true, 5000), true);
});

test('uses the active threshold for transactions without a first signature', () => {
  const transaction = { primeira_aprovacao_por: null, valor_final: 1200 };
  assert.equal(requiresSecondPurchaseApproval(transaction, true, 1000), true);
  assert.equal(requiresSecondPurchaseApproval(transaction, true, 1500), false);
  assert.equal(requiresSecondPurchaseApproval(transaction, false, 1000), false);
});
