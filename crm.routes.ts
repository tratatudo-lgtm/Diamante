import { Router, Request, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin } from './middleware/verifyAdmin';

const router = Router();
router.use(verifyAdmin);

// Este módulo utiliza supabaseAdmin; não expor dados do CRM a perfis de loja.

function fail(res: Response, label: string) {
  console.error(`[CRM] ${label}`);
  return res.status(503).json({ success: false, error: 'Não foi possível carregar os dados do CRM.' });
}

router.get('/clients', async (_req: Request, res: Response) => {
  try {
    const clients: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('clientes')
        .select('id,nome,nif,bi_cc,tipo_documento,telemovel,email,morada,loja_registo_id,created_at,contacto,data_nascimento,data_emissao_documento,data_validade_documento')
        .order('nome', { ascending: true }).range(offset, offset + 499);
      if (error) return fail(res, 'Falha ao consultar todos os clientes.');
      clients.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    const ids = clients.map((c: any) => c.id);
    const [linked, stores] = await Promise.all([
      ids.length ? supabaseAdmin.from('transacoes')
        .select('id,cliente_id,cliente_nome,cliente_contacto,loja_id,peso_gramas,valor_final,estado,created_at,tipo_peca,metal')
        .in('cliente_id', ids).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
      supabaseAdmin.from('lojas').select('id,nome')
    ]);
    if (linked.error || stores.error) return fail(res, 'Falha ao consultar histórico de clientes.');
    const storeNames = new Map((stores.data || []).map((s: any) => [s.id, s.nome]));
    const counts = new Map<string, { count: number; volume: number; last: string | null }>();
    for (const tx of linked.data || []) {
      const old = counts.get(tx.cliente_id) || { count: 0, volume: 0, last: null };
      old.count += 1;
      old.volume += Number(tx.valor_final) || 0;
      if (!old.last || tx.created_at > old.last) old.last = tx.created_at;
      counts.set(tx.cliente_id, old);
    }
    return res.json({
      success: true,
      data: clients.map((c: any) => {
        const stats = counts.get(c.id) || { count: 0, volume: 0, last: null };
        return { ...c, total_transacoes: stats.count, total_volume: stats.volume,
          ultima_transacao: stats.last, loja_nome: storeNames.get(c.loja_registo_id) || null };
      })
    });
  } catch {
    return fail(res, 'Erro interno na listagem de clientes.');
  }
});

router.get('/clients/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('id,nome,nif,bi_cc,tipo_documento,telemovel,email,morada,loja_registo_id,created_at,contacto,data_nascimento,data_emissao_documento,data_validade_documento,consentimento_whatsapp_aniversario')
      .eq('id', id).maybeSingle();
    if (clientError || !client) return res.status(404).json({ success: false, error: 'Cliente não encontrado.' });

    const [linked, legacy, attachments, stores] = await Promise.all([
      supabaseAdmin.from('transacoes')
        .select('id,cliente_id,cliente_nome,cliente_contacto,loja_id,peso_gramas,valor_final,estado,created_at,tipo_peca,metal')
        .eq('cliente_id', id).order('created_at', { ascending: false }),
      supabaseAdmin.from('transacoes')
        .select('id,cliente_id,cliente_nome,cliente_contacto,loja_id,peso_gramas,valor_final,estado,created_at,tipo_peca,metal')
        .is('cliente_id', null).eq('cliente_nome', client.nome).order('created_at', { ascending: false }),
      supabaseAdmin.from('crm_anexos')
        .select('id,cliente_id,transacao_id,artigo_id,bucket_id,storage_path,nome_ficheiro,mime_type,tamanho_bytes,categoria,created_at')
        .eq('cliente_id', id).order('created_at', { ascending: false }),
      supabaseAdmin.from('lojas').select('id,nome')
    ]);
    if (linked.error || legacy.error || attachments.error || stores.error) return fail(res, 'Falha ao consultar ficha de cliente.');
    const seen = new Set((linked.data || []).map((tx: any) => tx.id));
    const transactions = [
      ...(linked.data || []).map((tx: any) => ({ ...tx, origem_ligacao: 'confirmada' })),
      ...(legacy.data || []).filter((tx: any) => !seen.has(tx.id)).map((tx: any) => ({ ...tx, origem_ligacao: 'nome_nao_confirmado' }))
    ].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

    const txIds = transactions.map((tx: any) => tx.id);
    const { data: articles, error: articlesError } = txIds.length
      ? await supabaseAdmin.from('artigos')
          .select('id,transacao_id,tipo,descricao,peso_gramas,quilates,foto_url,estado,loja_id')
          .in('transacao_id', txIds)
      : { data: [], error: null } as any;
    if (articlesError) return fail(res, 'Falha ao consultar artigos do cliente.');

    const signed = await Promise.all((attachments.data || []).map(async (file: any) => {
      const result = await supabaseAdmin.storage.from(file.bucket_id).createSignedUrl(file.storage_path, 300);
      return { ...file, signed_url: result.error ? null : result.data?.signedUrl || null };
    }));
    const articlesWithPhotos = await Promise.all((articles || []).map(async (article: any) => {
      const photo = typeof article.foto_url === 'string' ? article.foto_url.trim() : '';
      if (!photo) return { ...article, foto_signed_url: null };
      if (photo.startsWith('https://') || photo.startsWith('http://')) return { ...article, foto_signed_url: photo };
      const result = await supabaseAdmin.storage.from('fotos-artigos').createSignedUrl(photo, 300);
      return { ...article, foto_signed_url: result.error ? null : result.data?.signedUrl || null };
    }));
    const storeNames = new Map((stores.data || []).map((s: any) => [s.id, s.nome]));
    return res.json({
      success: true,
      client,
      transactions: transactions.map((tx: any) => ({ ...tx, loja_nome: storeNames.get(tx.loja_id) || null })),
      articles: articlesWithPhotos,
      attachments: signed
    });
  } catch {
    return fail(res, 'Erro interno na ficha de cliente.');
  }
});

router.get('/suppliers', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.from('crm_fornecedores')
      .select('id,nome,nif,contacto,email,morada,observacoes,ativo,created_at,updated_at')
      .order('nome', { ascending: true });
    if (error) return fail(res, 'Falha ao consultar fornecedores.');
    return res.json({ success: true, data: data || [] });
  } catch {
    return fail(res, 'Erro interno na listagem de fornecedores.');
  }
});

export default router;
