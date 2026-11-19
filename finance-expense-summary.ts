export interface ExpenseSummaryRow {
  loja_id: string;
  categoria: string;
  valor: number | string;
  estado: string;
}

export interface ExpenseStoreSummary {
  loja_id: string;
  paid: number;
  pending: number;
  rejected: number;
  byCategory: Record<string, number>;
}

export interface ExpenseSummary {
  paid: number;
  pending: number;
  rejected: number;
  stores: ExpenseStoreSummary[];
}

function toCents(value: number | string): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) throw new TypeError('Valor de despesa inválido.');
  return Math.round(amount * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

/** Aggregate database NUMERIC(…,2) values as integer cents to avoid FP drift. */
export function summarizeExpenses(rows: ExpenseSummaryRow[]): ExpenseSummary {
  const stores = new Map<string, {
    loja_id: string;
    paid: number;
    pending: number;
    rejected: number;
    byCategory: Record<string, number>;
  }>();
  let paid = 0;
  let pending = 0;
  let rejected = 0;

  for (const row of rows) {
    const cents = toCents(row.valor);
    if (!stores.has(row.loja_id)) {
      stores.set(row.loja_id, { loja_id: row.loja_id, paid: 0, pending: 0, rejected: 0, byCategory: {} });
    }
    const store = stores.get(row.loja_id)!;
    if (row.estado === 'paga') {
      paid += cents;
      store.paid += cents;
      store.byCategory[row.categoria] = (store.byCategory[row.categoria] || 0) + cents;
    } else if (row.estado === 'pendente' || row.estado === 'aprovada') {
      pending += cents;
      store.pending += cents;
    } else if (row.estado === 'rejeitada') {
      rejected += cents;
      store.rejected += cents;
    }
  }

  return {
    paid: fromCents(paid),
    pending: fromCents(pending),
    rejected: fromCents(rejected),
    stores: Array.from(stores.values())
      .map((store) => ({
        loja_id: store.loja_id,
        paid: fromCents(store.paid),
        pending: fromCents(store.pending),
        rejected: fromCents(store.rejected),
        byCategory: Object.fromEntries(
          Object.entries(store.byCategory).map(([category, cents]) => [category, fromCents(cents)]),
        ),
      }))
      .sort((a, b) => b.paid - a.paid),
  };
}
