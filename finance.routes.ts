import { Router, Request, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin } from './middleware/verifyAdmin';

const router = Router();
router.use(verifyAdmin);

const PAYMENT_METHODS = new Set([
  'Transferência Imediata',
  'Transferência SEPA',
  'Numerário Balcão',
  'Cheque Bancário',
]);

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

router.get('/payments', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('transacoes_financeiras')
      .select('*, lojas(nome)')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) {
      console.error('[FINANCE] Falha ao listar pagamentos.');
      return res.status(503).json({ success: false, message: 'Não foi possível carregar os pagamentos.' });
    }
    return res.json({ success: true, data: data || [] });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao carregar pagamentos.' });
  }
});

router.post('/payments', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const referencia = text(body.referencia, 80);
    const lojaId = text(body.loja_id, 64);
    const beneficiarioNome = text(body.beneficiario_nome, 160);
    const valor = Number(body.valor);
    const metodo = text(body.metodo, 64);

    if (!referencia || !lojaId || !beneficiarioNome || !Number.isFinite(valor) || valor <= 0 || valor > 999999999999.99 || Math.round(valor * 100) !== valor * 100 || !PAYMENT_METHODS.has(metodo)) {
      return res.status(400).json({ success: false, message: 'Dados do pagamento inválidos.' });
    }

    const { data: store, error: storeError } = await supabaseAdmin
      .from('lojas').select('id, nome, ativo').eq('id', lojaId).maybeSingle();
    if (storeError) {
      console.error('[FINANCE] Falha ao validar loja do pagamento.');
      return res.status(503).json({ success: false, message: 'Não foi possível validar a loja.' });
    }
    if (!store || store.ativo !== true) return res.status(400).json({ success: false, message: 'A loja selecionada não existe ou está inativa.' });

    const { data, error } = await supabaseAdmin
      .from('transacoes_financeiras')
      .insert({
        referencia,
        loja_id: store.id,
        loja_nome: store.nome,
        beneficiario_nome: beneficiarioNome,
        beneficiario_nif: text(body.beneficiario_nif, 32),
        beneficiario_iban: text(body.beneficiario_iban, 64) || null,
        valor,
        estado: 'pendente',
        metodo,
        conta_origem: text(body.conta_origem, 160) || null,
        descricao: text(body.descricao, 1000) || null,
        peso_ouro_gramas: Number.isFinite(Number(body.peso_ouro_gramas)) && Number(body.peso_ouro_gramas) >= 0 ? Number(body.peso_ouro_gramas) : null,
        tipo_metal: text(body.tipo_metal, 64) || null,
        operador_nome: text(body.operador_nome, 160) || null,
        data: text(body.data, 32) || null,
        hora: text(body.hora, 16) || null,
        comprovativo_ref: text(body.comprovativo_ref, 500) || null,
      })
      .select('*, lojas(nome)')
      .single();

    if (error || !data) {
      console.error('[FINANCE] Falha ao criar pagamento.');
      return res.status(503).json({ success: false, message: 'Não foi possível criar o pagamento.' });
    }
    return res.status(201).json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao criar pagamento.' });
  }
});

router.patch('/payments/:id/status', async (req: Request, res: Response) => {
  try {
    const id = text(req.params.id, 64);
    const estado = text(req.body?.estado, 16);
    if (!id || !['pago', 'rejeitado'].includes(estado)) {
      return res.status(400).json({ success: false, message: 'Estado de pagamento inválido.' });
    }

    const { data, error } = await supabaseAdmin
      .from('transacoes_financeiras')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('estado', 'pendente')
      .select('id, estado')
      .maybeSingle();

    if (error) {
      console.error('[FINANCE] Falha ao atualizar estado do pagamento.');
      return res.status(503).json({ success: false, message: 'Não foi possível actualizar o pagamento.' });
    }
    if (!data) return res.status(409).json({ success: false, message: 'Pagamento não encontrado ou já processado.' });
    return res.json({ success: true, payment: data });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao actualizar pagamento.' });
  }
});

export default router;
