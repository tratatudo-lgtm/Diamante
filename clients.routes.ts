import { Router, Response } from 'express';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';
import { supabaseAdmin } from './auth.service';

const clientsRouter = Router();

function validatePortugueseNIF(value: string): boolean {
  if (!/^\d{9}$/.test(value) || !['1', '2', '3', '5', '6', '8', '9'].includes(value[0])) return false;
  let sum = 0;
  for (let i = 0; i < 8; i += 1) sum += Number(value[i]) * (9 - i);
  const remainder = sum % 11;
  return (remainder < 2 ? 0 : 11 - remainder) === Number(value[8]);
}

function canReadClients(role: string): boolean {
  return role === 'admin' || role === 'funcionario';
}

clientsRouter.get('/', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee || !canReadClients(employee.role) || (employee.role !== 'admin' && !employee.loja_id)) {
    return res.status(403).json({ success: false, message: 'Não tem autorização para consultar clientes.' });
  }

  try {
    let query = supabaseAdmin
      .from('clientes')
      .select('id,codigo_cliente,nome,nif,bi_cc,tipo_documento,telemovel,email,morada,codigo_postal,pais_residencia,cidade,loja_registo_id,status,data_nascimento,notas_internas,created_at')
      .order('nome', { ascending: true });
    if (employee.role !== 'admin') query = query.eq('loja_registo_id', employee.loja_id as string);

    const [{ data, error }, { data: stores }] = await Promise.all([
      query,
      supabaseAdmin.from('lojas').select('id,nome'),
    ]);
    if (error) return res.status(503).json({ success: false, message: 'Não foi possível carregar os clientes.' });

    const storeNames = new Map((stores || []).map((store) => [store.id, store.nome]));
    const clients = (data || []).map((row) => ({
      ...row,
      loja_nome: storeNames.get(row.loja_registo_id) || '',
    }));
    return res.json({ success: true, clientes: clients });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro ao consultar clientes.' });
  }
});

