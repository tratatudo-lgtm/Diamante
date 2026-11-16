import React, { useState, useId, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  Sparkles,
  Scale,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Info,
  User,
  CreditCard,
  Phone,
  FileText
} from 'lucide-react';

interface NewPurchaseFormProps {
  onSuccess: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
}

export const NewPurchaseForm: React.FC<NewPurchaseFormProps> = ({ onSuccess, onShowToast }) => {
  const { userSession, funcionario } = useAuth();
  const lojaId = userSession?.loja_id || funcionario?.loja_id || null;

  // Form states
  const [clienteNome, setClienteNome] = useState('');
  const [clienteCc, setClienteCc] = useState('');
  const [clienteTelemovel, setClienteTelemovel] = useState('');
  const [tipoPeca, setTipoPeca] = useState('Anel / Aliança');
  const [metal, setMetal] = useState('Ouro 19.2K (800‰)');
  const [pesoGramas, setPesoGramas] = useState<string>('');
  const [descricao, setDescricao] = useState('');
  const [consentimentoRgpd, setConsentimentoRgpd] = useState(false);

  // Spot calculation configuration
  // Cotação Spot base: ~59.50 €/g para Ouro 19.2k português, ~74.00 €/g para 24k
  const [spotPrice, setSpotPrice] = useState<number>(59.50);
  const [margemPercent, setMargemPercent] = useState<number>(12);
  const [valorFinalManual, setValorFinalManual] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [purchaseSettings, setPurchaseSettings] = useState<Array<{ toque_millesimos: number; cotacao_referencia_g: number; margem_percentagem: number; preco_compra_grama: number; desconto_maximo_loja_perc: number; cotacao_origem: string; cotacao_moeda: string; cotacao_unidade: string; cotacao_observada_em: string }>>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Unique IDs for accessibility
  const clienteNomeId = useId();
  const clienteCcId = useId();
  const clienteTelemovelId = useId();
  const metalId = useId();
  const tipoPecaId = useId();
  const pesoGramasId = useId();
  const descricaoId = useId();
  const rgpdCheckboxId = useId();
  const valorFinalId = useId();

  // Carregar exclusivamente preços aprovados pela sede para esta loja.
  useEffect(() => {
    let active = true;
    const loadPurchaseSettings = async () => {
      try {
        const token = sessionStorage.getItem('diamante_jwt_token');
        if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');
        const response = await fetch('/api/store/purchase-settings', {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.margens)) {
          throw new Error(data?.message || 'Não foi possível carregar os preços aprovados pela sede.');
        }
        if (active) {
          setPurchaseSettings(data.margens);
          setSettingsError(null);
        }
      } catch (error: any) {
        if (active) setSettingsError(error?.message || 'Parâmetros de compra indisponíveis.');
      } finally {
        if (active) setSettingsLoading(false);
      }
    };
    loadPurchaseSettings();
    return () => { active = false; };
  }, []);

  const getToque = (value: string) => Number(value.match(/(\d{3})\s*‰/)?.[1] || 0);
  const selectedPricing = purchaseSettings.find((item) => item.toque_millesimos === getToque(metal));
  const handleMetalChange = (novoMetal: string) => {
    setMetal(novoMetal);
    const pricing = purchaseSettings.find((item) => item.toque_millesimos === getToque(novoMetal));
    if (pricing) {
      setSpotPrice(pricing.cotacao_referencia_g);
      setMargemPercent(pricing.margem_percentagem);
    } else {
      setSpotPrice(0);
      setMargemPercent(0);
    }
  };

  useEffect(() => {
    if (selectedPricing) {
      setSpotPrice(selectedPricing.cotacao_referencia_g);
      setMargemPercent(selectedPricing.margem_percentagem);
    } else if (!settingsLoading) {
      setSpotPrice(0);
      setMargemPercent(0);
    }
  }, [selectedPricing, settingsLoading]);

  // Cálculo automático: Valor Sugerido = (peso * cotacao_spot * (1 - margem/100))
  const pesoNum = parseFloat(pesoGramas) || 0;
  const valorSugerido = pesoNum > 0 && selectedPricing
    ? Math.max(0, pesoNum * selectedPricing.preco_compra_grama)
    : 0;

  // Valor a aplicar: ou o manual se fornecido, ou o sugerido
  const valorFinalEfetivo = valorFinalManual !== ''
    ? parseFloat(valorFinalManual) || 0
    : valorSugerido;
  const cotacaoObservadaLabel = selectedPricing?.cotacao_observada_em
    ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(selectedPricing.cotacao_observada_em))
    : 'Sem cotação de hoje';
  const valorMaximoAutorizado = valorSugerido;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!lojaId) {
      setErrorMessage('A sua conta não tem uma loja associada para registar compras.');
      return;
    }

    if (!clienteNome.trim()) {
      setErrorMessage('Por favor introduza o nome completo do cliente.');
      return;
    }

    if (!clienteCc.trim()) {
      setErrorMessage('O Cartão de Cidadão / BI é obrigatório por lei para compra de metais.');
      return;
    }

    if (!selectedPricing || settingsLoading || settingsError) {
      setErrorMessage('Não existe uma cotação activa aprovada pela sede para este metal e loja. Contacte a administração.');
      return;
    }

    if (pesoNum <= 0) {
      setErrorMessage('Introduza um peso em gramas válido superior a zero.');
      return;
    }

    if (valorFinalEfetivo <= 0) {
      setErrorMessage('O valor final da transação tem de ser superior a 0,00 €.');
      return;
    }

    if (Number(valorFinalEfetivo.toFixed(2)) > valorMaximoAutorizado) {
      setErrorMessage(`O valor acordado excede o limite autorizado de ${valorMaximoAutorizado.toFixed(2)} €. A margem aprovada pela sede não pode ser reduzida na negociação.`);
      return;
    }

    if (!consentimentoRgpd) {
      setErrorMessage('O consentimento RGPD assinado pelo cliente é obrigatório.');
      return;
    }

    setIsSubmitting(true);

    try {
      // A transação é criada exclusivamente pela API protegida.
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');

      const purchasePayload = {
        clienteNome: clienteNome.trim(),
        clienteCc: clienteCc.trim(),
        clienteTelemovel: clienteTelemovel.trim() || null,
        tipoPeca,
        metal,
        pesoGramas: pesoNum,
        valorFinal: parseFloat(valorFinalEfetivo.toFixed(2)),
        valorSugerido: parseFloat(valorSugerido.toFixed(2)),
        cotacaoSpot: spotPrice,
        margemPercent,
        descricao: descricao.trim() || `${tipoPeca} em ${metal}`,
      };
      // Persist only a hash and the retry key; never persist customer data in browser storage.
      const fingerprintBytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(purchasePayload))
      );
      const fingerprint = Array.from(new Uint8Array(fingerprintBytes))
        .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const retryStorageKey = 'diamante_purchase_retry_v1';
      let retryState: { key?: string; fingerprint?: string } = {};
      try {
        retryState = JSON.parse(sessionStorage.getItem(retryStorageKey) || '{}');
      } catch {
        retryState = {};
      }
      const idempotencyKey = retryState.fingerprint === fingerprint &&
        typeof retryState.key === 'string' && /^[0-9a-f-]{36}$/i.test(retryState.key)
        ? retryState.key
        : crypto.randomUUID();
      sessionStorage.setItem(retryStorageKey, JSON.stringify({ key: idempotencyKey, fingerprint }));
      const txResponse = await fetch('/api/store/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...purchasePayload, idempotencyKey }),
      });
      const txResult = await txResponse.json().catch(() => null);
      if (txResult?.partial) {
        const partialMessage = txResult.message || 'A transação foi criada, mas o inventário não ficou registado. Não repita a compra; contacte a sede.';
        setErrorMessage(partialMessage);
        onShowToast('error', partialMessage);
        return;
      }
      if (!txResponse.ok || !txResult?.success) {
        throw new Error(txResult?.message || 'Não foi possível registar a transação.');
      }
      const novaTransacao = txResult.transacao;
      if (!novaTransacao?.id) throw new Error('A API não devolveu o identificador da transação.');

      // O endpoint protegido também cria o registo de inventário físico.

      // 3. Toast: "Compra registada! Aguarda aprovação."
      onShowToast(
        'success',
        `Compra de ${pesoNum.toFixed(2)}g (${valorFinalEfetivo.toFixed(2)} €) registada com sucesso! Aguarda aprovação da sede para transferência.`,
        'Compra Registada'
      );

      // Limpar formulário
      sessionStorage.removeItem('diamante_purchase_retry_v1');
      setClienteNome('');
      setClienteCc('');
      setClienteTelemovel('');
      setPesoGramas('');
      setDescricao('');
      setValorFinalManual('');
      setConsentimentoRgpd(false);

      onSuccess();
    } catch (err: unknown) {
      console.warn('[Compra] Falha ao registar nova compra.');
      const msg = 'Não foi possível registar a compra. Tente novamente.';
      setErrorMessage(msg);
      onShowToast('error', 'Falha ao gravar transação na base de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24">
      {/* Header Form */}
      <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Nova Compra de Ouro</h2>
            <p className="text-xs text-gray-400">
              Compra calculada sobre a cotação diária do ouro fino aprovada pela sede
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/70 border border-red-700/60 text-red-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {selectedPricing && (
        <div className="max-w-2xl mx-auto rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-gray-300">
          <div className="flex flex-wrap justify-between gap-2">
            <span>Cotação de ouro fino: <strong className="text-white">{formatCurrency(selectedPricing.cotacao_referencia_g)}/g</strong></span>
            <span>Margem sede: <strong className="text-[#D4AF37]">{selectedPricing.margem_percentagem}%</strong></span>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">Referência manual da sede · Última actualização: {cotacaoObservadaLabel}. Só são aceites cotações registadas hoje.</p>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-[#1F2937] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* SECÇÃO 1: DADOS DO CLIENTE (OBRIGATÓRIO POR LEI) */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-800">
            <User className="w-3.5 h-3.5" />
            1. Identificação do Vendedor / Cliente
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome Completo */}
            <div className="sm:col-span-2">
              <label htmlFor={clienteNomeId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Nome Completo do Cliente *
              </label>
              <div className="relative">
                <input
                  id={clienteNomeId}
                  type="text"
                  required
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="ex: Maria Inês Santos Ferreira"
                  className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            {/* CC / BI */}
            <div>
              <label htmlFor={clienteCcId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Cartão de Cidadão / BI *
              </label>
              <div className="relative">
                <input
                  id={clienteCcId}
                  type="text"
                  required
                  value={clienteCc}
                  onChange={(e) => setClienteCc(e.target.value)}
                  placeholder="ex: 12345678 9 ZZ0"
                  className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white font-mono text-xs placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            {/* Telemóvel */}
            <div>
              <label htmlFor={clienteTelemovelId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Telemóvel (Contacto)
              </label>
              <div className="relative">
                <input
                  id={clienteTelemovelId}
                  type="tel"
                  value={clienteTelemovel}
                  onChange={(e) => setClienteTelemovel(e.target.value)}
                  placeholder="ex: 912 345 678"
                  className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white font-mono text-xs placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECÇÃO 2: DADOS DA PEÇA & PESAGEM */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-800">
            <Scale className="w-3.5 h-3.5" />
            2. Classificação do Metal & Balança
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo de Peça */}
            <div>
              <label htmlFor={tipoPecaId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Tipo de Peça
              </label>
              <select
                id={tipoPecaId}
                value={tipoPeca}
                onChange={(e) => setTipoPeca(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="Anel / Aliança">Anel / Aliança</option>
                <option value="Colar / Corrente">Colar / Corrente</option>
                <option value="Pulseira / Bracelete">Pulseira / Bracelete</option>
                <option value="Brincos (Par/Avulso)">Brincos (Par/Avulso)</option>
                <option value="Moeda / Barra">Moeda / Barra de Ouro</option>
                <option value="Relógio em Ouro">Relógio em Ouro</option>
                <option value="Lote / Restos">Lote Diversos / Restos</option>
              </select>
            </div>

            {/* Metal & Toque */}
            <div>
              <label htmlFor={metalId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Liga / Metal
              </label>
              <select
                id={metalId}
                value={metal}
                onChange={(e) => handleMetalChange(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="Ouro 19.2K (800‰)">Ouro 19.2K (800‰ - Português)</option>
                <option value="Ouro 24K (999‰)">Ouro 24K (999‰ - Puro)</option>
                <option value="Ouro 18K (750‰)">Ouro 18K (750‰)</option>
                <option value="Ouro 14K (585‰)">Ouro 14K (585‰)</option>
                <option value="Prata 925">Prata 925</option>
              </select>
            </div>

            {/* Peso em Gramas */}
            <div>
              <label htmlFor={pesoGramasId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Peso Certificado (Balança) *
              </label>
              <div className="relative">
                <input
                  id={pesoGramasId}
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={pesoGramas}
                  onChange={(e) => setPesoGramas(e.target.value)}
                  placeholder="ex: 14.85"
                  className="w-full min-h-[48px] pl-3.5 pr-14 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-[#D4AF37]"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400">
                  gramas
                </span>
              </div>
            </div>

            {/* Descrição Adicional */}
            <div>
              <label htmlFor={descricaoId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Notas / Contrastaria
              </label>
              <input
                id={descricaoId}
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="ex: Marca Cabeça de Veado, bom estado"
                className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>
        </div>

        {/* SECÇÃO 3: CÁLCULO AUTOMÁTICO SPOT & VALOR SUGERIDO */}
        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-[#D4AF37]" />
              Cálculo Automático de Avaliação
            </span>
            <span className="text-[11px] text-gray-400 font-mono">
              {settingsLoading ? 'A carregar preços aprovados…' : selectedPricing ? `Cotação sede: ${spotPrice.toFixed(2)} €/g fino · Margem: ${margemPercent}%` : 'Sem preço aprovado para este metal'}
            </span>
          </div>

          <p className={`text-[11px] leading-relaxed rounded-lg px-3 py-2 border ${selectedPricing ? 'text-emerald-200/80 bg-emerald-950/30 border-emerald-900/50' : 'text-amber-200/80 bg-amber-950/30 border-amber-900/50'}`}>{settingsLoading ? 'A consultar os parâmetros comerciais aprovados pela sede.' : selectedPricing ? 'Preço calculado com os parâmetros aprovados pela sede. A cotação de referência não é uma cotação de mercado em tempo real.' : settingsError || 'Este metal não tem configuração activa. Não é possível registar a compra.'}</p>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-lg bg-gray-950/60 border border-gray-800">
              <span className="text-[11px] text-gray-400">Fórmula de Avaliação:</span>
              <p className="font-mono text-gray-300 text-[11px] mt-0.5">
                {pesoNum > 0 ? `${pesoNum.toFixed(2)}g × ${spotPrice.toFixed(2)}€ × (1 - ${margemPercent / 100})` : 'Aguardando peso...'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/40 border border-[#D4AF37]/30 text-right">
              <span className="text-[11px] text-gray-400">Valor Sugerido:</span>
              <p className="font-mono font-bold text-lg text-[#D4AF37] tabular-nums mt-0.5">
                {formatCurrency(valorSugerido)}
              </p>
            </div>
          </div>

          {/* Ajuste manual do valor final acordado */}
          <div className="pt-2">
            <label htmlFor={valorFinalId} className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Valor Acordado com Cliente (€)
            </label>
            <div className="relative">
              <input
                id={valorFinalId}
                type="number"
                step="0.01"
                min="0.01"
                value={valorFinalManual !== '' ? valorFinalManual : (valorSugerido > 0 ? valorSugerido.toFixed(2) : '')}
                onChange={(e) => setValorFinalManual(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[48px] pl-3.5 pr-14 py-2.5 bg-[#111827] border border-[#D4AF37]/50 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[#D4AF37]">
                EUR (€)
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Limite autorizado pela sede: <span className="font-mono font-semibold text-[#D4AF37]">{formatCurrency(valorMaximoAutorizado)}</span>
              <span className="ml-1">({flexibilidadeLoja.toFixed(2)}% de flexibilidade sobre o valor sugerido)</span>
            </p>
          </div>

          {pesoNum > 0 && valorFinalEfetivo > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                <span className="text-[11px] text-gray-400">Custo efectivo por grama</span>
                <p className="mt-1 font-mono text-sm font-bold text-white tabular-nums">
                  {formatCurrency(valorFinalEfetivo / pesoNum)} <span className="text-[10px] font-normal text-gray-400">/ g</span>
                </p>
              </div>
              <div className={`rounded-lg border p-3 ${valorFinalEfetivo <= valorSugerido ? 'border-emerald-900/60 bg-emerald-950/20' : 'border-amber-900/60 bg-amber-950/20'}`}>
                <span className="text-[11px] text-gray-400">Diferença face à sugestão</span>
                <p className={`mt-1 font-mono text-sm font-bold tabular-nums ${valorFinalEfetivo <= valorSugerido ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {valorFinalEfetivo - valorSugerido > 0 ? '+' : ''}{formatCurrency(valorFinalEfetivo - valorSugerido)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SECÇÃO 4: CHECKBOX OBRIGATÓRIO RGPD */}
        <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800">
          <label htmlFor={rgpdCheckboxId} className="flex items-start gap-3 cursor-pointer">
            <input
              id={rgpdCheckboxId}
              type="checkbox"
              required
              checked={consentimentoRgpd}
              onChange={(e) => setConsentimentoRgpd(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-700 text-[#D4AF37] focus:ring-[#D4AF37] bg-gray-900 cursor-pointer"
            />
            <div className="text-xs text-gray-300">
              <span className="font-semibold text-white">Consentimento RGPD obtido *</span>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                Confirmo que o cliente assinou presencialmente a declaração de venda legal e o consentimento de tratamento de dados pessoais nos termos da legislação aplicável.
              </p>
            </div>
          </label>
        </div>

        {/* BOTÃO REGISTAR COMPRA (Hitbox 48px+, Dourado) */}
        <button
          type="submit"
          disabled={isSubmitting || settingsLoading || !selectedPricing || Boolean(settingsError)}
          className="w-full min-h-[52px] bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:from-[#e5be40] hover:to-[#d4af37] text-gray-950 font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>A registar e gerar inventário físico...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Registar Compra ({formatCurrency(valorFinalEfetivo)})</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
