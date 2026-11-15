import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import {
  MessageCircle, Users, Send, Plus, Search, Flag, AlertTriangle, Clock3,
  CheckCircle2, CircleDot, Paperclip, RefreshCw, X, ArrowLeft, UserRound,
  ShieldAlert, MessagesSquare, Bell
} from 'lucide-react';

type Employee = { id: string; nome_completo: string; role: string; loja_id: string | null; lojas?: { nome?: string } | null };
type Conversation = { id: string; tipo: 'directa' | 'grupo'; titulo: string | null; last_message_at: string; members: Array<{ funcionario_id: string; last_read_at?: string | null; funcionarios?: Employee }>; unread_count: number };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; funcionarios?: { nome_completo?: string; role?: string } };
type Report = { id: string; reference: string; titulo: string; descricao: string; categoria: string; prioridade: string; estado: string; reporter_id: string; assigned_to: string | null; created_at: string; funcionarios?: { nome_completo?: string } };
type Comment = { id: string; funcionario_id: string; comentario: string; created_at: string; funcionarios?: { nome_completo?: string } };
type Attachment = { id: string; original_name: string; mime_type: string; size_bytes: number; created_at: string };
type Notification = { id: string; kind: string; entity_id: string; title: string; body: string; read_at: string | null; created_at: string };
type ReportEvent = { id: string; actor_id: string; action: string; old_values: Record<string, unknown>; new_values: Record<string, unknown>; created_at: string; funcionarios?: { nome_completo?: string } };

const categories = [
  ['sistema', 'Sistema / aplicação'], ['equipamento', 'Equipamento'], ['caixa', 'Caixa / financeiro'],
  ['inventario', 'Inventário'], ['operacao', 'Operação da loja'], ['seguranca', 'Segurança'],
  ['sugestao', 'Sugestão de melhoria'], ['outro', 'Outro'],
];
const priorities = [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];
const statuses = [['novo', 'Novo'], ['em_analise', 'Em análise'], ['em_resolucao', 'Em resolução'], ['aguarda_informacao', 'Aguarda informação'], ['resolvido', 'Resolvido'], ['fechado', 'Fechado']];

