import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeExpenses, type ExpenseSummaryRow } from '../finance-expense-summary';

const storeA = '11111111-1111-4111-8111-111111111111';
const storeB = '22222222-2222-4222-8222-222222222222';

test('soma valores decimais em cêntimos sem deriva de vírgula flutuante', () => {
  const rows: ExpenseSummaryRow[] = Array.from({ length: 1000 }, () => ({
    loja_id: storeA, categoria: 'energia_agua', valor: '0.10', estado: 'paga',
  }));
  const result = summarizeExpenses(rows);
  assert.equal(result.paid, 100);
  assert.equal(result.stores[0].paid, 100);
  assert.equal(result.stores[0].byCategory.energia_agua, 100);
});

test('separa estados e mantém os totais por loja e categoria', () => {
  const result = summarizeExpenses([
    { loja_id: storeA, categoria: 'renda', valor: '120.25', estado: 'paga' },
    { loja_id: storeA, categoria: 'pessoal', valor: '10.10', estado: 'pendente' },
    { loja_id: storeA, categoria: 'pessoal', valor: '5.05', estado: 'aprovada' },
    { loja_id: storeB, categoria: 'material', valor: '3.33', estado: 'rejeitada' },
  ]);
  assert.equal(result.paid, 120.25);
  assert.equal(result.pending, 15.15);
  assert.equal(result.rejected, 3.33);
  assert.equal(result.stores.find(x => x.loja_id === storeA)?.byCategory.renda, 120.25);
  assert.equal(result.stores.find(x => x.loja_id === storeB)?.rejected, 3.33);
  assert.equal(result.stores[0].loja_id, storeA);
});

test('rejeita valores inválidos em vez de os converter silenciosamente em zero', () => {
  assert.throws(() => summarizeExpenses([
    { loja_id: storeA, categoria: 'renda', valor: 'NaN', estado: 'paga' },
  ]), /Valor de despesa inválido/);
});

test('não agrega estados desconhecidos nos totais financeiros', () => {
  const result = summarizeExpenses([
    { loja_id: storeA, categoria: 'renda', valor: '99.99', estado: 'estado_desconhecido' },
  ]);
  assert.deepEqual(
    { paid: result.paid, pending: result.pending, rejected: result.rejected },
    { paid: 0, pending: 0, rejected: 0 },
  );
});
