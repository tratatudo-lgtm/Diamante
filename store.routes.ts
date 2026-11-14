import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';
import { supabaseAdmin } from './auth.service';

const storeRouter = Router();

storeRouter.post('/purchases', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee || !employee.ativo || !employee.loja_id ||
      employee.role !== 'funcionario') {
    return res.status(403).json({ success: false, message: 'A sua conta não tem permissões para registar compras nesta loja.' });
  }

  const body = req.body || {};
  const clienteNome = typeof body.clienteNome === 'string' ? body.clienteNome.trim() : '';
  const clienteCc = typeof body.clienteCc === 'string' ? body.clienteCc.trim() : '';
  const clienteTelemovel = typeof body.clienteTelemovel === 'string' ? body.clienteTelemovel.trim() : '';
  const tipoPeca = typeof body.tipoPeca === 'string' ? body.tipoPeca.trim() : '';
  const metal = typeof body.metal === 'string' ? body.metal.trim() : '';
  const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
  const peso = Number(body.pesoGramas);
  const valorFinal = Number(body.valorFinal);
  const valorSugerido = Number(body.valorSugerido);
  const cotacaoSpot = Number(body.cotacaoSpot);
  const margem = Number(body.margemPercent);

  if (!clienteNome || clienteNome.length > 200 || !clienteCc || clienteCc.length > 80 ||
      clienteTelemovel.length > 40 || !tipoPeca || tipoPeca.length > 100 ||
      !metal || metal.length > 100 || descricao.length > 2000 ||
      !Number.isFinite(peso) || peso <= 0 || peso > 100000 ||
      !Number.isFinite(valorFinal) || valorFinal <= 0 || valorFinal > 100000000 ||
      !Number.isFinite(valorSugerido) || valorSugerido < 0 ||
      !Number.isFinite(cotacaoSpot) || cotacaoSpot < 0 ||
      !Number.isFinite(margem) || margem < 0 || margem > 100) {
    return res.status(400).json({ success: false, message: 'Os dados da compra são inválidos. Verifique os campos e tente novamente.' });
  }

  try {
    const { data: store, error: storeError } = await supabaseAdmin
      .from('lojas').select('id, ativo').eq('id', employee.loja_id).maybeSingle();

    if (storeError) {
      return res.status(503).json({ success: false, message: 'Não foi possível validar a loja.' });
    }
    if (!store || store.ativo !== true) {
      return res.status(403).json({ success: false, message: 'A loja associada à sua conta não está ativa.' });
    }

    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transacoes')
      .insert({
        loja_id: employee.loja_id,
        funcionario_id: employee.id,
        cliente_nome: clienteNome,
        cliente_cc: clienteCc,
        cliente_contacto: clienteTelemovel || null,
        tipo_peca: tipoPeca,
        metal,
        peso_gramas: peso,
        valor_final: Number(valorFinal.toFixed(2)),
        valor_sugerido: Number(valorSugerido.toFixed(2)),
        cotacao_spot_dia: cotacaoSpot,
        cotacao_dia: cotacaoSpot,
        margem_aplicada: margem,
        descricao: descricao || `${tipoPeca} em ${metal}`,
        estado: 'pendente_aprovacao',
      })
      .select('id, loja_id, funcionario_id, estado, valor_final, peso_gramas, created_at')
      .single();

    if (txError || !transaction) {
      console.error('[Store Purchase] Falha ao criar transação.');
      return res.status(503).json({ success: false, message: 'Não foi possível registar a compra.' });
    }

    const inventoryCode = `INV-${randomUUID().replace(/-/g, '').toUpperCase()}`;
    const { error: inventoryError } = await supabaseAdmin
      .from('inventario_fisico')
      .insert({
        loja_atual_id: employee.loja_id,
        transacao_origem_id: transaction.id,
        codigo_unico: inventoryCode,
        tipo_peca: tipoPeca,
        metal,
        peso_gramas: peso,
        estado: 'em_loja',
      });

    if (inventoryError) {
      console.error('[Store Purchase] Transação criada; falha no inventário físico.');
      return res.status(207).json({
        success: false,
        partial: true,
        transacao: transaction,
        message: 'A transação foi criada, mas o inventário não ficou registado. Não repita a compra; contacte a sede.',
      });
    }

    const io = (globalThis as any).io;
    if (io) {
      io.to('admin').emit('transaction:created', {
        id: transaction.id,
        loja_id: transaction.loja_id,
        estado: transaction.estado,
        created_at: transaction.created_at,
      });
      io.to(`store:${employee.loja_id}`).emit('transaction:created', {
        id: transaction.id,
        estado: transaction.estado,
        created_at: transaction.created_at,
      });
    }

    return res.status(201).json({ success: true, transacao: transaction });
  } catch {
    console.error('[Store Purchase] Erro interno ao registar compra.');
    return res.status(500).json({ success: false, message: 'Ocorreu um erro ao registar a compra.' });
  }
});

export default storeRouter;