clientsRouter.post('/', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee || !canReadClients(employee.role) || (employee.role !== 'admin' && !employee.loja_id)) {
    return res.status(403).json({ success: false, message: 'Não tem autorização para registar clientes.' });
  }

  const body = req.body || {};
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const nif = typeof body.nif === 'string' ? body.nif.replace(/\D/g, '') : '';
  const biCc = typeof body.biCc === 'string' ? body.biCc.trim() : '';
  const tipoDocumento = typeof body.tipoDocumento === 'string' ? body.tipoDocumento : '';
  const codigoPostal = typeof body.codigoPostal === 'string' ? body.codigoPostal.trim() : '';
  const paisResidencia = typeof body.paisResidencia === 'string' ? body.paisResidencia.trim().toUpperCase() : '';
  const telemovel = typeof body.telemovel === 'string' ? body.telemovel.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const morada = typeof body.morada === 'string' ? body.morada.trim() : '';
  const cidade = typeof body.cidade === 'string' ? body.cidade.trim() : '';
  const dataNascimento = typeof body.dataNascimento === 'string' ? body.dataNascimento.trim() : '';
  const notasInternas = typeof body.notasInternas === 'string' ? body.notasInternas.trim() : '';
  const consentimentoRgpd = body.consentimentoRgpd === true;
  const lojaId = employee.role === 'admin'
    ? (typeof body.lojaOrigemId === 'string' ? body.lojaOrigemId : '')
    : (employee.loja_id || '');
  const requestedStatus = body.status === 'vip' || body.status === 'bloqueado' ? body.status : 'normal';
  const status = employee.role === 'admin' ? requestedStatus : 'normal';

  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)
    ? new Date(`${dataNascimento}T00:00:00.000Z`)
    : null;
  const validBirthDate = Boolean(
    birthDate &&
    !Number.isNaN(birthDate.getTime()) &&
    birthDate.toISOString().slice(0, 10) === dataNascimento
  );
  const latestAllowedBirthDate = new Date();
  latestAllowedBirthDate.setUTCHours(0, 0, 0, 0);
  latestAllowedBirthDate.setUTCFullYear(latestAllowedBirthDate.getUTCFullYear() - 18);

  if (!nome || nome.length > 200 || !validatePortugueseNIF(nif) ||
      !biCc || biCc.length > 80 || !['cc', 'passaporte', 'cartao_residente', 'outro'].includes(tipoDocumento) || !/^\+[1-9]\d{7,14}$/.test(telemovel) ||
      morada.length > 300 || codigoPostal.length > 20 || paisResidencia.length > 10 || email.length > 254 ||
      cidade.length > 100 || !validBirthDate || (birthDate && birthDate > latestAllowedBirthDate) || notasInternas.length > 2000 ||
      !lojaId || !consentimentoRgpd) {
    return res.status(400).json({
      success: false,
      message: 'Preencha nome, NIF português válido, tipo e número de documento, data de nascimento válida (mínimo 18 anos), telefone internacional válido, loja e confirme o consentimento RGPD.',
    });
  }

  try {
    const { data: store, error: storeError } = await supabaseAdmin
      .from('lojas')
      .select('id')
      .eq('id', lojaId)
      .eq('ativo', true)
      .maybeSingle();
    if (storeError || !store) {
      return res.status(400).json({ success: false, message: 'A loja selecionada não existe ou está inativa.' });
    }

    const { data: existing } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('nif', nif)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Já existe um cliente registado com este NIF.' });
    }

    const { data: created, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        nome,
        nif,
        bi_cc: biCc,
        tipo_documento: tipoDocumento,
        telemovel,
        email: email || null,
        morada: morada || null,
        codigo_postal: codigoPostal || null,
        pais_residencia: paisResidencia || null,
        cidade: cidade || null,
        data_nascimento: dataNascimento || null,
        notas_internas: notasInternas || null,
        loja_registo_id: lojaId,
        status,
        consentimento_rgpd: true,
        consentimento_rgpd_data: new Date().toISOString(),
      })
      .select('id,codigo_cliente,nome,nif,bi_cc,tipo_documento,telemovel,email,morada,codigo_postal,pais_residencia,cidade,loja_registo_id,status,data_nascimento,notas_internas,created_at')
      .single();

    if (error || !created) {
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'Já existe um cliente com este NIF.' });
      console.error('[Clients] Falha ao criar cliente.');
      return res.status(503).json({ success: false, message: 'Não foi possível guardar o registo do cliente.' });
    }
    return res.status(201).json({ success: true, cliente: { ...created, loja_nome: employee.loja_nome || '' } });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro ao registar cliente.' });
  }
});


// Alertas de documentos: funcionário vê apenas a sua loja; administrador vê todas.
clientsRouter.get('/document-alerts', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee || !canReadClients(employee.role) || (employee.role !== 'admin' && !employee.loja_id)) {
    return res.status(403).json({ success: false, message: 'Não tem autorização para consultar alertas.' });
  }
  try {
    let query = supabaseAdmin.from('v_clientes_documentos_alerta').select('*')
      .in('estado_documento', ['expirado', 'a_expirar'])
      .order('data_validade_documento', { ascending: true }).limit(500);
    if (employee.role !== 'admin') query = query.eq('loja_registo_id', employee.loja_id as string);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, alertas: data || [] });
  } catch {
    return res.status(503).json({ success: false, message: 'Não foi possível carregar os alertas de documentos.' });
  }
});

// Histórico e links temporários: nunca expor storage_path ao browser.
clientsRouter.get('/:id/documents', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  const clientId = String(req.params.id || '');
  if (!employee || !canReadClients(employee.role)) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });
  try {
    let clientQuery = supabaseAdmin.from('clientes').select('id,loja_registo_id').eq('id', clientId);
    if (employee.role !== 'admin') clientQuery = clientQuery.eq('loja_registo_id', employee.loja_id as string);
    const { data: client, error: clientError } = await clientQuery.maybeSingle();
    if (clientError || !client) return res.status(404).json({ success: false, message: 'Cliente não encontrado nesta loja.' });
    const { data, error } = await supabaseAdmin.from('cliente_documentos')
      .select('id,tipo_documento,numero_documento,data_emissao,data_validade,mime_type,tamanho_bytes,uploaded_at,substituido_em,storage_path')
      .eq('cliente_id', clientId).order('uploaded_at', { ascending: false }).limit(50);
    if (error) throw error;
    const documents = await Promise.all((data || []).map(async (doc: any) => {
      const { data: signed } = await supabaseAdmin.storage.from('documentos-clientes')
        .createSignedUrl(doc.storage_path, 300);
      const { storage_path: _privatePath, ...safeDocument } = doc;
      return { ...safeDocument, signed_url: signed?.signedUrl || null };
    }));
    return res.json({ success: true, documentos: documents });
  } catch {
    return res.status(503).json({ success: false, message: 'Não foi possível consultar o histórico documental.' });
  }
});

