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

export default router;
