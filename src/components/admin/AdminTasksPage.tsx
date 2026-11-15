import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, Clock3, ListTodo, Plus, RefreshCw, Search, ShieldCheck, UserRound, X, AlertTriangle, History, CalendarClock } from 'lucide-react';

type Task = {
  id: string; title: string; description: string; status: 'por_fazer'|'em_curso'|'bloqueada'|'concluida';
  priority: 'baixa'|'normal'|'alta'|'urgente'; assigned_to: string; created_by: string;
  loja_id: string|null; due_at: string|null; completed_at: string|null; created_at: string; updated_at: string;
  assignee?: { id: string; nome_completo: string; role: string }; creator?: { nome_completo: string }; lojas?: { nome?: string }|null;
};
type Employee = { id: string; nome_completo: string; role: string; loja_id: string|null; lojas?: { nome?: string }|null };
type TaskEvent = { id: string; action: string; old_values: Record<string, unknown>|null; new_values: Record<string, unknown>|null; created_at: string; funcionarios?: { nome_completo?: string } };

const statusLabels: Record<Task['status'], string> = { por_fazer: 'Por fazer', em_curso: 'Em curso', bloqueada: 'Bloqueada', concluida: 'Concluída' };
const priorityLabels: Record<Task['priority'], string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };
const dateLabel = (value?: string|null) => value ? new Date(value).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem prazo';