// Recebe digitalização e substitui a versão activa, preservando o histórico.
clientsRouter.post('/:id/documents', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  const clientId = String(req.params.id || '');
  if (!employee || !canReadClients(employee.role)) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });

  const body = req.body || {};
  const tipoDocumento = typeof body.tipoDocumento === 'string' ? body.tipoDocumento : '';
  const numeroDocumento = typeof body.numeroDocumento === 'string' ? body.numeroDocumento.trim() : '';
  const dataEmissao = typeof body.dataEmissao === 'string' && body.dataEmissao ? body.dataEmissao : null;
  const dataValidade = typeof body.dataValidade === 'string' ? body.dataValidade : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 180) : '';
  const encoded = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
  const allowedMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const extByMime: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!['cc', 'passaporte', 'cartao_residente', 'outro'].includes(tipoDocumento) ||
      !numeroDocumento || numeroDocumento.length > 80 || !validDate(dataValidade) ||
      (dataEmissao && (!validDate(dataEmissao) || dataEmissao > dataValidade)) ||
      !allowedMime.includes(mimeType) || !fileName || !encoded || encoded.length > 9_000_000) {
    return res.status(400).json({ success: false, message: 'Indique documento, número, validade futura e um ficheiro PDF/JPEG/PNG/WebP até 6 MB.' });
  }
  if (dataValidade < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ success: false, message: 'O novo documento tem de estar dentro da validade.' });
  }
  let fileBuffer: Buffer;
  try { fileBuffer = Buffer.from(encoded.replace(/^data:[^;]+;base64,/, ''), 'base64'); }
  catch { return res.status(400).json({ success: false, message: 'Ficheiro inválido.' }); }
  if (!fileBuffer.length || fileBuffer.length > 6 * 1024 * 1024) {
    return res.status(400).json({ success: false, message: 'O ficheiro excede o limite de 6 MB ou está vazio.' });
  }

  let storagePath = '';
  let previousId: string | null = null;
  try {
    let clientQuery = supabaseAdmin.from('clientes').select('id,loja_registo_id')
      .eq('id', clientId);
    if (employee.role !== 'admin') clientQuery = clientQuery.eq('loja_registo_id', employee.loja_id as string);
    const { data: client, error: clientError } = await clientQuery.maybeSingle();
    if (clientError || !client) return res.status(404).json({ success: false, message: 'Cliente não encontrado nesta loja.' });

    const { data: previous, error: previousError } = await supabaseAdmin.from('cliente_documentos')
      .select('id').eq('cliente_id', clientId).is('substituido_em', null).maybeSingle();
    if (previousError) throw previousError;
    previousId = previous?.id || null;

    const safeName = fileName.replace(/[^\p{L}\p{N}._-]/gu, '_');
    storagePath = `${clientId}/${crypto.randomUUID()}.${extByMime[mimeType]}`;
    const { error: uploadError } = await supabaseAdmin.storage.from('documentos-clientes')
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false, metadata: { originalName: safeName } });
    if (uploadError) throw uploadError;

    if (previousId) {
      const { error } = await supabaseAdmin.from('cliente_documentos')
        .update({ substituido_em: new Date().toISOString(), substituido_por: employee.id })
        .eq('id', previousId).is('substituido_em', null);
      if (error) throw error;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin.from('cliente_documentos').insert({
      cliente_id: clientId, tipo_documento: tipoDocumento, numero_documento: numeroDocumento,
      data_emissao: dataEmissao, data_validade: dataValidade, storage_path: storagePath,
      mime_type: mimeType, tamanho_bytes: fileBuffer.length, uploaded_by: employee.id,
    }).select('id').single();
    if (insertError || !inserted) throw insertError || new Error('Falha ao registar documento.');

    const { error: updateError } = await supabaseAdmin.from('clientes').update({
      tipo_documento: tipoDocumento, bi_cc: numeroDocumento,
      data_emissao_documento: dataEmissao, data_validade_documento: dataValidade,
    }).eq('id', clientId);
    if (updateError) {
      await supabaseAdmin.from('cliente_documentos').delete().eq('id', inserted.id);
      throw updateError;
    }
    return res.status(201).json({ success: true, documento_id: inserted.id, message: 'Documento actualizado e versão anterior arquivada.' });
  } catch {
    if (storagePath) await supabaseAdmin.storage.from('documentos-clientes').remove([storagePath]);
    if (previousId) await supabaseAdmin.from('cliente_documentos')
      .update({ substituido_em: null, substituido_por: null }).eq('id', previousId);
    return res.status(503).json({ success: false, message: 'Não foi possível guardar o novo documento. A versão anterior foi preservada.' });
  }
});

