import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoreScope } from '../store-scope';

const ownStore = '11111111-1111-4111-8111-111111111111';
const otherStore = '22222222-2222-4222-8222-222222222222';

test('funcionário fica sempre limitado à loja atribuída', () => {
  assert.deepEqual(
    resolveStoreScope({ id: 'staff-1', role: 'funcionario', loja_id: ownStore, ativo: true }, otherStore),
    { ok: false, status: 403, message: 'Só pode operar na loja que lhe está atribuída.' },
  );
  assert.deepEqual(
    resolveStoreScope({ id: 'staff-1', role: 'funcionario', loja_id: ownStore, ativo: true }),
    { ok: true, lojaId: ownStore, actorRole: 'funcionario' },
  );
});

test('administrador tem de escolher uma loja UUID', () => {
  assert.deepEqual(
    resolveStoreScope({ id: 'admin-1', role: 'admin', loja_id: null, ativo: true }, ownStore),
    { ok: true, lojaId: ownStore, actorRole: 'admin' },
  );
  assert.equal(resolveStoreScope({ id: 'admin-1', role: 'admin', loja_id: null, ativo: true }).ok, false);
  assert.equal(resolveStoreScope({ id: 'admin-1', role: 'admin', loja_id: null, ativo: true }, 'invalid').ok, false);
});

test('contas inactivas e outros perfis são recusados', () => {
  assert.equal(resolveStoreScope({ id: 'admin-1', role: 'admin', loja_id: null, ativo: false }, ownStore).ok, false);
  assert.equal(resolveStoreScope({ id: 'client-1', role: 'cliente', loja_id: null, ativo: true }, ownStore).ok, false);
});
