import { Router, Response } from 'express';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';
import { supabaseAdmin } from './auth.service';

const storeRouter = Router();

storeRouter.get('/dashboard', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee?.ativo || !employee.loja_id || employee.role !== 'funcionario') {
    return res.status(403).json({ success: false, message: 'A sua conta não tem acesso ao painel desta loja.' });
  }

  const today = typeof req.query.today === 'string' ? req.query.today : '';
  const yesterday = typeof req.query.yesterday === 'string' ? req.query.yesterday : '';
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(today) || !validDate(yesterday)) {
    return res.status(400).json({ success: false, message: 'Datas do painel inválidas.' });
  }

  try {
    const [storeRes, pointsRes, todayKpiRes, yesterdayKpiRes, stockRes, transactionsRes] = await Promise.all([
      supabaseAdmin.from('lojas')
        .select('id, nome, codigo_loja, morada, telefone, latitude, longitude, ativo')
        .eq('id', employee.loja_id).eq('ativo', true).maybeSingle(),
      supabaseAdmin.from('registos_ponto')
        .select('id, funcionario_id, loja_id, tipo, timestamp, localizacao')
        .eq('funcionario_id', employee.id)
        .order('timestamp', { ascending: false }).limit(10),
      supabaseAdmin.from('kpi_loja_diaria').select('*')
        .eq('loja_id', employee.loja_id).eq('data', today).maybeSingle(),
      supabaseAdmin.from('kpi_loja_diaria').select('*')
        .eq('loja_id', employee.loja_id).eq('data', yesterday).maybeSingle(),
      supabaseAdmin.from('inventario_fisico').select('id', { count: 'exact', head: true })
        .eq('loja_atual_id', employee.loja_id).eq('estado', 'em_loja'),
      supabaseAdmin.from('transacoes')
        .select('id, loja_id, estado, valor_final, peso_gramas, created_at')
        .eq('loja_id', employee.loja_id)
        .order('created_at', { ascending: false }).limit(5),
    ]);

    if (storeRes.error || pointsRes.error || todayKpiRes.error || yesterdayKpiRes.error || stockRes.error || transactionsRes.error) {
      console.error('[STORE DASHBOARD] Falha numa ou mais consultas do painel.');
      return res.status(503).json({ success: false, message: 'Não foi possível carregar os dados operacionais da loja.' });
    }
    if (!storeRes.data) return res.status(404).json({ success: false, message: 'Loja não encontrada ou inativa.' });

    return res.json({
      success: true,
      loja: storeRes.data,
      pontos: pointsRes.data || [],
      kpiHoje: todayKpiRes.data || null,
      kpiOntem: yesterdayKpiRes.data || null,
      stockEmLojaCount: stockRes.count || 0,
      transacoes: transactionsRes.data || [],
    });
  } catch {
    console.error('[STORE DASHBOARD] Erro interno ao carregar o painel.');
    return res.status(500).json({ success: false, message: 'Erro interno ao carregar o painel da loja.' });
  }
});

storeRouter.post('/clock', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee?.ativo || !employee.loja_id || employee.role !== 'funcionario') {
    return res.status(403).json({ success: false, message: 'A sua conta não pode registar ponto nesta loja.' });
  }

  const tipo = req.body?.tipo;
  if (tipo !== 'entrada' && tipo !== 'saida') {
    return res.status(400).json({ success: false, message: 'Tipo de registo de ponto inválido.' });
  }

  let localizacao: { lat: number; lng: number } | null = null;
  const coordinates = req.body?.localizacao;
  if (coordinates !== null && coordinates !== undefined) {
    const lat = Number(coordinates.lat);
    const lng = Number(coordinates.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Coordenadas de localização inválidas.' });
    }
    localizacao = { lat, lng };
  }

  try {
    const { data: lastPoint, error: lastPointError } = await supabaseAdmin
      .from('registos_ponto')
      .select('tipo')
      .eq('funcionario_id', employee.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPointError) {
      console.error('[STORE CLOCK] Falha ao verificar o último registo.');
      return res.status(503).json({ success: false, message: 'Não foi possível validar o último registo de ponto.' });
    }
    if (lastPoint?.tipo === tipo) {
      return res.status(409).json({ success: false, message: tipo === 'entrada' ? 'Já existe um turno activo.' : 'Não existe um turno activo para terminar.' });
    }

    const { data, error } = await supabaseAdmin
      .from('registos_ponto')
      .insert({
        funcionario_id: employee.id,
        loja_id: employee.loja_id,
        tipo,
        timestamp: new Date().toISOString(),
        localizacao,
      })
      .select('id, funcionario_id, loja_id, tipo, timestamp, localizacao')
      .single();

    if (error || !data) {
      console.error('[STORE CLOCK] Falha ao guardar o registo de ponto.');
      return res.status(503).json({ success: false, message: 'Não foi possível guardar o registo de ponto.' });
    }
    return res.status(201).json({ success: true, ponto: data });
  } catch {
    console.error('[STORE CLOCK] Erro interno.');
    return res.status(500).json({ success: false, message: 'Erro interno ao registar o ponto.' });
  }
});

