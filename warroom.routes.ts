import { Router } from 'express';
import { supabaseAdmin as supabase } from './auth.service';
import { verifyAdmin } from './middleware/verifyAdmin';

const router = Router();

router.get('/kpis', verifyAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Buscar registos e somar localmente (evita .sum() inexistente no JS Client)
    const [transacoesRes, pendentesRes, lojasRes, totalLojasRes] = await Promise.all([
      supabase.from('transacoes').select('valor_total, peso_ouro').eq('data_compra', today),
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
        volumeTotal += Number(t.valor_total) || 0;
        pesoTotal += Number(t.peso_ouro) || 0;
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
