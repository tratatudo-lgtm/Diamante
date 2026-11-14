-- Defense in depth: remove direct Data API table privileges from tables
-- that currently have no RLS policies and no active application references.
-- RLS remains enabled. Backend/service_role access is intentionally preserved.
REVOKE ALL PRIVILEGES ON TABLE
  public.configuracoes_alertas,
  public.crm_anexos,
  public.crm_fornecedores,
  public.itens_lote_fundicao,
  public.planos_subscricao,
  public.recibos,
  public.subscricoes_ativas,
  public.turnos,
  public.whatsapp_messages
FROM anon, authenticated;
