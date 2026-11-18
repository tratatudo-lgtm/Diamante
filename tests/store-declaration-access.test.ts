import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessPurchaseDeclaration, isUuid } from '../store-declaration-access';

const purchaseStore = '11111111-1111-4111-8111-111111111111';
const otherStore = '22222222-2222-4222-8222-222222222222';

test('administrador autenticado pode consultar declaração de qualquer loja', () => {
  assert.equal(canAccessPurchaseDeclaration({ id: 'admin-1', role: 'admin', lojaId: null }, purchaseStore), true);
});

test('funcionário pode consultar declaração apenas da própria loja', () => {
  assert.equal(canAccessPurchaseDeclaration({ id: 'staff-1', role: 'funcionario', lojaId: purchaseStore }, purchaseStore), true);
  assert.equal(canAccessPurchaseDeclaration({ id: 'staff-1', role: 'funcionario', lojaId: otherStore }, purchaseStore), false);
});

test('roles diferentes e identidade ausente não têm acesso', () => {
  assert.equal(canAccessPurchaseDeclaration({ id: 'user-1', role: 'cliente', lojaId: purchaseStore }, purchaseStore), false);
  assert.equal(canAccessPurchaseDeclaration({ id: '', role: 'admin', lojaId: null }, purchaseStore), false);
});

test('identificadores UUID são validados antes das consultas', () => {
  assert.equal(isUuid(purchaseStore), true);
  assert.equal(isUuid('not-a-uuid'), false);
});