storeRouter.get('/inventory', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee?.ativo || !employee.loja_id || employee.role !== 'funcionario') {
    return res.status(403).json({ success: false, message: 'A sua conta não tem acesso ao inventário desta loja.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('inventario_fisico')
      .select('*')
      .eq('loja_atual_id', employee.loja_id)
      .order('data_entrada', { ascending: false });

    if (error) {
      console.error('[STORE INVENTORY] Falha ao consultar inventário da loja.');
      return res.status(503).json({ success: false, message: 'Não foi possível carregar o inventário da loja.' });
    }
    return res.json({ success: true, items: data || [] });
  } catch {
    console.error('[STORE INVENTORY] Erro interno ao consultar inventário.');
    return res.status(500).json({ success: false, message: 'Erro interno ao carregar o inventário.' });
  }
});

storeRouter.post('/inventory/:id/dispatch', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  const itemId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!employee?.ativo || !employee.loja_id || employee.role !== 'funcionario') {
    return res.status(403).json({ success: false, message: 'A sua conta não pode expedir inventário.' });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) {
    return res.status(400).json({ success: false, message: 'Identificador de inventário inválido.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('inventario_fisico')
      .update({ estado: 'enviado_sede', data_saida: new Date().toISOString() })
      .eq('id', itemId)
      .eq('loja_atual_id', employee.loja_id)
      .eq('estado', 'em_loja')
      .select('id, codigo_unico, estado, data_saida')
      .maybeSingle();

    if (error) {
      console.error('[STORE INVENTORY] Falha ao expedir peça.');
      return res.status(503).json({ success: false, message: 'Não foi possível registar a expedição do inventário.' });
    }
    if (!data) {
      return res.status(409).json({ success: false, message: 'A peça já não está disponível nesta loja ou já foi expedida.' });
    }

    const io = (globalThis as any).io;
    if (io) {
      io.to('admin').emit('inventory:dispatched', { id: data.id, codigo_unico: data.codigo_unico });
      io.to('store:' + employee.loja_id).emit('inventory:dispatched', { id: data.id, codigo_unico: data.codigo_unico });
    }
    return res.json({ success: true, item: data });
  } catch {
    console.error('[STORE INVENTORY] Erro interno ao expedir peça.');
    return res.status(500).json({ success: false, message: 'Erro interno ao registar a expedição.' });
  }
});

