import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchStoreInventoryItem, type StoreInventoryDispatchRepository } from '../store-inventory-dispatch';

const input = {
  itemId: '11111111-1111-4111-8111-111111111111',
  storeId: '22222222-2222-4222-8222-222222222222',
  employeeId: 'staff-1',
};
const item = {
  id: input.itemId,
  codigo_unico: 'INV-001',
  estado: 'enviado_sede',
  data_saida: '2026-11-18T14:00:00.000Z',
  peso_gramas: 12.5,
  transacao_origem_id: null,
};

function repository(result: { data: typeof item | null; error?: unknown | null }) {
  const calls: unknown[] = [];
  const repo: StoreInventoryDispatchRepository = {
    async dispatch(args) {
      calls.push(args);
      return result;
    },
  };
  return { repo, calls };
}

test('expede apenas com identificadores válidos e transmite o âmbito da loja e funcionário', async () => {
  const { repo, calls } = repository({ data: item, error: null });
  const result = await dispatchStoreInventoryItem(input, repo, () => '2026-11-18T14:00:00.000Z');
  assert.deepEqual(result, { status: 200, item });
  assert.deepEqual(calls, [{ ...input, dispatchedAt: '2026-11-18T14:00:00.000Z' }]);
});

test('recusa identificador inválido antes de consultar o repositório', async () => {
  const { repo, calls } = repository({ data: item });
  const result = await dispatchStoreInventoryItem({ ...input, itemId: 'invalid' }, repo);
  assert.equal(result.status, 400);
  assert.equal(calls.length, 0);
});

test('responde conflito quando a peça já não está em loja ou foi expedida', async () => {
  const { repo } = repository({ data: null, error: null });
  const result = await dispatchStoreInventoryItem(input, repo);
  assert.equal(result.status, 409);
});

test('falha fechada quando a atualização da base de dados falha', async () => {
  const { repo } = repository({ data: null, error: new Error('database unavailable') });
  const result = await dispatchStoreInventoryItem(input, repo);
  assert.equal(result.status, 503);
});

test('falha fechada quando o repositório lança uma excepção', async () => {
  const repo: StoreInventoryDispatchRepository = {
    async dispatch() { throw new Error('unexpected failure'); },
  };
  const result = await dispatchStoreInventoryItem(input, repo);
  assert.equal(result.status, 503);
});
