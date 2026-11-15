import { Router } from 'express';
import { supabaseAdmin as supabase } from './auth.service';
import { verifyAdmin } from './middleware/verifyAdmin';

const router = Router();

function getLisbonDayRange(now = new Date()): { start: string; end: string } {
  const getParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return { year: read('year'), month: read('month'), day: read('day') };
  };
  const offsetAt = (date: Date) => {
    const name = new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Lisbon',
      timeZoneName: 'shortOffset',
    }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT';
    const match = name.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
    return match[1] === '-' ? -minutes : minutes;
  };
  const utcMidnight = (year: number, month: number, day: number) => {
    const approximateNoon = new Date(Date.UTC(year, month - 1, day, 12));
    return new Date(Date.UTC(year, month - 1, day) - offsetAt(approximateNoon) * 60_000).toISOString();
  };
  const today = getParts(now);
  const tomorrowDate = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return {
    start: utcMidnight(today.year, today.month, today.day),
    end: utcMidnight(tomorrowDate.getUTCFullYear(), tomorrowDate.getUTCMonth() + 1, tomorrowDate.getUTCDate()),
  };
}


router.get('/financial-summary', verifyAdmin, async (req, res) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Mês inválido. Use AAAA-MM.' });
    }
    const [year, monthNumber] = month.split('-').map(Number);
    const start = `${month}-01`;
    const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    const rows: Array<{ loja_id: string; categoria: string; valor: number | string; estado: string; lojas?: { nome?: string } | null }> = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('despesas_operacionais')
        .select('loja_id,categoria,valor,estado,lojas(nome)')
        .gte('data_despesa', start).lt('data_despesa', end)
        .order('data_despesa', { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) {
        console.error('[WarRoom Finance] Falha ao consultar despesas mensais.');
        return res.status(503).json({ success: false, error: 'Resumo financeiro temporariamente indisponível.' });
      }
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    const stores = new Map<string, { loja_id: string; nome: string; paid: number; pending: number; rejected: number; byCategory: Record<string, number> }>();
    let paid = 0, pending = 0, rejected = 0;
    for (const row of rows) {
      const amount = Number(row.valor) || 0;
      if (!stores.has(row.loja_id)) stores.set(row.loja_id, { loja_id: row.loja_id, nome: row.lojas?.nome || 'Loja sem nome', paid: 0, pending: 0, rejected: 0, byCategory: {} });
      const store = stores.get(row.loja_id)!;
      if (row.estado === 'paga') {
        paid += amount; store.paid += amount;
        store.byCategory[row.categoria] = (store.byCategory[row.categoria] || 0) + amount;
      } else if (row.estado === 'pendente' || row.estado === 'aprovada') {
        pending += amount; store.pending += amount;
      } else if (row.estado === 'rejeitada') {
        rejected += amount; store.rejected += amount;
      }
    }
    return res.json({ success: true, month, totals: { paid, pending, rejected }, stores: Array.from(stores.values()).sort((a, b) => b.paid - a.paid) });
  } catch {
    console.error('[WarRoom Finance] Erro inesperado no resumo mensal.');
    return res.status(500).json({ success: false, error: 'Erro ao calcular resumo financeiro.' });
  }
});

router.get('/kpis', verifyAdmin, async (req, res) => {
  try {
    const dayRange = getLisbonDayRange();
    
    // Paginação completa: não truncar o volume/peso quando há mais de 1.000 transacções.
    const pageSize = 500;
    let volumeTotal = 0;
    let pesoTotal = 0;
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error } = await supabase.from('transacoes')
        .select('valor_final, peso_gramas')
        .gte('created_at', dayRange.start).lt('created_at', dayRange.end)
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error || !page) {
        console.error('[WarRoom KPIs] Falha ao consultar todas as transacções do dia.');
        return res.status(503).json({ error: 'Indicadores temporariamente indisponíveis.' });
      }
      for (const transaction of page) {
        volumeTotal += Number(transaction.valor_final) || 0;
        pesoTotal += Number(transaction.peso_gramas) || 0;
      }
      if (page.length < pageSize) break;
    }

    res.json({
      volume: volumeTotal,
      pendentes: pendentesRes.count,
      peso: pesoTotal,
      lojasAtivas: lojasRes.count,
      totalLojas: totalLojasRes.count
    });
  } catch {
    console.error('[WarRoom KPIs] Falha ao carregar indicadores.');
    res.status(500).json({ error: 'Erro ao carregar KPIs' });
  }
});

export default router;
