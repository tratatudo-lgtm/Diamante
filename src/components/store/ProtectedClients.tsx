import React, { useState, useEffect, useCallback } from 'react';

import type { ClienteProtegido } from '../../types/database';
import {
  ShieldCheck,
  Search,
  UserCheck,
  Lock,
  Phone,
  CreditCard,
  Receipt,
  FileLock,
  AlertCircle
} from 'lucide-react';

interface ProtectedClientsProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
}

export const ProtectedClients: React.FC<ProtectedClientsProps> = ({ onShowToast }) => {
  const [clientes, setClientes] = useState<ClienteProtegido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [documentClientId, setDocumentClientId] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('cc');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentIssueDate, setDocumentIssueDate] = useState('');
  const [documentExpiryDate, setDocumentExpiryDate] = useState('');
  const [documentSaving, setDocumentSaving] = useState(false);

  // Consulta obrigatória à VIEW v_clientes_protegidos (NUNCA à tabela clientes)
  const fetchProtectedClients = useCallback(async (search = '') => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão não encontrada.');
      const response = await fetch('/api/clients/protected?search=' + encodeURIComponent(search), {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) throw new Error('Falha ao pesquisar clientes.');
      setClientes(Array.isArray(result.clientes) ? result.clientes : []);
    } catch (err: unknown) {
      console.warn('[Clientes protegidos] Falha ao consultar a vista protegida.');
      setErrorMessage('Não foi possível aceder à vista protegida de clientes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProtectedClients();
  }, [fetchProtectedClients]);

  const filteredClientes = clientes.filter((c) => {
    const q = searchQuery.toLowerCase();
    const digits = searchQuery.replace(/\D/g, '');
    const nome = (c.nome || '').toLowerCase();
    const bi = (c.bi_cc_formatado || '').toLowerCase();
    const nif = (c.nif_formatado || '').toLowerCase();
    if (digits.length > 0) return true; // A API já filtrou pelo NIF completo/parcial.
    return nome.includes(q) || bi.includes(q) || nif.includes(q);
  });

  const submitDocument = async (clientId: string) => {
    if (!documentFile || !documentNumber.trim() || !documentExpiryDate) {
      onShowToast('error', 'Indique o número, a validade e a digitalização do documento.');
      return;
    }
    if (documentFile.size > 6 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(documentFile.type)) {
      onShowToast('error', 'Utilize PDF, JPEG, PNG ou WebP até 6 MB.');
      return;
    }
    setDocumentSaving(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.readAsDataURL(documentFile);
      });
      const token = sessionStorage.getItem('diamante_jwt_token');
      const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/documents`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ tipoDocumento: documentType, numeroDocumento: documentNumber, dataEmissao: documentIssueDate || null, dataValidade: documentExpiryDate, mimeType: documentFile.type, fileName: documentFile.name, fileBase64: base64 }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) throw new Error(result?.message || 'Falha ao actualizar documento.');
      setDocumentClientId(null); setDocumentFile(null); setDocumentNumber(''); setDocumentIssueDate(''); setDocumentExpiryDate('');
      onShowToast('success', 'Documento actualizado. A versão anterior foi preservada no histórico.');
      await fetchProtectedClients(searchQuery);
    } catch (e: any) {
      onShowToast('error', e?.message || 'Não foi possível guardar o documento.');
    } finally { setDocumentSaving(false); }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Clientes Protegidos (RGPD)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 font-semibold">
                  v_clientes_protegidos
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Dados estritamente mascarados de identificação fiscal e contactos
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); void fetchProtectedClients(e.target.value); }}
              placeholder="Pesquisar nome, NIF ou CC..."
              className="w-full pl-9 pr-3 py-2 bg-[#111827] border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        {/* RGPD Compliance Callout */}
        <div className="mt-4 pt-3.5 border-t border-gray-800 flex items-center gap-2 text-[11px] text-gray-400">
          <FileLock className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span>
            Em cumprimento das diretivas europeias de proteção de dados, os identificadores são apresentados com máscara parcial.
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Clients Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-800/40 rounded-xl animate-pulse" />
          ))
        ) : filteredClientes.length === 0 ? (
          <div className="col-span-full bg-[#1F2937] border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
            <UserCheck className="w-10 h-10 mx-auto text-gray-600 mb-2" />
            <p className="text-sm font-semibold text-gray-300">
              {searchQuery ? 'Nenhum cliente correspondente' : 'Sem Registos de Clientes'}
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Os dados de clientes que efetuarem vendas de ouro na loja serão listados aqui em conformidade com o RGPD.
            </p>
          </div>
        ) : (
          filteredClientes.map((cliente, index) => {
            const nomeExibido = cliente.nome || 'Cliente Protegido';
            const biExibido = cliente.bi_cc_formatado || '****';
            const nifExibido = cliente.nif_formatado || 'Não disponível';
            const telExibido = cliente.telemovel || 'Não disponível';

            return (
              <div
                key={cliente.id || index}
                className="bg-[#1F2937] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-[#D4AF37]">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{nomeExibido}</h4>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <CreditCard className="w-3 h-3 text-gray-500" />
                        <span className="font-mono">CC {biExibido} · NIF {nifExibido}</span>
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/40">
                    {Number(cliente.historico_compras_count || 0)} compras
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-1 font-mono text-[11px]"><Phone className="w-3 h-3 text-gray-500" /><span>{telExibido}</span></div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <CalendarClock className="h-3 w-3"/>
                    <span className={cliente.estado_documento==='expirado'?'text-rose-300':cliente.estado_documento==='a_expirar'?'text-amber-300':'text-gray-500'}>
                      {cliente.estado_documento==='expirado'?'Documento expirado':cliente.estado_documento==='a_expirar'?'Documento a expirar':cliente.estado_documento==='valido'?'Documento válido':'Validade não registada'}
                    </span>
                  </div>
                </div>
                {cliente.estado_documento !== 'valido' && (
                  <button type="button" onClick={()=>{setDocumentClientId(documentClientId===cliente.id?null:(cliente.id || null));setDocumentType('cc');setDocumentNumber('');setDocumentIssueDate('');setDocumentExpiryDate('');setDocumentFile(null);}} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/15">
                    <UploadCloud className="h-4 w-4"/> {documentClientId===cliente.id?'Fechar actualização':'Digitalizar / actualizar documento'}
                  </button>
                )}
                {documentClientId===cliente.id && (
                  <div className="space-y-2 rounded-xl border border-amber-400/20 bg-gray-950/50 p-3">
                    <label className="block text-[11px] text-gray-400">Tipo de documento
                      <select value={documentType} onChange={e=>setDocumentType(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-white"><option value="cc">Cartão de Cidadão</option><option value="passaporte">Passaporte</option><option value="cartao_residente">Cartão de Residência</option><option value="outro">Outro</option></select>
                    </label>
                    <label className="block text-[11px] text-gray-400">Número do documento
                      <input value={documentNumber} onChange={e=>setDocumentNumber(e.target.value)} maxLength={80} className="mt-1 h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-white"/>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-gray-400">Emissão<input type="date" value={documentIssueDate} onChange={e=>setDocumentIssueDate(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-white"/></label>
                      <label className="text-[11px] text-gray-400">Validade *<input type="date" min={new Date().toISOString().slice(0,10)} value={documentExpiryDate} onChange={e=>setDocumentExpiryDate(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-white"/></label>
                    </div>
                    <label className="block text-[11px] text-gray-400">Ficheiro PDF/JPEG/PNG/WebP até 6 MB<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setDocumentFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-[10px] text-gray-300"/></label>
                    <button type="button" disabled={documentSaving} onClick={()=>cliente.id && void submitDocument(cliente.id)} className="w-full rounded-lg bg-[#D4AF37] px-3 py-2 text-xs font-bold text-gray-950 disabled:opacity-50">{documentSaving?'A guardar documento…':'Guardar e substituir documento'}</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
