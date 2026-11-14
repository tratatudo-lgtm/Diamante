import { Router, Response } from 'express';
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
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
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

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey) ||
      !clienteNome || clienteNome.length > 200 || !clienteCc || clienteCc.length > 80 ||
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
    const { data: transaction, error: purchaseError } = await supabaseAdmin.rpc('create_store_purchase', {
      p_idempotency_key: idempotencyKey,
      p_funcionario_id: employee.id,
      p_loja_id: employee.loja_id,
      p_cliente_nome: clienteNome,
      p_cliente_cc: clienteCc,
      p_cliente_contacto: clienteTelemovel || null,
      p_tipo_peca: tipoPeca,
      p_metal: metal,
      p_peso_gramas: peso,
      p_valor_final: Number(valorFinal.toFixed(2)),
      p_valor_sugerido: Number(valorSugerido.toFixed(2)),
      p_cotacao_spot: cotacaoSpot,
      p_margem: margem,
      p_descricao: descricao || `${tipoPeca} em ${metal}`,
    });

    if (purchaseError || !transaction || typeof transaction !== 'object' || !transaction.id) {
      if (purchaseError?.code === '42501') {
        return res.status(403).json({ success: false, message: 'A sua conta ou loja já não está autorizada a registar compras.' });
      }
      console.error('[Store Purchase] Falha na operação atómica de compra e inventário.');
      return res.status(503).json({ success: false, message: 'Não foi possível registar a compra e o respetivo inventário. Nenhum registo parcial foi confirmado.' });
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