export const AdminTasksPage: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const { role, userSession } = useAuth();
  const isAdmin = role === 'admin' || userSession?.role === 'admin';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [historyTask, setHistoryTask] = useState<Task|null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', priority: 'normal', due_at: '' });

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = sessionStorage.getItem('diamante_jwt_token');
    if (!token) throw new Error('Sessão expirada. Inicie novamente a sessão.');
    const response = await fetch('/api/tasks' + path, {
      ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(init.headers || {}) },
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) throw new Error(payload?.message || 'Não foi possível concluir a operação.');
    return payload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [taskPayload, directory] = await Promise.all([
        api('?limit=100'),
        isAdmin ? fetch('/api/collaboration/directory', { headers: { Authorization: 'Bearer ' + (sessionStorage.getItem('diamante_jwt_token') || '') } }).then(async r => { const p = await r.json(); if (!r.ok || !p.success) throw new Error(p.message || 'Directório indisponível'); return p; }) : Promise.resolve({ employees: [] }),
      ]);
      setTasks(taskPayload.tasks || []);
      setEmployees(directory.employees || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar tarefas.'); }
    finally { setLoading(false); }
  }, [api, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => tasks.filter(task =>
    (statusFilter === 'all' || task.status === statusFilter) &&
    (task.title.toLowerCase().includes(search.toLowerCase()) || task.description.toLowerCase().includes(search.toLowerCase()) || task.assignee?.nome_completo?.toLowerCase().includes(search.toLowerCase()))
  ), [tasks, statusFilter, search]);

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api('', { method: 'POST', body: JSON.stringify({ ...form, due_at: form.due_at ? new Date(form.due_at).toISOString() : null }) });
      setShowCreate(false); setForm({ title: '', description: '', assigned_to: '', priority: 'normal', due_at: '' }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar a tarefa.'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (task: Task, status: Task['status']) => {
    try { await api('/' + task.id, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível actualizar a tarefa.'); }
  };

  const showHistory = async (task: Task) => {
    try { const payload = await api('/' + task.id + '/events'); setEvents(payload.events || []); setHistoryTask(task); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.'); }
  };

  const counts = {
    active: tasks.filter(t => t.status !== 'concluida').length,
    due: tasks.filter(t => t.due_at && new Date(t.due_at) < new Date() && t.status !== 'concluida').length,
    completed: tasks.filter(t => t.status === 'concluida').length,
  };

  return <div className="min-h-screen bg-[#080d17] px-4 pb-12 pt-20 text-white sm:px-6 lg:px-8 lg:pt-10">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#d8b85d]">Execução e acompanhamento</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Gestão de Tarefas</h1><p className="mt-2 max-w-xl text-sm text-slate-400">{isAdmin ? 'Distribua trabalho, acompanhe prazos e mantenha cada loja alinhada.' : 'Consulte as tarefas atribuídas e actualize o seu progresso.'}</p></div>
        <div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-slate-300 hover:bg-white/5"><RefreshCw className="h-4 w-4"/>Actualizar</button>{isAdmin && <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2.5 text-xs font-bold text-[#15120a] hover:bg-[#e6c65b]"><Plus className="h-4 w-4"/>Nova tarefa</button>}</div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[.08] bg-[#101b2b] p-5"><div className="flex items-center justify-between text-slate-400"><span className="text-xs">Tarefas activas</span><ListTodo className="h-4 w-4"/></div><p className="mt-3 text-3xl font-semibold tabular-nums">{counts.active}</p></div>
        <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[.045] p-5"><div className="flex items-center justify-between text-rose-200/70"><span className="text-xs">Prazos ultrapassados</span><AlertTriangle className="h-4 w-4"/></div><p className="mt-3 text-3xl font-semibold tabular-nums text-rose-200">{counts.due}</p></div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.045] p-5"><div className="flex items-center justify-between text-emerald-200/70"><span className="text-xs">Concluídas</span><CheckCircle2 className="h-4 w-4"/></div><p className="mt-3 text-3xl font-semibold tabular-nums text-emerald-200">{counts.completed}</p></div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0d1726]">
        <div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar tarefa ou responsável…" className="w-full rounded-xl border border-white/10 bg-[#080d17] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#d4af37]/40"/></label>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#080d17] px-3 py-2 text-sm text-slate-300"><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        </div>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">A carregar tarefas…</div> : visible.length === 0 ? <div className="p-12 text-center"><ListTodo className="mx-auto h-8 w-8 text-slate-600"/><p className="mt-3 text-sm text-slate-400">Não existem tarefas para estes filtros.</p></div> : <div className="divide-y divide-white/[.06]">{visible.map(task => {
          const overdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== 'concluida';
          return <article key={task.id} className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-100">{task.title}</h3><span className={'rounded-md px-2 py-1 text-[10px] font-semibold '+(task.priority==='urgente'?'bg-rose-400/10 text-rose-200':task.priority==='alta'?'bg-amber-400/10 text-amber-200':'bg-white/5 text-slate-400')}>{priorityLabels[task.priority]}</span><span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-400">{statusLabels[task.status]}</span></div>{task.description && <p className="mt-2 line-clamp-2 text-sm text-slate-400">{task.description}</p>}<div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5"/>{task.assignee?.nome_completo || 'Responsável'}</span><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5"/><span className={overdue?'text-rose-300':''}>{dateLabel(task.due_at)}</span></span>{task.lojas?.nome && <span>{task.lojas.nome}</span>}</div></div>
              <div className="flex shrink-0 items-center gap-2"><select aria-label={'Estado da tarefa '+task.title} value={task.status} disabled={task.status==='bloqueada' && !isAdmin} onChange={e=>void changeStatus(task,e.target.value as Task['status'])} className="max-w-[150px] rounded-lg border border-white/10 bg-[#080d17] px-2 py-2 text-xs text-slate-200">{Object.entries(statusLabels).filter(([k])=>isAdmin || k!=='bloqueada').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button onClick={()=>void showHistory(task)} title="Ver histórico" className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-[#e6c65b]"><History className="h-4 w-4"/></button></div>
            </div>
          </article>;
        })}</div>}
      </section>
      <p className="flex items-center gap-2 text-[11px] text-slate-600"><ShieldCheck className="h-4 w-4"/>As tarefas são consultadas pela sessão autenticada. Os funcionários só podem actualizar o estado das tarefas que lhes foram atribuídas.</p>
    </div>
    {showCreate && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={createTask} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101b2b] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-[#d4af37]">Distribuição de trabalho</p><h2 className="mt-1 text-xl font-semibold">Criar tarefa</h2></div><button type="button" onClick={()=>setShowCreate(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><X className="h-5 w-5"/></button></div><label className="mt-5 block text-xs text-slate-400">Título<input required minLength={5} maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white outline-none"/></label><label className="mt-3 block text-xs text-slate-400">Descrição<textarea maxLength={6000} rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white outline-none"/></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block text-xs text-slate-400">Responsável<select required value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white"><option value="">Seleccionar funcionário</option>{employees.map(person=><option key={person.id} value={person.id}>{person.nome_completo}{person.lojas?.nome?' · '+person.lojas.nome:''}</option>)}</select></label><label className="block text-xs text-slate-400">Prioridade<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white">{Object.entries(priorityLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><label className="mt-3 block text-xs text-slate-400">Prazo<input type="datetime-local" value={form.due_at} onChange={e=>setForm({...form,due_at:e.target.value})} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080d17] p-3 text-sm text-white"/></label><button disabled={saving} className="mt-5 w-full rounded-xl bg-[#d4af37] p-3 text-sm font-bold text-[#15120a] disabled:opacity-50">{saving?'A criar…':'Criar e atribuir tarefa'}</button></form></div>}
    {historyTask && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#101b2b] p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-[#d4af37]">Rastreabilidade</p><h2 className="mt-1 text-lg font-semibold">{historyTask.title}</h2></div><button onClick={()=>setHistoryTask(null)} className="rounded-lg p-2 text-slate-400"><X className="h-5 w-5"/></button></div><div className="mt-5 space-y-4">{events.map(event=><div key={event.id} className="border-l border-[#d4af37]/30 pl-4"><p className="text-xs font-semibold text-slate-200">{event.action==='created'?'Tarefa criada':event.action==='reassigned'?'Responsável alterado':event.action==='status_changed'?'Estado alterado':'Tarefa actualizada'}</p><p className="mt-1 text-[11px] text-slate-500">{event.funcionarios?.nome_completo || 'Sistema'} · {dateLabel(event.created_at)}</p>{event.new_values?.status !== undefined && event.new_values?.status !== null && <p className="mt-1 text-[11px] text-slate-400">Estado: {statusLabels[event.new_values.status as Task['status']] || String(event.new_values.status)}</p>}</div>)}{events.length===0&&<p className="text-sm text-slate-500">Sem histórico disponível.</p>}</div></div></div>}
  </div>;
};
