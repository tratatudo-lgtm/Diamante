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

router.get('/kpis', verifyAdmin, async (req, res) => {
  try {
    const dayRange = getLisbonDayRange();
    
    // Indicadores calculados sobre as transacções reais do dia em Portugal continental.
    const [transacoesRes, pendentesRes, lojasRes, totalLojasRes] = await Promise.all([
      supabase.from('transacoes').select('valor_final, peso_gramas')
        .gte('created_at', dayRange.start).lt('created_at', dayRange.end),
      supabase.from('transacoes').select('id', { count: 'exact', head: true }).eq('estado', 'pendente_aprovacao'),
      supabase.from('lojas').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('lojas').select('id', { count: 'exact', head: true })
    ]);

    if (
      transacoesRes.error ||
      pendentesRes.error ||
      lojasRes.error ||
      totalLojasRes.error ||
      !transacoesRes.data ||
      pendentesRes.count === null ||
      lojasRes.count === null ||
      totalLojasRes.count === null
    ) {
      console.error('[WarRoom KPIs] Uma ou mais consultas não foram concluídas.');
      res.status(503).json({ error: 'Indicadores temporariamente indisponíveis.' });
      return;
    }

    let volumeTotal = 0;
    let pesoTotal = 0;
    
    if (transacoesRes.data && transacoesRes.data.length > 0) {
      for (const t of transacoesRes.data) {
        volumeTotal += Number(t.valor_final) || 0;
        pesoTotal += Number(t.peso_gramas) || 0;
      }
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