clientsRouter.patch('/:id/status', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (employee?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Só um administrador pode alterar a classificação do cliente.' });
  }
  const status = req.body?.status;
  if (!['normal', 'vip', 'bloqueado'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Classificação de cliente inválida.' });
  }

  const { data, error } = await supabaseAdmin
    .from('clientes')
    .update({ status })
    .eq('id', req.params.id)
    .select('id,status')
    .maybeSingle();
  if (error) return res.status(503).json({ success: false, message: 'Não foi possível atualizar o cliente.' });
  if (!data) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
  return res.json({ success: true, cliente: data });
});

clientsRouter.get('/protected', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee || !canReadClients(employee.role) || (employee.role !== 'admin' && !employee.loja_id)) {
    return res.status(403).json({ success: false, message: 'Não tem autorização para consultar clientes.' });
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    const base = () => {
      let query = supabaseAdmin
        .from('clientes')
        .select('id,nome,bi_cc,nif,telemovel,loja_registo_id,created_at,tipo_documento,data_validade_documento')
        .order('created_at', { ascending: false })
        .limit(200);
      if (employee.role !== 'admin') query = query.eq('loja_registo_id', employee.loja_id as string);
      return query;
    };

    let rows: any[] = [];
    if (!search) {
      const { data, error } = await base();
      if (error) throw error;
      rows = data || [];
    } else {
      const digits = search.replace(/\D/g, '');
      const [byName, byBi, byNif] = await Promise.all([
        base().ilike('nome', `%${search}%`),
        base().ilike('bi_cc', `%${search}%`),
        digits.length > 0 ? base().ilike('nif', `%${digits}%`) : Promise.resolve({ data: [], error: null }),
      ]);
      if (byName.error || byBi.error || byNif.error) throw new Error('Falha na pesquisa protegida.');
      const merged = new Map<string, any>();
      for (const row of [...(byName.data || []), ...(byBi.data || []), ...(byNif.data || [])]) merged.set(row.id, row);
      rows = [...merged.values()];
    }

    const ids = [...new Set(rows.map((row) => row.bi_cc).filter(Boolean))];
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: txRows, error } = await supabaseAdmin
        .from('transacoes')
        .select('cliente_cc')
        .in('cliente_cc', ids);
      if (error) throw error;
      for (const tx of txRows || []) counts.set(tx.cliente_cc, (counts.get(tx.cliente_cc) || 0) + 1);
    }

    const clientes = rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      bi_cc_formatado: row.bi_cc ? `${row.bi_cc.slice(0, 4)}****` : '****',
      nif_formatado: row.nif ? `${row.nif.slice(0, 2)}*****${row.nif.slice(-2)}` : null,\n      tipo_documento: row.tipo_documento || null,\n      data_validade_documento: row.data_validade_documento || null,\n      estado_documento: row.data_validade_documento ? (row.data_validade_documento < new Date().toISOString().slice(0, 10) ? 'expirado' : row.data_validade_documento <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) ? 'a_expirar' : 'valido') : 'sem_data',
      telemovel: row.telemovel ? `${row.telemovel.slice(0, 3)}***${row.telemovel.slice(-2)}` : 'Não disponível',
      historico_compras_count: row.bi_cc ? (counts.get(row.bi_cc) || 0) : 0,
    }));
    return res.json({ success: true, clientes });
  } catch {
    return res.status(503).json({ success: false, message: 'Não foi possível pesquisar os clientes protegidos.' });
  }
});

export default clientsRouter;
