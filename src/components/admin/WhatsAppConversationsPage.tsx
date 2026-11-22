import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, RefreshCw, Send, Bot, UserRound, Search, Loader2, ShieldCheck } from 'lucide-react';

type Conversation = {
  id: string; contact_phone: string; mode: 'ai' | 'human'; status: 'unread' | 'in_service' | 'pending' | 'resolved'; assigned_admin_id: string | null;
  last_message_at: string; ai_send_token: string | null; last_message: { body: string; direction: string; sender_type: string; created_at: string } | null;
};
type Message = {
  id: string; direction: 'inbound' | 'outbound'; sender_type: 'customer' | 'ai' | 'admin';
  body: string; status: string; created_at: string; sent_at: string | null;
};

export const WhatsAppConversationsPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = sessionStorage.getItem('diamante_jwt_token');
    if (!token) throw new Error('Sessão administrativa expirada.');
    const response = await fetch('/api/admin/whatsapp' + path, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(init.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) throw new Error(payload?.message || 'Não foi possível concluir a operação.');
    return payload;
  }, []);

  const loadConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const payload = await api('/conversations');
      const rows = (payload.conversations || []) as Conversation[];
      setConversations(rows);
      setSelectedId(current => current && rows.some(row => row.id === current) ? current : rows[0]?.id || '');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar conversas.'); }
    finally { if (!quiet) setLoading(false); }
  }, [api]);

  const loadMessages = useCallback(async (id: string, quiet = false) => {
    if (!id) { setMessages([]); return; }
    try {
      const payload = await api('/conversations/' + encodeURIComponent(id) + '/messages');
      setMessages(payload.messages || []);
    } catch (e) { if (!quiet) setError(e instanceof Error ? e.message : 'Erro ao carregar mensagens.'); }
  }, [api]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    void loadMessages(selectedId);
    const timer = window.setInterval(() => { void loadMessages(selectedId, true); void loadConversations(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadMessages, loadConversations]);

  const selected = useMemo(() => conversations.find(item => item.id === selectedId) || null, [conversations, selectedId]);
  const filtered = useMemo(() => conversations.filter(item => item.contact_phone.includes(search.trim())), [conversations, search]);

  const setStatus = async (status: Conversation['status']) => {
    if (!selected) return;
    setWorking(true); setError('');
    try {
      await api('/conversations/' + selected.id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadConversations(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível alterar o estado.'); }
    finally { setWorking(false); }
  };

  const setMode = async (mode: 'ai' | 'human') => {
    if (!selected) return;
    setWorking(true); setError('');
    try {
      await api('/conversations/' + selected.id + '/control', { method: 'PATCH', body: JSON.stringify({ mode }) });
      await loadConversations(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível alterar o controlo.'); }
    finally { setWorking(false); }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true); setError('');
    try {
      await api('/conversations/' + selected.id + '/messages', {
        method: 'POST', body: JSON.stringify({ text, clientMessageId: crypto.randomUUID() }),
      });
      setDraft('');
      await loadMessages(selected.id);
      await loadConversations(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar. Se o resultado for incerto, confirme primeiro no WhatsApp.'); }
    finally { setSending(false); }
  };

  return (
    <div className="min-h-screen bg-[#080d17] p-4 text-slate-100 md:p-7">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#e7c66c]"><MessageCircle className="h-5 w-5" /><span className="text-[10px] font-bold tracking-[.2em]">DIAMANTE · ASSISTENTE VIRTUAL</span></div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">Conversas WhatsApp</h1>
          <p className="mt-1 text-sm text-slate-400">Acompanhe mensagens e assuma conversas individualmente.</p>
        </div>
        <button onClick={() => void loadConversations()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-slate-200 hover:border-[#D4AF37]/40"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </header>
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
      <div className="grid min-h-[650px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1422]">
          <div className="border-b border-white/10 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search className="h-4 w-4 text-slate-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar telemóvel" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" /></div>
          </div>
          <div className="max-h-[650px] overflow-y-auto">
            {loading ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" /></div> : filtered.map(item => (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full border-b border-white/[.06] p-4 text-left transition hover:bg-white/[.04] ${selectedId === item.id ? 'bg-[#D4AF37]/[.08]' : ''}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white">{item.contact_phone}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.mode === 'human' ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{item.mode === 'human' ? 'HUMANO' : 'DIAMANTE'}</span></div>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#e7c66c]">{({ unread: 'NÃO LIDA', in_service: 'EM ATENDIMENTO', pending: 'PENDENTE', resolved: 'RESOLVIDA' } as const)[item.status]}</p>
                <p className="mt-2 truncate text-xs text-slate-400">{item.last_message?.body || 'Sem mensagens'}</p>
                <p className="mt-1 text-[10px] text-slate-600">{new Date(item.last_message_at).toLocaleString('pt-PT')}</p>
              </button>
            ))}
            {!loading && filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Ainda não existem conversas.</p>}
          </div>
        </aside>
        <section className="flex min-h-[650px] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1422]">
          {selected ? <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
              <div><h2 className="font-bold text-white">{selected.contact_phone}</h2><p className="mt-1 text-xs text-slate-500">Conversa individual · histórico sincronizado</p><label className="mt-2 flex items-center gap-2 text-xs text-slate-400">Estado <select value={selected.status} disabled={working} onChange={e => void setStatus(e.target.value as Conversation['status'])} className="rounded-lg border border-white/10 bg-[#101b2c] px-2 py-1 text-xs text-slate-100"><option value="unread">Não lida</option><option value="in_service">Em atendimento</option><option value="pending">Pendente</option><option value="resolved">Resolvida</option></select></label></div>
              {selected.mode === 'ai' ? <button disabled={working} onClick={() => void setMode('human')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-slate-950 disabled:opacity-50"><UserRound className="h-4 w-4" /> Assumir conversa</button> : <button disabled={working} onClick={() => void setMode('ai')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-bold text-slate-950 disabled:opacity-50"><Bot className="h-4 w-4" /> Devolver ao Diamante</button>}
              {selected.ai_send_token && <span role="status" className="rounded-xl border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-200">Envio incerto · requer reconciliação operacional</span>}
            </div>
            <div className="flex items-center gap-2 border-b border-white/[.06] bg-black/10 px-4 py-2 text-[11px] text-slate-400"><ShieldCheck className="h-4 w-4 text-[#D4AF37]" /> {selected.mode === 'human' ? 'Modo humano: Assistente Diamante suspenso apenas nesta conversa.' : 'Modo automático: Assistente Diamante ativo nesta conversa.'}</div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map(message => <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.sender_type === 'ai' ? 'border border-emerald-400/20 bg-emerald-400/[.08]' : message.sender_type === 'admin' ? 'border border-[#D4AF37]/20 bg-[#D4AF37]/[.09]' : 'border border-white/10 bg-white/[.04]'}`}>
                  <div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">{message.sender_type === 'ai' ? 'Assistente Diamante' : message.sender_type === 'admin' ? 'Administração' : 'Cliente'} <span className="font-normal normal-case">{new Date(message.created_at).toLocaleString('pt-PT')}</span></div>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-100">{message.body}</p>
                  {message.status !== 'received' && <p className="mt-1 text-right text-[9px] text-slate-500">{message.status === 'unknown' ? 'Envio por confirmar' : message.status}</p>}
                </div>
              </div>)}
              {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Sem mensagens registadas.</p>}
            </div>
            {selected.mode === 'human' ? <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3"><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} placeholder="Escrever resposta manual..." className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-[#D4AF37]/40" /><button disabled={sending || !draft.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#D4AF37] px-4 text-sm font-bold text-slate-950 disabled:opacity-50"><Send className="h-4 w-4" /> Enviar</button></form> : <div className="border-t border-white/10 p-4 text-center text-xs text-slate-500">Assuma esta conversa para responder manualmente. O Assistente Diamante continua ativo nas outras conversas.</div>}
          </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500"><MessageCircle className="mb-3 h-9 w-9" /><p>Selecione uma conversa para consultar o histórico.</p></div>}
        </section>
      </div>
    </div>
  );
};