storeRouter.get('/purchase-settings', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee?.ativo || !employee.loja_id || employee.role !== 'funcionario') {
    return res.status(403).json({ success: false, message: 'A sua conta não tem acesso aos parâmetros de compra desta loja.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'parametros_compra_ouro')
      .maybeSingle();

    if (error) {
      console.error('[STORE PURCHASE SETTINGS] Falha ao consultar parâmetros.');
      return res.status(503).json({ success: false, message: 'Não foi possível carregar os parâmetros de compra.' });
    }

    const all = Array.isArray(data?.valor?.margens) ? data.valor.margens : [];
    const active = all.filter((item: any) =>
      item && item.ativo === true &&
      (item.loja_id == null || item.loja_id === employee.loja_id) &&
      Number.isInteger(item.toque_millesimos) && item.toque_millesimos > 0 && item.toque_millesimos <= 1000 &&
      Number.isFinite(item.cotacao_referencia_g) && item.cotacao_referencia_g > 0 &&
      Number.isFinite(item.margem_percentagem) && item.margem_percentagem >= 0 && item.margem_percentagem <= 100
    );
    const byMetal = new Map<string, any>();
    for (const item of active) {
      const key = String(item.metal_tipo).toLowerCase().match(/(\\d+(?:\\.\\d+)?)\\s*k/)?.[1]
        ? 'ouro-' + String(item.metal_tipo).toLowerCase().match(/(\\d+(?:\\.\\d+)?)\\s*k/)![1]
        : (/prata.*925|925.*prata/i.test(String(item.metal_tipo)) ? 'prata-925' : String(item.metal_tipo).trim().toLowerCase());
      const existing = byMetal.get(key);
      if (!existing || (item.loja_id === employee.loja_id && existing.loja_id == null)) byMetal.set(key, item);
    }

    return res.json({
      success: true,
      lojaId: employee.loja_id,
      margens: Array.from(byMetal.values()).map((item: any) => ({
        metal_tipo: item.metal_tipo,
        toque_millesimos: item.toque_millesimos,
        cotacao_referencia_g: item.cotacao_referencia_g,
        margem_percentagem: item.margem_percentagem,
        preco_compra_grama: Number((item.cotacao_referencia_g * item.toque_millesimos / 1000 * (1 - item.margem_percentagem / 100)).toFixed(2)),
        desconto_maximo_loja_perc: Number(item.desconto_maximo_loja_perc) || 0,
      })),
    });
  } catch {
    console.error('[STORE PURCHASE SETTINGS] Erro interno.');
    return res.status(500).json({ success: false, message: 'Erro interno ao carregar os parâmetros de compra.' });
  }
});

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

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey) ||
      !clienteNome || clienteNome.length > 200 || !clienteCc || clienteCc.length > 80 ||
      clienteTelemovel.length > 40 || !tipoPeca || tipoPeca.length > 100 ||
      !metal || metal.length > 100 || descricao.length > 2000 ||
      !Number.isFinite(peso) || peso <= 0 || peso > 100000 ||
      !Number.isFinite(valorFinal) || valorFinal <= 0 || valorFinal > 100000000) {
    return res.status(400).json({ success: false, message: 'Os dados da compra são inválidos. Verifique os campos e tente novamente.' });
  }

  // A cotação e a margem são sempre lidas da configuração aprovada pela administração.
  let cotacaoSpot = 0;
  let margem = 0;
  let valorSugerido = 0;
  try {
    const { data: configRow, error: configError } = await supabaseAdmin
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'parametros_compra_ouro')
      .maybeSingle();
    if (configError) {
      console.error('[Store Purchase] Falha ao consultar parâmetros aprovados.');
      return res.status(503).json({ success: false, message: 'Não foi possível validar os parâmetros de compra. Tente novamente.' });
    }

    const configs = Array.isArray(configRow?.valor?.margens) ? configRow.valor.margens : [];
    const matching = configs.filter((item: any) =>
      item && item.ativo === true && item.metal_tipo === metal &&
      (item.loja_id == null || item.loja_id === employee.loja_id)
    );
    const metalConfig = matching.find((item: any) => item.loja_id === employee.loja_id) ||
      matching.find((item: any) => item.loja_id == null);
    if (!metalConfig || !Number.isInteger(metalConfig.toque_millesimos) ||
        metalConfig.toque_millesimos <= 0 || metalConfig.toque_millesimos > 1000 ||
        !Number.isFinite(metalConfig.cotacao_referencia_g) || metalConfig.cotacao_referencia_g <= 0 ||
        !Number.isFinite(metalConfig.margem_percentagem) || metalConfig.margem_percentagem < 0 || metalConfig.margem_percentagem > 100) {
      return res.status(409).json({ success: false, message: 'Este metal não tem uma cotação e margem activas configuradas pela sede para a sua loja. Contacte a administração.' });
    }

    cotacaoSpot = Number(metalConfig.cotacao_referencia_g);
    margem = Number(metalConfig.margem_percentagem);
    const precoCompraGrama = cotacaoSpot * (metalConfig.toque_millesimos / 1000) * (1 - margem / 100);
    valorSugerido = Number((peso * precoCompraGrama).toFixed(2));
  } catch {
    console.error('[Store Purchase] Erro ao validar parâmetros de compra.');
    return res.status(503).json({ success: false, message: 'Não foi possível validar os parâmetros de compra.' });
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
