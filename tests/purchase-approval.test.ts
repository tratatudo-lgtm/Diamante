import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizePurchase, type PurchaseApprovalRepository, type PurchaseApprovalTransaction } from '../purchase-approval';

class FakeRepository implements PurchaseApprovalRepository {
  transaction: PurchaseApprovalTransaction = {
    id: 'purchase-1',
    loja_id: 'store-1',
    estado: 'pendente_aprovacao',
    valor_final: 1500,
    primeira_aprovacao_por: null,
  };
  settings = { exigir_dupla_assinatura: true, exigir_dupla_assinatura_acima: 1000 };
  private writeQueue: Promise<void> = Promise.resolve();

  async getTransaction() { return { ...this.transaction }; }
  async getSettings() { return { ...this.settings }; }

  private async atomic<T>(operation: () => T): Promise<T> {
    let release!: () => void;
    const previous = this.writeQueue;
    this.writeQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return operation(); } finally { release(); }
  }

  async recordFirstApproval(_id: string, adminId: string, at: string) {
    return this.atomic(() => {
      if (this.transaction.estado !== 'pendente_aprovacao' || this.transaction.primeira_aprovacao_por) return false;
      this.transaction.primeira_aprovacao_por = adminId;
      return Boolean(at);
    });
  }

  async approve(_id: string, adminId: string, _at: string, requireDifferentAdmin: boolean) {
    return this.atomic(() => {
      if (this.transaction.estado !== 'pendente_aprovacao') return null;
      if (requireDifferentAdmin && this.transaction.primeira_aprovacao_por === adminId) return null;
      this.transaction.estado = 'aprovado';
      return { id: this.transaction.id, loja_id: this.transaction.loja_id };
    });
  }
}

const fixedNow = () => '2026-11-17T12:00:00.000Z';

test('first administrator records the first signature only', async () => {
  const repository = new FakeRepository();
  const result = await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  if (result.body.success) assert.equal(result.body.requiresSecondApproval, true);
  assert.equal(repository.transaction.estado, 'pendente_aprovacao');
  assert.equal(repository.transaction.primeira_aprovacao_por, 'admin-a');
});

test('the same administrator cannot provide the second signature', async () => {
  const repository = new FakeRepository();
  await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  const result = await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  assert.equal(result.status, 409);
  assert.equal(repository.transaction.estado, 'pendente_aprovacao');
});

test('a different administrator completes the approval', async () => {
  const repository = new FakeRepository();
  await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  const result = await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-b', repository, now: fixedNow });
  assert.equal(result.status, 200);
  assert.equal(repository.transaction.estado, 'aprovado');
});

test('simultaneous first signatures can only record one administrator', async () => {
  const repository = new FakeRepository();
  const results = await Promise.all([
    authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow }),
    authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-b', repository, now: fixedNow }),
  ]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 1);
  assert.ok(['admin-a', 'admin-b'].includes(repository.transaction.primeira_aprovacao_por ?? ''));
});

test('simultaneous second signatures can only approve once', async () => {
  const repository = new FakeRepository();
  await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  const results = await Promise.all([
    authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-b', repository, now: fixedNow }),
    authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-c', repository, now: fixedNow }),
  ]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 1);
  assert.equal(repository.transaction.estado, 'aprovado');
});

test('a first signature remains mandatory after the threshold is disabled', async () => {
  const repository = new FakeRepository();
  await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  repository.settings.exigir_dupla_assinatura = false;
  const sameAdmin = await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  assert.equal(sameAdmin.status, 409);
  const otherAdmin = await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-b', repository, now: fixedNow });
  assert.equal(otherAdmin.status, 200);
});

test('a purchase already processed cannot be approved again', async () => {
  const repository = new FakeRepository();
  repository.transaction.estado = 'aprovado';
  const result = await authorizePurchase({ transactionId: 'purchase-1', adminId: 'admin-a', repository, now: fixedNow });
  assert.equal(result.status, 409);
});
