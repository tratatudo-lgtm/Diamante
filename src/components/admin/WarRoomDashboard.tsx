import React, { useState, useEffect, useCallback } from 'react';
import { Coins, ClockAlert, Scale, Building2, RefreshCw, AlertTriangle } from 'lucide-react';

const SafeKPICard = ({ title, value, icon, variant = 'default', subtext }: any) => (
  <div className={`bg-[#151b2b] rounded-xl p-5 border transition-all hover:scale-[1.02] active:scale-[0.98] ${
    variant === 'warning' ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-[#D4AF37]/20'
  }`}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">{title}</span>
      <div className={`p-2 rounded-lg ${variant === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-[#D4AF37]/10 text-[#D4AF37]'}`}>
        {icon}
      </div>
    </div>
    <div className="text-2xl font-bold text-white mb-1">{value || '---'}</div>
    {subtext && <div className="text-xs text-slate-500">{subtext}</div>}
  </div>
);

export const WarRoomDashboard = () => {
  const [kpis, setKpis] = useState({ volume: 0, pendentes: 0, peso: 0, lojasAtivas: 0, totalLojas: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string>('');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [authorizing, setAuthorizing] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [businessKpis, setBusinessKpis] = useState<{active:number;estimatedMonthly:number;initialInvestment:number;estimatedResult:number}>({active:0,estimatedMonthly:0,initialInvestment:0,estimatedResult:0});

  const fetchKpis = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão administrativa expirada. Volte a iniciar sessão.');
      const res = await fetch(`/api/v1/admin/dashboard/kpis?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        signal: AbortSignal.timeout(10000),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Servidor devolveu ${res.status} (${contentType}). Resposta: ${text.substring(0, 100)}`);
      }
      
      const data = await res.json();
      if (!res.ok || !data || typeof data !== 'object' || data.totalLojas === undefined) throw new Error(data?.error || 'Não foi possível carregar os indicadores.');
      setKpis(data);
      try {
        const expansionRes = await fetch('/api/admin/expansion-sites', {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        const expansionData = await expansionRes.json().catch(() => null);
        if (expansionRes.ok && expansionData?.success === true && Array.isArray(expansionData.sites)) {
          const activeSites = expansionData.sites.filter((site: any) => !['rejeitado', 'arquivado'].includes(site.status));
          setBusinessKpis({
            active: activeSites.length,
            estimatedMonthly: activeSites.reduce((sum: number, site: any) => sum + Math.max(0, Number(site.estimated_monthly_revenue) || 0), 0),
            initialInvestment: activeSites.reduce((sum: number, site: any) => sum + (Number(site.estimated_setup_cost) || 0) + (Number(site.estimated_initial_stock) || 0), 0),
            estimatedResult: activeSites.reduce((sum: number, site: any) => sum + (Number(site.estimated_monthly_revenue) || 0) - (Number(site.monthly_rent) || 0) - (Number(site.estimated_monthly_other_costs) || 0) - (Number(site.estimated_monthly_staff_cost) || 0) - (Number(site.estimated_monthly_utilities_cost) || 0), 0),
          });
        }
      } catch (expansionError) {
        console.warn('[WarRoom] Indicadores de expansão indisponíveis.', expansionError);
      }
      setLastUpdate(new Date());
      setDebugMsg('✅ Dados carregados com sucesso!');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WarRoom] Erro:', msg);
      setError(msg);
      setDebugMsg(`❌ Erro: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  
  // Carregar lista de pendentes
  const loadPendingTransactions = async () => {
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão administrativa expirada. Volte a iniciar sessão.');
      const res = await fetch(`/api/v1/admin/dashboard/pending?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success !== true || !Array.isArray(data.data)) throw new Error(data?.error || 'Não foi possível carregar as transacções pendentes.');
      setPendingList(data.data);
      setShowPendingModal(true);
    } catch(e) {
      console.error('Erro ao carregar pendentes:', e);
      setDebugMsg('❌ Erro ao carregar pendentes');
    }
  };

  // Autorizar transação específica
  const authorizeTransaction = async (id: string) => {
    setAuthorizing(id);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão administrativa expirada. Volte a iniciar sessão.');
      const res = await fetch('/api/v1/admin/dashboard/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionId: id }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success !== true) throw new Error(data?.error || 'Não foi possível aprovar a transacção.');
      setDebugMsg('Transacção aprovada.');
      await Promise.all([loadPendingTransactions(), fetchKpis()]);
    } catch(e: any) {
      setDebugMsg(`❌ Erro na autorização: ${e.message}`);
    } finally {
      setAuthorizing(null);
    }
  };

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 30000);
    return () => clearInterval(interval);
  }, [fetchKpis]);

  if (error && !kpis.volume && !kpis.pendentes) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-amber-500" />
        <h2 className="text-2xl font-bold text-[#D4AF37]">Sala de Guerra Indisponível</h2>
        <p className="text-slate-400 max-w-md text-sm break-words">{error}</p>
        {debugMsg && <p className="text-xs font-mono text-slate-500 bg-black/30 p-2 rounded">{debugMsg}</p>}
        <button onClick={fetchKpis} disabled={isLoading} className="px-6 py-3 bg-[#D4AF37] text-black font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50">
          {isLoading ? 'A carregar...' : 'Tentar Novamente'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-3">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            SALA DE GUERRA • TEMPO REAL
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-PT')}
            {isLoading && ' • Atualizando...'}
          </p>
        </div>
        <button onClick={fetchKpis} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] rounded-lg transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Debug Visual (apenas em desenvolvimento/erro) */}
      {debugMsg && (
        <div className="bg-black/40 border border-slate-700 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
          {debugMsg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SafeKPICard title="VOLUME COMPRAS HOJE" value={`${(kpis.volume || 0).toFixed(2)} €`} icon={<Coins className="w-5 h-5" />} subtext="Primeiro registo do dia" />
        <div 
        onClick={() => (kpis.pendentes || 0) > 0 && loadPendingTransactions()} 
        className={`cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.97] ${(kpis.pendentes || 0) === 0 ? 'opacity-60 cursor-default' : ''}`}
      >
        <SafeKPICard 
          title="PENDENTES APROVAÇÃO" 
          value={(kpis.pendentes || 0).toString()} 
          icon={<ClockAlert className="w-5 h-5" />} 
          variant={(kpis.pendentes || 0) > 0 ? 'warning' : 'default'} 
          subtext={(kpis.pendentes || 0) > 0 ? 'Toque para gerir →' : 'Sem pendentes'} 
        />
      </div>
        <SafeKPICard title="PESO TOTAL DA REDE" value={`${(kpis.peso || 0).toFixed(1)} g`} icon={<Scale className="w-5 h-5" />} subtext="Ouro comprado hoje" />
        <SafeKPICard title="LOJAS ACTIVAS" value={`${kpis.lojasAtivas || 0} / ${kpis.totalLojas || 0}`} icon={<Building2 className="w-5 h-5" />} subtext="Lojas activas registadas" />
      </div>

      {/* Placeholders para Mapa e Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#151b2b] rounded-xl p-5 border border-[#D4AF37]/20 min-h-[300px] flex flex-col items-center justify-center text-center">
          <p className="text-[#D4AF37] font-bold text-lg">Mapa de Calor da Rede</p>
          <div className="mt-4 grid w-full grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">Estudos activos</p><p className="mt-1 text-xl font-semibold text-white">{businessKpis.active}</p></div>
            <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">Receita mensal potencial</p><p className="mt-1 text-xl font-semibold text-white">{businessKpis.estimatedMonthly.toLocaleString('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0})}</p></div>
            <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">Investimento inicial</p><p className="mt-1 text-xl font-semibold text-white">{businessKpis.initialInvestment.toLocaleString('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0})}</p></div>
            <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">Resultado mensal estimado</p><p className="mt-1 text-xl font-semibold text-white">{businessKpis.estimatedResult.toLocaleString('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0})}</p></div>
          </div>
        </div>
        <div className="bg-[#151b2b] rounded-xl p-5 border border-[#D4AF37]/20 min-h-[300px] flex flex-col items-center justify-center text-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mb-3"></div>
          <p className="text-[#D4AF37] font-bold text-lg">Feed Realtime</p>
          <p className="text-sm text-slate-500 mt-2">Transações em tempo real</p>
        </div>
      </div>
    
      {/* MODAL DE GESTÃO DE PENDENTES */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPendingModal(false)}>
          <div className="bg-[#151b2b] border border-[#D4AF37]/30 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[#D4AF37]/20 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                <ClockAlert className="w-5 h-5" />
                Pendentes ({pendingList.length})
              </h3>
              <button onClick={() => setShowPendingModal(false)} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
              {pendingList.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Nenhuma transação pendente.</div>
              ) : (
                pendingList.map((t: any) => (
                  <div key={t.id} className="bg-[#0b0f19] border border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm text-slate-400">Loja: {t.loja_id?.substring(0,8) || 'N/A'}</div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(t.created_at).toLocaleString('pt-PT')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">{Number(t.valor_total || 0).toFixed(2)} €</div>
                        <div className="text-xs text-[#D4AF37]">{Number(t.peso_ouro || 0).toFixed(1)} g</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => authorizeTransaction(t.id)}
                      disabled={authorizing === t.id}
                      className="w-full py-3 bg-[#D4AF37] hover:bg-amber-400 text-black font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {authorizing === t.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                          A autorizar...
                        </>
                      ) : (
                        <>✓ Autorizar Transferência</>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
</div>
  );
};