export const CollaborationWorkspace: React.FC<{ initialSection?: 'chat' | 'reports'; onNavigate?: (path: string) => void }> = ({ initialSection = 'chat', onNavigate }) => {
  const { userSession, funcionario, role } = useAuth();
  const currentUserId = userSession?.id || funcionario?.id || '';
  const isAdmin = role === 'admin' || userSession?.role === 'admin';
  const token = () => sessionStorage.getItem('diamante_jwt_token') || '';
  const [section, setSection] = useState<'chat' | 'reports'>(initialSection);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directory, setDirectory] = useState<Employee[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activeConversation, setActiveConversation] = useState<string>('');
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reportEvents, setReportEvents] = useState<ReportEvent[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [search, setSearch] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showNewReport, setShowNewReport] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportCategory, setReportCategory] = useState('sistema');
  const [reportPriority, setReportPriority] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineEmployees, setOnlineEmployees] = useState<Set<string>>(() => new Set());

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const jwt = token();
    if (!jwt) throw new Error('Sessão expirada. Volte a iniciar sessão.');
    const response = await fetch('/api/collaboration' + path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: 'Bearer ' + jwt,
        ...init.headers,
      },
      signal: init.signal || AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) throw new Error(payload?.message || 'Não foi possível concluir a operação.');
    return payload;
  }, []);

  const loadConversations = useCallback(async () => {
    const result = await api('/conversations');
    setConversations(result.conversations || []);
  }, [api]);

  const loadReports = useCallback(async () => {
    const result = await api('/reports');
    setReports(result.reports || []);
  }, [api]);

  const loadNotifications = useCallback(async () => {
    const result = await api('/notifications');
    setNotifications(result.notifications || []);
  }, [api]);

  const loadMessages = useCallback(async (id: string) => {
    const result = await api('/conversations/' + encodeURIComponent(id) + '/messages');
    setMessages(result.messages || []);
    await loadConversations();
  }, [api, loadConversations]);

  const loadReport = useCallback(async (id: string) => {
    const result = await api('/reports/' + encodeURIComponent(id));
    setActiveReport(result.report);
    setComments(result.comments || []);
    setReportEvents(result.events || []);
    setAttachments(result.attachments || []);
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api('/directory').then((r) => { if (!cancelled) setDirectory(r.employees || []); }),
      loadConversations(),
      loadReports(),
      loadNotifications(),
    ]).catch((err) => { if (!cancelled) setError(err.message || 'Falha ao carregar colaboração.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, loadConversations, loadReports, loadNotifications]);

  useEffect(() => {
    if (!currentUserId || !token()) return;
    const connection = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: { token: token() },
      reconnection: true,
      reconnectionAttempts: 10,
    });
    setSocket(connection);
    connection.on('connect', () => {
      connection.emit('join_room', currentUserId);
      if (isAdmin) connection.emit('join_room', 'admin');
    });
    connection.on('chat:message', (message: Message) => {
      if (message.conversation_id === activeConversation) {
        setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message]);
        void loadConversations();
      } else {
        void loadConversations();
      }
    });
    connection.on('chat:conversation', () => void loadConversations());
    connection.on('report:created', () => void loadReports());
    connection.on('notification:new', () => void loadNotifications());
    connection.on('collab:presence_snapshot', (snapshot: { online?: string[] }) => {
      setOnlineEmployees(new Set(Array.isArray(snapshot.online) ? snapshot.online : []));
    });
    connection.on('collab:presence', (event: { employeeId?: string; online?: boolean }) => {
      if (!event?.employeeId || event.employeeId === currentUserId) return;
      setOnlineEmployees((previous) => {
        const next = new Set(previous);
        if (event.online) next.add(event.employeeId!);
        else next.delete(event.employeeId!);
        return next;
      });
    });
    connection.on('report:updated', (event: { id?: string }) => {
      void loadReports();
      if (event?.id && activeReport?.id === event.id) void loadReport(event.id);
    });
    connection.on('connect_error', () => setError('Ligação em tempo real indisponível. As mensagens continuam acessíveis através da actualização.'));
    return () => { connection.removeAllListeners(); connection.disconnect(); setSocket(null); };
  }, [currentUserId, isAdmin, activeConversation, activeReport?.id, loadConversations, loadReports, loadReport, loadNotifications]);

  useEffect(() => {
    if (!activeConversation) { setMessages([]); return; }
    void loadMessages(activeConversation).catch((err) => setError(err.message));
  }, [activeConversation, loadMessages]);

  const filteredConversations = useMemo(() => conversations.filter((item) => {
    const otherNames = item.members.map((member) => member.funcionarios?.nome_completo || '').join(' ');
    return (item.titulo || otherNames).toLowerCase().includes(search.toLowerCase());
  }), [conversations, search]);

  const active = conversations.find((item) => item.id === activeConversation);
  const activeName = active?.tipo === 'grupo'
    ? active.titulo || 'Grupo'
    : active?.members.find((member) => member.funcionario_id !== currentUserId)?.funcionarios?.nome_completo || 'Conversa privada';

  const createConversation = async () => {
    try {
      setError('');
      const result = await api('/conversations', {
        method: 'POST',
        body: JSON.stringify({ tipo: newGroup ? 'grupo' : 'directa', titulo: groupTitle, participants: selectedEmployees }),
      });
      setShowNewConversation(false);
      setSelectedEmployees([]);
      setGroupTitle('');
      await loadConversations();
      setActiveConversation(result.conversationId);
    } catch (err: any) { setError(err.message); }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = messageText.trim();
    if (!body || !activeConversation) return;
    setMessageText('');
    try {
      const result = await api('/conversations/' + encodeURIComponent(activeConversation) + '/messages', {
        method: 'POST', body: JSON.stringify({ body }),
      });
      setMessages((previous) => previous.some((item) => item.id === result.message.id) ? previous : [...previous, result.message]);
      await loadConversations();
    } catch (err: any) { setMessageText(body); setError(err.message); }
  };

  const createReport = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError('');
      await api('/reports', { method: 'POST', body: JSON.stringify({
        titulo: reportTitle, descricao: reportDescription, categoria: reportCategory, prioridade: reportPriority,
      }) });
      setShowNewReport(false);
      setReportTitle(''); setReportDescription('');
      await loadReports();
    } catch (err: any) { setError(err.message); }
  };

  const uploadAttachment = async (file?: File) => {
    if (!file || !activeReport) return;
    if (file.size > 6 * 1024 * 1024) { setError('O anexo não pode exceder 6 MB.'); return; }
    setUploadingAttachment(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler o ficheiro.'));
        reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1] || '';
      await api('/reports/' + encodeURIComponent(activeReport.id) + '/attachments', {
        method: 'POST', body: JSON.stringify({ name: file.name, mime_type: file.type, data: base64 }),
      });
      await loadReport(activeReport.id);
    } catch (err: any) { setError(err.message || 'Não foi possível carregar o anexo.'); }
    finally { setUploadingAttachment(false); }
  };

  const openAttachment = async (attachment: Attachment) => {
    if (!activeReport) return;
    try {
      const result = await api('/reports/' + encodeURIComponent(activeReport.id) + '/attachments/' + encodeURIComponent(attachment.id));
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) { setError(err.message || 'Não foi possível abrir o anexo.'); }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeReport || !commentText.trim()) return;
    try {
      const result = await api('/reports/' + encodeURIComponent(activeReport.id) + '/comments', {
        method: 'POST', body: JSON.stringify({ comentario: commentText }),
      });
      setComments((previous) => [...previous, result.comment]);
      setCommentText('');
    } catch (err: any) { setError(err.message); }
  };

  const updateReport = async (patch: Record<string, unknown>) => {
    if (!activeReport) return;
    try {
      const result = await api('/reports/' + encodeURIComponent(activeReport.id), {
        method: 'PATCH', body: JSON.stringify(patch),
      });
      setActiveReport((previous) => previous ? { ...previous, ...result.report } : previous);
      await loadReports();
    } catch (err: any) { setError(err.message); }
  };

  const dateLabel = (value: string) => new Date(value).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const statusLabel = (value: string) => statuses.find((item) => item[0] === value)?.[1] || value;
  const priorityLabel = (value: string) => priorities.find((item) => item[0] === value)?.[1] || value;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#080d17] p-3 text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#D4AF37]">Diamante OS · Colaboração</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Comunicação & Ocorrências</h1>
            <p className="mt-1 text-sm text-slate-400">Comunicação interna e acompanhamento de situações operacionais.</p>
          </div>
          <div className="relative flex items-center gap-2">
            <button onClick={() => setShowNotifications((value) => !value)} className="relative rounded-xl border border-white/10 p-2.5 text-slate-300 hover:bg-white/5" aria-label="Notificações">
              <Bell className="h-4 w-4" />
              {notifications.filter((item) => !item.read_at).length > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold text-white">{notifications.filter((item) => !item.read_at).length}</span>}
            </button>
            {showNotifications && <div className="absolute right-0 top-12 z-50 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-white/10 bg-[#101827] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 p-3"><span className="text-sm font-semibold text-white">Notificações</span><button onClick={() => void api('/notifications/read-all', { method: 'PATCH' }).then(loadNotifications).catch((err) => setError(err.message))} className="text-[11px] text-[#E6C66B]">Marcar todas como lidas</button></div>
              <div className="max-h-80 overflow-y-auto">{notifications.map((item) => <button key={item.id} onClick={() => { void api('/notifications/' + encodeURIComponent(item.id) + '/read', { method: 'PATCH' }).then(loadNotifications).catch((err) => setError(err.message)); setShowNotifications(false); if (item.kind.startsWith('report_')) { setSection('reports'); setActiveConversation(''); void loadReport(item.entity_id).catch((err) => setError(err.message)); } else if (item.kind === 'chat_message') { setSection('chat'); setActiveReport(null); setActiveConversation(item.entity_id); } else if (item.kind === 'task_assigned' || item.kind === 'task_updated') { onNavigate?.('/tasks'); } }} className={'block w-full border-b border-white/[0.06] p-3 text-left hover:bg-white/5 ' + (!item.read_at ? 'bg-[#D4AF37]/[0.06]' : '')}><div className="flex items-start gap-2"><span className={'mt-1 h-2 w-2 shrink-0 rounded-full ' + (!item.read_at ? 'bg-[#D4AF37]' : 'bg-slate-600')} /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white">{item.title}</span><span className="mt-1 block text-[11px] text-slate-400">{item.body}</span><span className="mt-1 block text-[10px] text-slate-600">{dateLabel(item.created_at)}</span></span></div></button>)}{notifications.length === 0 && <p className="p-5 text-center text-xs text-slate-500">Não tens notificações.</p>}</div>
            </div>}
            <button onClick={() => { void Promise.all([loadConversations(), loadReports(), loadNotifications()]); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
            <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>
        </div>

        <div className="mb-4 flex gap-2 rounded-2xl border border-white/10 bg-[#101827] p-1.5">
          <button onClick={() => { setSection('chat'); setActiveReport(null); }} className={'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ' + (section === 'chat' ? 'bg-[#D4AF37] text-[#17130a]' : 'text-slate-400 hover:bg-white/5')}>
            <MessagesSquare className="h-4 w-4" /> Messenger
          </button>
          <button onClick={() => { setSection('reports'); setActiveConversation(''); }} className={'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ' + (section === 'reports' ? 'bg-[#D4AF37] text-[#17130a]' : 'text-slate-400 hover:bg-white/5')}>
            <Flag className="h-4 w-4" /> Reportar situação
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{reports.filter((item) => !['resolvido', 'fechado'].includes(item.estado)).length}</span>
          </button>
        </div>

        {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError('')} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></div>}

        {section === 'chat' ? (
          <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-white/10 bg-[#101827] lg:grid-cols-[320px_1fr]">
            <aside className={(activeConversation ? 'hidden lg:flex' : 'flex') + ' flex-col border-b border-white/10 lg:border-b-0 lg:border-r'}>
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div><h2 className="font-semibold text-white">Conversas</h2><p className="text-xs text-slate-500">{conversations.length} conversas</p></div>
                <button onClick={() => setShowNewConversation(true)} className="rounded-xl bg-[#D4AF37] p-2 text-[#17130a]" aria-label="Nova conversa"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="border-b border-white/10 p-3"><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#080d17] px-3"><Search className="h-4 w-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar conversas" className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-600" /></div></div>
              <div className="flex-1 overflow-y-auto">
                {loading && <p className="p-4 text-sm text-slate-500">A carregar conversas…</p>}
                {filteredConversations.map((item) => {
                  const title = item.tipo === 'grupo' ? item.titulo : item.members.find((member) => member.funcionario_id !== currentUserId)?.funcionarios?.nome_completo || 'Conversa privada';
                  return <button key={item.id} onClick={() => setActiveConversation(item.id)} className={'flex w-full items-center gap-3 border-b border-white/[0.05] p-4 text-left hover:bg-white/[0.04] ' + (activeConversation === item.id ? 'bg-[#D4AF37]/10' : '')}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#E6C66B]">{item.tipo === 'grupo' ? <Users className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{title}</p><p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">{item.tipo === 'grupo' ? <>{item.members.length} participantes · {item.members.filter((member) => onlineEmployees.has(member.funcionario_id)).length} online</> : <><span className={'h-1.5 w-1.5 rounded-full ' + (onlineEmployees.has(item.members.find((member) => member.funcionario_id !== currentUserId)?.funcionario_id || '') ? 'bg-emerald-400' : 'bg-slate-600')} />{onlineEmployees.has(item.members.find((member) => member.funcionario_id !== currentUserId)?.funcionario_id || '') ? 'Online' : 'Offline'}</>}</p></div>
                    {item.unread_count > 0 && <span className="rounded-full bg-[#D4AF37] px-2 py-0.5 text-[10px] font-bold text-black">{item.unread_count}</span>}
                  </button>;
                })}
                {!loading && filteredConversations.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Ainda não existem conversas. Inicie uma conversa privada ou crie um grupo.</div>}
              </div>
            </aside>
            <section className={(activeConversation ? 'flex' : 'hidden lg:flex') + ' min-h-[620px] flex-col'}>
              {activeConversation ? <>
                <div className="flex items-center gap-3 border-b border-white/10 p-4"><button onClick={() => setActiveConversation('')} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 lg:hidden"><ArrowLeft className="h-5 w-5" /></button><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37]/10 text-[#E6C66B]"><MessageCircle className="h-4 w-4" /></div><div><h2 className="font-semibold text-white">{activeName}</h2><p className="flex items-center gap-1.5 text-[11px] text-slate-500">{active?.tipo === 'directa' ? <><span className={'h-1.5 w-1.5 rounded-full ' + (onlineEmployees.has(active?.members.find((member) => member.funcionario_id !== currentUserId)?.funcionario_id || '') ? 'bg-emerald-400' : 'bg-slate-600')} />{onlineEmployees.has(active?.members.find((member) => member.funcionario_id !== currentUserId)?.funcionario_id || '') ? 'Online' : 'Offline'}</> : <>{active?.members.length || 0} participantes · {active?.members.filter((member) => onlineEmployees.has(member.funcionario_id)).length || 0} online</>}</p></div></div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((item) => <div key={item.id} className={'flex ' + (item.sender_id === currentUserId ? 'justify-end' : 'justify-start')}><div className={'max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[70%] ' + (item.sender_id === currentUserId ? 'rounded-br-md bg-[#9b7b22] text-white' : 'rounded-bl-md border border-white/10 bg-[#182337] text-slate-100')}><p className="mb-1 text-[10px] font-semibold opacity-70">{item.sender_id === currentUserId ? 'Tu' : item.funcionarios?.nome_completo || 'Colega'}</p><p className="whitespace-pre-wrap break-words text-sm">{item.body}</p><p className="mt-1 text-right text-[10px] opacity-60">{dateLabel(item.created_at)}{item.sender_id === currentUserId && active?.members.some((member) => member.funcionario_id !== currentUserId && member.last_read_at && new Date(member.last_read_at).getTime() >= new Date(item.created_at).getTime()) ? ' · Visto' : ''}</p></div></div>)}
                  {messages.length === 0 && <p className="py-12 text-center text-sm text-slate-500">Esta conversa ainda não tem mensagens.</p>}
                </div>
                <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-white/10 p-3"><textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={2} maxLength={4000} placeholder="Escreva uma mensagem…" className="max-h-32 min-h-12 flex-1 resize-y rounded-xl border border-white/10 bg-[#080d17] px-3 py-3 text-sm outline-none focus:border-[#D4AF37]/50" /><button disabled={!messageText.trim()} className="rounded-xl bg-[#D4AF37] p-3 text-black disabled:opacity-40"><Send className="h-5 w-5" /></button></form>
              </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><MessagesSquare className="h-12 w-12 text-[#D4AF37]/50" /><h2 className="mt-4 text-lg font-semibold text-white">O teu espaço de comunicação</h2><p className="mt-2 max-w-sm text-sm text-slate-500">Selecciona uma conversa ou inicia uma conversa privada com um colega. Também podes criar grupos de trabalho.</p><button onClick={() => setShowNewConversation(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-semibold text-black"><Plus className="h-4 w-4" /> Nova conversa</button></div>}
            </section>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101827]">
              <div className="flex items-center justify-between border-b border-white/10 p-4"><div><h2 className="font-semibold text-white">Ocorrências comunicadas</h2><p className="text-xs text-slate-500">Acompanha o estado das situações reportadas.</p></div><button onClick={() => setShowNewReport(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-3 py-2 text-xs font-bold text-black"><Plus className="h-4 w-4" /> Nova ocorrência</button></div>
              <div className="divide-y divide-white/[0.06]">
                {reports.map((item) => <button key={item.id} onClick={() => void loadReport(item.id).catch((err) => setError(err.message))} className={'flex w-full items-start gap-3 p-4 text-left hover:bg-white/[0.04] ' + (activeReport?.id === item.id ? 'bg-[#D4AF37]/10' : '')}><div className="mt-0.5 rounded-xl bg-amber-500/10 p-2 text-amber-300"><Flag className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold tracking-wide text-[#D4AF37]">{item.reference}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{statusLabel(item.estado)}</span><span className="text-[10px] text-slate-500">{priorityLabel(item.prioridade)}</span></div><p className="mt-1 truncate text-sm font-semibold text-white">{item.titulo}</p><p className="mt-1 text-[11px] text-slate-500">{item.categoria} · {dateLabel(item.created_at)}</p></div></button>)}
                {reports.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Ainda não existem ocorrências registadas.</div>}
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[#101827] p-4">
              {activeReport ? <><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold text-[#D4AF37]">{activeReport.reference}</p><h2 className="mt-1 text-lg font-semibold text-white">{activeReport.titulo}</h2></div><button onClick={() => setActiveReport(null)} className="rounded-lg p-1 text-slate-500 hover:bg-white/5" aria-label="Fechar ocorrência"><X className="h-4 w-4" /></button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{activeReport.descricao}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400"><span className="rounded-lg bg-white/5 px-2 py-1">{activeReport.categoria}</span><span className="rounded-lg bg-white/5 px-2 py-1">{priorityLabel(activeReport.prioridade)}</span></div>
                {isAdmin && <div className="mt-4 grid grid-cols-1 gap-2"><label className="text-xs text-slate-400">Estado da ocorrência<select value={activeReport.estado} onChange={(e) => void updateReport({ estado: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d17] p-2.5 text-sm text-white">{statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs text-slate-400">Prioridade<select value={activeReport.prioridade} onChange={(e) => void updateReport({ prioridade: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d17] p-2.5 text-sm text-white">{priorities.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs text-slate-400">Responsável<select value={activeReport.assigned_to || ''} onChange={(e) => void updateReport({ assigned_to: e.target.value || null })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080d17] p-2.5 text-sm text-white"><option value="">Sem responsável</option>{directory.map((person) => <option key={person.id} value={person.id}>{person.nome_completo}</option>)}</select></label></div>}
                <div className="mt-5 border-t border-white/10 pt-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Anexos e evidências</h3><label className={'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-[#E6C66B] hover:bg-white/5 ' + (uploadingAttachment ? 'pointer-events-none opacity-50' : '')}><Paperclip className="h-3.5 w-3.5" />{uploadingAttachment ? 'A carregar…' : 'Adicionar ficheiro'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingAttachment} onChange={(event) => { const file = event.target.files?.[0]; void uploadAttachment(file); event.currentTarget.value = ''; }} /></label></div><div className="space-y-2">{attachments.map((attachment) => <button key={attachment.id} onClick={() => void openAttachment(attachment)} className="flex w-full items-center gap-3 rounded-xl bg-[#080d17] p-3 text-left hover:bg-white/5"><Paperclip className="h-4 w-4 shrink-0 text-[#D4AF37]" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-200">{attachment.original_name}</span><span className="text-[10px] text-slate-500">{(attachment.size_bytes / 1024).toFixed(0)} KB · {dateLabel(attachment.created_at)}</span></span></button>)}{attachments.length === 0 && <p className="text-xs text-slate-500">Ainda não existem anexos.</p>}</div><p className="mt-2 text-[10px] text-slate-600">PDF, JPEG, PNG ou WebP · máximo 6 MB. Acesso reservado aos participantes autorizados na ocorrência.</p></div>
                <div className="mt-5 border-t border-white/10 pt-4"><h3 className="mb-3 text-sm font-semibold text-white">Histórico de alterações</h3><div className="max-h-52 space-y-3 overflow-y-auto">{reportEvents.map((event) => <div key={event.id} className="flex gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D4AF37]" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-200">{event.funcionarios?.nome_completo || 'Administrador'} <span className="font-normal text-slate-500">· {dateLabel(event.created_at)}</span></p><p className="mt-1 text-xs text-slate-400">{Object.entries(event.new_values || {}).map(([key, value]) => key === 'estado' ? 'Estado: ' + statusLabel(String(value)) : key === 'prioridade' ? 'Prioridade: ' + priorityLabel(String(value)) : key === 'assigned_to' ? 'Responsável actualizado' : key + ': ' + String(value)).join(' · ') || 'Ocorrência actualizada'}</p></div></div>)}{reportEvents.length === 0 && <p className="text-xs text-slate-500">Ainda não existem alterações registadas.</p>}</div></div>
                <div className="mt-5 border-t border-white/10 pt-4"><h3 className="mb-3 text-sm font-semibold text-white">Acompanhamento</h3><div className="max-h-64 space-y-3 overflow-y-auto">{comments.map((comment) => <div key={comment.id} className="rounded-xl bg-[#080d17] p-3"><p className="text-[11px] font-semibold text-[#D4AF37]">{comment.funcionarios?.nome_completo || 'Funcionário'} · {dateLabel(comment.created_at)}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{comment.comentario}</p></div>)}{comments.length === 0 && <p className="text-xs text-slate-500">Ainda sem comentários.</p>}</div><form onSubmit={addComment} className="mt-3 flex gap-2"><input value={commentText} onChange={(e) => setCommentText(e.target.value)} maxLength={4000} placeholder="Adicionar informação…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080d17] px-3 py-2.5 text-sm outline-none" /><button disabled={!commentText.trim()} className="rounded-xl bg-[#D4AF37] px-3 text-black disabled:opacity-40"><Send className="h-4 w-4" /></button></form></div>
              </> : <div className="flex min-h-72 flex-col items-center justify-center text-center"><ShieldAlert className="h-10 w-10 text-amber-300/60" /><p className="mt-3 text-sm font-semibold text-white">Gestão de ocorrências</p><p className="mt-1 max-w-xs text-xs text-slate-500">Selecciona uma ocorrência para consultar o histórico e acompanhar a resolução.</p></div>}
            </section>
          </div>
        )}

        {showNewConversation && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101827] p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Nova conversa</h2><button onClick={() => setShowNewConversation(false)}><X className="h-5 w-5 text-slate-400" /></button></div><div className="mt-4 flex gap-2"><button onClick={() => { setNewGroup(false); setSelectedEmployees([]); }} className={'flex-1 rounded-xl p-2.5 text-sm ' + (!newGroup ? 'bg-[#D4AF37] font-semibold text-black' : 'bg-white/5 text-slate-400')}>Privada</button><button onClick={() => { setNewGroup(true); setSelectedEmployees([]); }} className={'flex-1 rounded-xl p-2.5 text-sm ' + (newGroup ? 'bg-[#D4AF37] font-semibold text-black' : 'bg-white/5 text-slate-400')}>Grupo</button></div>{newGroup && <input value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} maxLength={100} placeholder="Nome do grupo" className="mt-3 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm outline-none" />}<div className="mt-3 max-h-72 space-y-1 overflow-y-auto">{directory.map((person) => <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-3 hover:bg-white/5"><input type={newGroup ? 'checkbox' : 'radio'} name="employee" checked={selectedEmployees.includes(person.id)} onChange={() => setSelectedEmployees((previous) => newGroup ? (previous.includes(person.id) ? previous.filter((id) => id !== person.id) : [...previous, person.id]) : [person.id])} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm text-white"><span className="truncate">{person.nome_completo}</span><span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (onlineEmployees.has(person.id) ? 'bg-emerald-400' : 'bg-slate-600')} /></span><span className="block text-[11px] text-slate-500">{person.role}{person.lojas?.nome ? ' · ' + person.lojas.nome : ''}{onlineEmployees.has(person.id) ? ' · Online' : ''}</span></span></label>)}</div><button disabled={selectedEmployees.length === 0 || (newGroup && groupTitle.trim().length < 2)} onClick={() => void createConversation()} className="mt-4 w-full rounded-xl bg-[#D4AF37] p-3 text-sm font-bold text-black disabled:opacity-40">Criar conversa</button></div></div>}

        {showNewReport && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"><form onSubmit={createReport} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101827] p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Reportar uma situação</h2><button type="button" onClick={() => setShowNewReport(false)}><X className="h-5 w-5 text-slate-400" /></button></div><label className="mt-4 block text-xs text-slate-400">Título<input required minLength={5} maxLength={140} value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Ex.: Erro ao finalizar uma compra" className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white outline-none" /></label><label className="mt-3 block text-xs text-slate-400">Categoria<select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white">{categories.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-3 block text-xs text-slate-400">Prioridade<select value={reportPriority} onChange={(e) => setReportPriority(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white">{priorities.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-3 block text-xs text-slate-400">Descrição<textarea required minLength={10} maxLength={8000} rows={6} value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder="Descreve o que aconteceu, em que ecrã, que passos efectuaste e qual era o resultado esperado…" className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white outline-none" /></label><p className="mt-2 text-[11px] text-slate-500">Não incluas palavras-passe, códigos de acesso ou dados pessoais de clientes.</p><button className="mt-4 w-full rounded-xl bg-[#D4AF37] p-3 text-sm font-bold text-black">Enviar ocorrência</button></form></div>}
      </div>
    </div>
  );
};
