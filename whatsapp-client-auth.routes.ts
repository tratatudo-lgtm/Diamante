import { Router, Request, Response, NextFunction } from 'express';
import { createHmac, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './auth.service';
import { formatPortuguesePhone, sendWhatsAppOtp } from './whatsapp.service';

const router = Router();
const jwtSecret = process.env.JWT_SECRET || '';
const otpSecret = process.env.OTP_HMAC_SECRET || '';

function digest(value: string): string {
  if (otpSecret.length < 32) throw new Error('CLIENT_OTP_SECRET_UNAVAILABLE');
  return createHmac('sha256', otpSecret).update(value).digest('hex');
}

function phoneHash(phone: string): string {
  return digest('client-phone:' + phone);
}

function codeHash(phone: string, code: string): string {
  return digest('client-code:' + phone + ':' + code);
}

router.post('/request-otp', async (req: Request, res: Response) => {
  const rawPhone = req.body?.phone ?? req.body?.telemovel;
  if (typeof rawPhone !== 'string') return res.status(400).json({ success: false, message: 'Número inválido.' });
  const phone = formatPortuguesePhone(rawPhone);
  if (!phone) return res.status(400).json({ success: false, message: 'Número português inválido.' });

  try {
    const { data: matches, error: lookupError } = await supabaseAdmin.rpc('lookup_whatsapp_client_by_phone', { p_phone: phone });
    if (lookupError) return res.status(503).json({ success: false, message: 'Não foi possível validar o pedido.' });
    const client = Array.isArray(matches) && matches.length === 1 ? matches[0] : null;
    // Resposta neutra para não revelar se o número está registado.
    if (!client || typeof client.id !== 'string') {
      return res.status(202).json({ success: true, message: 'Se o número estiver associado a uma conta elegível, receberá um código.' });
    }

    const code = String(randomInt(100000, 1000000));
    const pHash = phoneHash(phone);
    const cHash = codeHash(phone, code);
    const { data, error } = await supabaseAdmin.rpc('create_whatsapp_client_otp_challenge', {
      p_phone_hash: pHash,
      p_client_id: client.id,
      p_code_hash: cHash,
      p_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    const status = Array.isArray(data) ? data[0]?.status : null;
    if (error) return res.status(503).json({ success: false, message: 'Não foi possível preparar a validação.' });
    if (status !== 'created') {
      return res.status(status === 'rate_limited' || status === 'pending' ? 429 : 503)
        .json({ success: false, message: status === 'rate_limited' ? 'Limite de pedidos atingido. Aguarde antes de tentar novamente.' : 'Já existe um código ativo ou não foi possível preparar a validação.' });
    }

    const sent = await sendWhatsAppOtp(phone, code);
    if (!sent.success || sent.simulated) {
      await supabaseAdmin.rpc('revoke_whatsapp_client_otp_challenge', { p_phone_hash: pHash, p_code_hash: cHash });
      return res.status(502).json({ success: false, message: 'Não foi possível confirmar o envio real do código.' });
    }
    return res.status(202).json({ success: true, message: 'Se o número estiver associado a uma conta elegível, receberá um código.' });
  } catch {
    return res.status(503).json({ success: false, message: 'Serviço de autenticação temporariamente indisponível.' });
  }
});

router.post('/verify-otp', async (req: Request, res: Response) => {
  const rawPhone = req.body?.phone ?? req.body?.telemovel;
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (typeof rawPhone !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Número e código de seis algarismos obrigatórios.' });
  }
  const phone = formatPortuguesePhone(rawPhone);
  if (!phone) return res.status(400).json({ success: false, message: 'Número português inválido.' });

  try {
    const { data, error } = await supabaseAdmin.rpc('consume_whatsapp_client_otp_challenge', {
      p_phone_hash: phoneHash(phone),
      p_code_hash: codeHash(phone, code),
    });
    if (error) return res.status(503).json({ success: false, message: 'Não foi possível validar o código.' });
    const result = Array.isArray(data) ? data[0] : null;
    if (result?.status !== 'valid' || typeof result.client_id !== 'string') {
      const status = result?.status;
      return res.status(status === 'locked' ? 429 : status === 'invalid' ? 401 : 400)
        .json({ success: false, message: status === 'expired' ? 'Código expirado.' : status === 'locked' ? 'Código bloqueado. Solicite outro.' : 'Código inválido ou já utilizado.' });
    }

    const { data: client, error: clientError } = await supabaseAdmin.from('clientes')
      .select('id,nome,telemovel,status')
      .eq('id', result.client_id)
      .maybeSingle();
    if (clientError) return res.status(503).json({ success: false, message: 'Não foi possível validar a conta.' });
    if (!client || client.status === 'bloqueado' ||
        formatPortuguesePhone(String(client.telemovel || '')) !== phone) {
      return res.status(403).json({ success: false, message: 'A conta não está elegível para autenticação.' });
    }
    if (jwtSecret.length < 32) return res.status(503).json({ success: false, message: 'Sessões indisponíveis.' });
    const token = jwt.sign({ sub: client.id, token_type: 'client', role: 'client' }, jwtSecret, { algorithm: 'HS256', expiresIn: '30m', issuer: 'diamante-os', audience: 'diamante-client' });
    return res.status(200).json({ success: true, token, user: { id: client.id, nome: client.nome } });
  } catch {
    return res.status(503).json({ success: false, message: 'Serviço de autenticação temporariamente indisponível.' });
  }
});

interface ClientRequest extends Request { clientSession?: { id: string; name: string }; }

export async function verifyClientSession(req: ClientRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || jwtSecret.length < 32) {
    res.status(401).json({ success: false, message: 'Sessão de cliente obrigatória.' });
    return;
  }
  try {
    const claims = jwt.verify(header.slice(7).trim(), jwtSecret, {
      algorithms: ['HS256'], issuer: 'diamante-os', audience: 'diamante-client',
    }) as jwt.JwtPayload;
    if (claims.token_type !== 'client' || claims.role !== 'client' || typeof claims.sub !== 'string') {
      res.status(403).json({ success: false, message: 'Sessão não pertence à área de cliente.' });
      return;
    }
    const { data, error } = await supabaseAdmin.from('clientes')
      .select('id,nome,status').eq('id', claims.sub).maybeSingle();
    if (error) {
      res.status(503).json({ success: false, message: 'Não foi possível validar a sessão.' });
      return;
    }
    if (!data || data.status === 'bloqueado') {
      res.status(401).json({ success: false, message: 'Conta indisponível.' });
      return;
    }
    req.clientSession = { id: data.id, name: data.nome };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
  }
}

router.get('/me', verifyClientSession, (req: ClientRequest, res: Response) => {
  return res.status(200).json({ success: true, client: req.clientSession });
});


const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Histórico de compras: o identificador do cliente vem exclusivamente do JWT validado.
router.get('/purchases', verifyClientSession, async (req: ClientRequest, res: Response) => {
  const requestedLimit = Number(req.query.limit ?? 20);
  const limit = Number.isInteger(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;
  const requestedOffset = Number(req.query.offset ?? 0);
  const offset = Number.isInteger(requestedOffset) ? Math.max(0, Math.min(10000, requestedOffset)) : 0;
  const clientId = req.clientSession?.id;
  if (!clientId) return res.status(401).json({ success: false, message: 'Sessão de cliente obrigatória.' });

  try {
    const { data, error, count } = await supabaseAdmin.from('transacoes')
      .select('id,created_at,tipo_peca,metal,peso_gramas,valor_final,estado,loja_id', { count: 'exact' })
      .eq('cliente_id', clientId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return res.status(503).json({ success: false, message: 'Não foi possível carregar as compras.' });

    const purchases = data || [];
    const transactionIds = purchases.map((item: any) => item.id);
    const { data: receipts, error: receiptError } = transactionIds.length
      ? await supabaseAdmin.from('recibos').select('id,transacao_id,gerado_em').in('transacao_id', transactionIds)
      : { data: [], error: null };
    if (receiptError) return res.status(503).json({ success: false, message: 'Não foi possível carregar os recibos.' });

    const receiptByTransaction = new Map((receipts || []).map((item: any) => [item.transacao_id, {
      id: item.id, generated_at: item.gerado_em,
    }]));
    return res.status(200).json({
      success: true,
      pagination: { limit, offset, total: count ?? purchases.length },
      purchases: purchases.map((item: any) => ({
        id: item.id,
        date: item.created_at,
        item_type: item.tipo_peca,
        metal: item.metal,
        weight_grams: item.peso_gramas,
        amount: item.valor_final,
        status: item.estado,
        receipt: receiptByTransaction.get(item.id) ?? null,
      })),
    });
  } catch {
    return res.status(503).json({ success: false, message: 'Serviço de área de cliente temporariamente indisponível.' });
  }
});

// Detalhe de compra: UUID e ownership são sempre verificados em conjunto.
// Endpoint para download seguro de recibo (PDF) com verificação de ownership.
router.get('/receipts/:id', verifyClientSession, async (req: ClientRequest, res: Response) => {
  const receiptId = req.params.id;
  const clientId = req.clientSession?.id;
  if (!clientId) return res.status(401).json({ success: false, message: 'Sessão de cliente obrigatória.' });
  if (!uuidPattern.test(receiptId)) return res.status(400).json({ success: false, message: 'Identificador de recibo inválido.' });

  try {
    const { data: receipt, error } = await supabaseAdmin.from('recibos')
      .select('id,transacao_id,gerado_em')
      .eq('id', receiptId)
      .maybeSingle();
    if (error) return res.status(503).json({ success: false, message: 'Não foi possível validar o recibo.' });
    if (!receipt) return res.status(404).json({ success: false, message: 'Recibo não encontrado.' });

    const { data: transaction, error: transactionError } = await supabaseAdmin.from('transacoes')
      .select('id,cliente_id')
      .eq('id', receipt.transacao_id)
      .eq('cliente_id', clientId)
      .maybeSingle();
    if (transactionError) return res.status(503).json({ success: false, message: 'Não foi possível validar a compra.' });
    if (!transaction) return res.status(404).json({ success: false, message: 'Recibo não encontrado.' });

    // Não expor URLs/paths de armazenamento nesta API sem uma fonte validada.
    return res.status(501).json({ success: false, message: 'Download do recibo ainda não disponível; a compra foi validada.' });
  } catch {
    return res.status(503).json({ success: false, message: 'Serviço de recibos temporariamente indisponível.' });
  }
});

router.get('/purchases/:id', verifyClientSession, async (req: ClientRequest, res: Response) => {
  const purchaseId = req.params.id;
  const clientId = req.clientSession?.id;
  if (!clientId) return res.status(401).json({ success: false, message: 'Sessão de cliente obrigatória.' });
  if (!uuidPattern.test(purchaseId)) return res.status(400).json({ success: false, message: 'Identificador de compra inválido.' });

  try {
    const { data, error } = await supabaseAdmin.from('transacoes')
      .select('id,created_at,tipo_peca,metal,peso_gramas,descricao,cotacao_dia,valor_sugerido,valor_final,margem_aplicada,estado')
      .eq('id', purchaseId)
      .eq('cliente_id', clientId)
      .maybeSingle();
    if (error) return res.status(503).json({ success: false, message: 'Não foi possível carregar a compra.' });
    if (!data) return res.status(404).json({ success: false, message: 'Compra não encontrada.' });

    const { data: receipt, error: receiptError } = await supabaseAdmin.from('recibos')
      .select('id,gerado_em')
      .eq('transacao_id', purchaseId)
      .maybeSingle();
    if (receiptError) return res.status(503).json({ success: false, message: 'Não foi possível carregar o recibo.' });

    return res.status(200).json({
      success: true,
      purchase: {
        id: data.id, date: data.created_at, item_type: data.tipo_peca,
        metal: data.metal, weight_grams: data.peso_gramas,
        description: data.descricao, daily_quote: data.cotacao_dia,
        suggested_amount: data.valor_sugerido, final_amount: data.valor_final,
        applied_margin: data.margem_aplicada, status: data.estado,
        receipt: receipt ? { id: receipt.id, generated_at: receipt.gerado_em } : null,
      },
    });
  } catch {
    return res.status(503).json({ success: false, message: 'Serviço de área de cliente temporariamente indisponível.' });
  }
});

export default router;
