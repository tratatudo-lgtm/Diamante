import { Router, Request, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin } from './middleware/verifyAdmin';

const router = Router();
router.use(verifyAdmin);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracoes_sistema')
      .select('chave, valor, updated_at')
      .eq('chave', 'geral_sistema')
      .maybeSingle();
    if (error) {
      console.error('[SETTINGS] Falha ao carregar configurações.');
      return res.status(503).json({ success: false, message: 'Não foi possível carregar as configurações.' });
    }
    return res.json({ success: true, settings: data?.valor ?? null });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao carregar configurações.' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const settings = req.body?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({ success: false, message: 'Formato de configurações inválido.' });
    }

    const { data, error } = await supabaseAdmin
      .from('configuracoes_sistema')
      .upsert({
        chave: 'geral_sistema',
        valor: settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })
      .select('chave, valor, updated_at')
      .single();

    if (error || !data) {
      console.error('[SETTINGS] Falha ao guardar configurações.');
      return res.status(503).json({ success: false, message: 'Não foi possível guardar as configurações.' });
    }
    return res.json({ success: true, settings: data.valor });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao guardar configurações.' });
  }
});

export default router;
