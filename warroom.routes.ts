import { Router } from 'express';
import { supabaseAdmin as supabase } from './auth.service';
import { verifyAdmin } from './middleware/verifyAdmin';

const router = Router();

router.get('/kpis', verifyAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Buscar registos e somar localmente (evita .sum() inexistente no JS Client)
    const [transacoesRes, pendentesRes, lojasRes] = await Promise.all([
      supabase.from('transacoes').select('valor_total, peso_ouro').eq('data_compra', today),
      supabase.from('transacoes').select('id', { count: 'exact', head: true }).eq('estado', 'pendente_aprovacao'),
      supabase.from('lojas').select('id', { count: 'exact', head: true }).eq('ativo', true)
    ]);

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
      pendentes: pendentesRes.count || 0,
      peso: pesoTotal,
      lojasAtivas: lojasRes.count || 0,
      totalLojas: 24
    });
  } catch (err: any) {
    console.error('[WarRoom KPIs Error]:', err.message);
    res.status(500).json({ error: 'Erro ao carregar KPIs', details: err.message });
  }
});

export default router;
