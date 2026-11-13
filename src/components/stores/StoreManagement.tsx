// PATH: src/components/stores/StoreManagement.tsx
import React, { useMemo, useState } from 'react';
import {
  Building2, Plus, Search, MapPin, Phone, FileText, Pencil, Power,
  RefreshCw, X, Loader2, CheckCircle2, AlertCircle, Hash,
} from 'lucide-react';
import { useStores, type Store } from '../../hooks/useSupabaseData';

type StoreForm = Pick<Store, 'codigo' | 'nome' | 'endereco' | 'nif' | 'telefone'>;

const emptyForm: StoreForm = { codigo: '', nome: '', endereco: '', nif: '', telefone: '' };

export const StoreManagement: React.FC = () => {
  const { data: stores, loading, error, refetch, createStore, updateStore, deleteStore } = useStores();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todas' | 'ativa' | 'inativa'>('todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState<StoreForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const activeCount = stores.filter((store) => store.status === 'ativa').length;
  const inactiveCount = stores.length - activeCount;
  const filteredStores = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-PT');
    return stores.filter((store) => {
      if (filter !== 'todas' && store.status !== filter) return false;
      if (!query) return true;
      return [store.nome, store.codigo, store.endereco, store.nif, store.telefone]
        .some((value) => (value || '').toLocaleLowerCase('pt-PT').includes(query));
    });
  }, [stores, search, filter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, codigo: `LOJ-${String(stores.length + 1).padStart(3, '0')}` });
    setNotice(null);
    setModalOpen(true);
  };

  const openEdit = (store: Store) => {
    setEditing(store);
    setForm({ codigo: store.codigo, nome: store.nome, endereco: store.endereco, nif: store.nif, telefone: store.telefone });
    setNotice(null);
    setModalOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.codigo.trim() || !form.endereco.trim() || !/^\d{9}$/.test(form.nif.trim())) {
      setNotice({ type: 'error', message: 'Preencha nome, código, morada e um NIF português com 9 dígitos.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (editing) {
        await updateStore(editing.id, {
          codigo: form.codigo.trim().toUpperCase(),
          nome: form.nome.trim(),
          endereco: form.endereco.trim(),
          nif: form.nif.trim(),
          telefone: form.telefone.trim(),
        });
        setNotice({ type: 'success', message: 'Dados da loja atualizados.' });
      } else {
        await createStore({
          codigo: form.codigo.trim().toUpperCase(),
          nome: form.nome.trim(),
          endereco: form.endereco.trim(),
          nif: form.nif.trim(),
          telefone: form.telefone.trim(),
        });
        setNotice({ type: 'success', message: 'Loja criada com sucesso.' });
      }
      setModalOpen(false);
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Não foi possível guardar a loja.' });
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (store: Store) => {
    if (!window.confirm(`Desativar "${store.nome}"? O registo e o histórico serão preservados.`)) return;
    setDeactivating(store.id);
    setNotice(null);
    try {
      await deleteStore(store.id);
      setNotice({ type: 'success', message: `"${store.nome}" foi desativada. O histórico foi preservado.` });
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Não foi possível desativar a loja.' });
    } finally {
      setDeactivating(null);
    }
  };

  const formatCoordinate = (value: number | null) => value === null ? 'Por localizar' : value.toFixed(5);

  return (
    <div className="min-h-screen bg-[#080d18] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-[#D4AF37]">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D4AF37]">Diamante OS · Rede</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Gestão de Lojas</h1>
              <p className="mt-1 text-sm text-slate-400">Registos oficiais, estado operacional e georreferenciação</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refetch()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
              <Plus className="h-4 w-4" /> Nova loja
            </button>
          </div>
        </header>

        {(notice || error) && (
          <div role="alert" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${notice?.type === 'error' || (!notice && error) ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
            {notice?.type === 'error' || (!notice && error) ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice?.message || error}</span>
            <button type="button" onClick={() => setNotice(null)} className="ml-auto text-current/70 hover:text-current" aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total de lojas', value: stores.length, hint: 'Registos na rede' },
            { label: 'Lojas ativas', value: activeCount, hint: 'Disponíveis para operação' },
            { label: 'Lojas inativas', value: inactiveCount, hint: 'Histórico preservado' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-800 bg-[#111a2a] p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-white">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#111a2a] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar nome, código, morada, NIF ou telefone" className="w-full rounded-xl border border-slate-700 bg-[#080d18] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#D4AF37]" />
            </div>
            <div className="flex rounded-xl border border-slate-700 bg-[#080d18] p-1">
              {(['todas', 'ativa', 'inativa'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === value ? 'bg-[#D4AF37] text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                  {value === 'todas' ? `Todas · ${stores.length}` : value === 'ativa' ? `Ativas · ${activeCount}` : `Inativas · ${inactiveCount}`}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading && stores.length === 0 ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-[#111a2a] p-12 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" /> A carregar lojas...</div>
        ) : filteredStores.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#111a2a] p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-600" />
            <h2 className="mt-3 font-semibold text-white">Nenhuma loja encontrada</h2>
            <p className="mt-1 text-sm text-slate-400">Ajuste a pesquisa ou os filtros, ou registe uma nova loja.</p>
          </div>
        ) : (
          <section aria-label="Lojas registadas" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredStores.map((store) => (
              <article key={store.id} className="rounded-2xl border border-slate-800 bg-[#111a2a] p-5 transition hover:border-amber-400/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]"><Hash className="h-3 w-3" /> {store.codigo || 'Sem código'}</p>
                    <h2 className="mt-1 truncate text-lg font-bold text-white">{store.nome}</h2>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${store.status === 'ativa' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>{store.status === 'ativa' ? 'Ativa' : 'Inativa'}</span>
                </div>
                <div className="mt-4 space-y-3 border-t border-slate-800 pt-4 text-sm">
                  <p className="flex items-start gap-2 text-slate-300"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><span>{store.endereco || 'Morada não indicada'}</span></p>
                  <p className="flex items-center gap-2 text-slate-300"><FileText className="h-4 w-4 shrink-0 text-slate-500" /><span>NIF: {store.nif || 'Não indicado'}</span></p>
                  <p className="flex items-center gap-2 text-slate-300"><Phone className="h-4 w-4 shrink-0 text-slate-500" /><span>{store.telefone || 'Telefone não indicado'}</span></p>
                  <p className="text-xs text-slate-500">Coordenadas: {formatCoordinate(store.latitude)} · {formatCoordinate(store.longitude)}</p>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
                  <button type="button" onClick={() => openEdit(store)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-[#D4AF37]"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                  {store.status === 'ativa' && <button type="button" onClick={() => void deactivate(store)} disabled={deactivating === store.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"><Power className="h-3.5 w-3.5" /> {deactivating === store.id ? 'A desativar...' : 'Desativar loja'}</button>}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="store-modal-title" className="my-8 w-full max-w-xl rounded-2xl border border-slate-700 bg-[#101827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">Rede Diamante D'Ouro</p>
                <h2 id="store-modal-title" className="mt-1 text-lg font-bold text-white">{editing ? 'Editar loja' : 'Registar nova loja'}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
              {[
                { key: 'codigo', label: 'Código da loja', placeholder: 'LOJ-001', required: true },
                { key: 'nome', label: 'Nome comercial', placeholder: "Diamante D'Ouro — Centro", required: true },
                { key: 'endereco', label: 'Morada completa', placeholder: 'Rua, número, código postal e localidade', required: true },
                { key: 'nif', label: 'NIF do estabelecimento', placeholder: '9 dígitos', required: true },
                { key: 'telefone', label: 'Telefone', placeholder: '+351 9XX XXX XXX', required: false },
              ].map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-300">{field.label}{field.required ? ' *' : ''}</span>
                  <input required={field.required} maxLength={field.key === 'nif' ? 9 : undefined} value={form[field.key as keyof StoreForm]} onChange={(event) => setForm((previous) => ({ ...previous, [field.key]: event.target.value }))} placeholder={field.placeholder} className="w-full rounded-xl border border-slate-700 bg-[#080d18] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#D4AF37]" />
                </label>
              ))}
              <p className="text-xs text-slate-500">A morada é georreferenciada pelo servidor quando a loja é guardada. Apenas os campos suportados pela base de dados são apresentados.</p>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Guardar alterações' : 'Criar loja'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
