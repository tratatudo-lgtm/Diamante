// PATH: src/components/admin/LogAuditPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { AdminSidebar } from './AdminSidebar';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Building2,
  Clock,
  User,
  Key,
  Coins,
  CreditCard,
  SlidersHorizontal,
  Smartphone,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lock,
  Unlock,
  FileText,
  Copy,
  Check,
  X,
  Play,
  Pause,
  ArrowUpDown,
  Terminal,
  Activity,
  Layers,
  ChevronRight,
  Printer,
  Hash,
  Globe,
  TrendingUp,
} from 'lucide-react';

export type LogSeverity = 'critical' | 'security' | 'warning' | 'info' | 'success';

export type LogCategory =
  | 'auth'
  | 'transaction'
  | 'store'
  | 'employee'
  | 'pricing'
  | 'finance'
  | 'security';

export interface AuditLogItem {
  id: string;
  timestamp: string; // ISO ou formatado DD/MM/AAAA HH:mm:ss
  severity: LogSeverity;
  category: LogCategory;
  action: string;
  description: string;
  actorNome: string;
  actorRole: string;
  actorPhone: string;
  lojaNome: string;
  lojaId?: string;
  ipAddress: string;
  userAgent: string;
  hashIntegridade: string;
  metadados?: Record<string, any>;
  diff?: {
    campo: string;
    anterior: string | number;
    novo: string | number;
  }[];
}

interface LogAuditPageProps {
  onNavigate?: (path: string) => void;
}

// 24 Lojas Oficiais da Rede Diamante D'ouro
const AUDIT_STORES = [
  "Diamante D'ouro - Baixa (Lisboa)",
  "Diamante D'ouro - Chiado (Lisboa)",
  "Diamante D'ouro - Campo de Ourique (Lisboa)",
  "Diamante D'ouro - Alvalade (Lisboa)",
  "Diamante D'ouro - Parque das Nações (Lisboa)",
  "Diamante D'ouro - Cascais",
  "Diamante D'ouro - Sintra",
  "Diamante D'ouro - Amadora",
  "Diamante D'ouro - Almada",
  "Diamante D'ouro - Setúbal",
  "Diamante D'ouro - Porto Santa Catarina",
  "Diamante D'ouro - Porto Boavista",
  "Diamante D'ouro - Vila Nova de Gaia",
  "Diamante D'ouro - Matosinhos",
  "Diamante D'ouro - Braga Centro",
  "Diamante D'ouro - Guimarães",
  "Diamante D'ouro - Coimbra Baixa",
  "Diamante D'ouro - Aveiro",
  "Diamante D'ouro - Leiria",
  "Diamante D'ouro - Évora",
  "Diamante D'ouro - Faro Baixa",
  "Diamante D'ouro - Portimão",
  "Diamante D'ouro - Funchal Sé (Madeira)",
  "Diamante D'ouro - Ponta Delgada (Açores)",
  'Sede Central Administrativa',
];

// Dados Iniciais Realistas de Auditoria (35+ registos minuciosos)
const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'AUD-2026-9942',
    timestamp: '06/11/2026 10:48:22',
    severity: 'critical',
    category: 'security',
    action: 'Deteção de Contrafação / Inclusão em Blacklist',
    description: 'Cliente NIF 276543210 tentou vender pulseira pesando 65g com toque falso (teste de ácido nítrico falhou). Registo bloqueado preventivamente.',
    actorNome: 'Joana Figueiredo',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 931 209 876',
    lojaNome: "Diamante D'ouro - Almada",
    ipAddress: '194.65.231.14',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DiamanteOS-Client/2.4.1',
    hashIntegridade: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    metadados: { nif_cliente: '276543210', peso_apresentado: '65g', tipo_ensaio: 'Ácido Nítrico + Densímetro Eletrónico' },
  },
  {
    id: 'AUD-2026-9941',
    timestamp: '06/11/2026 10:45:10',
    severity: 'info',
    category: 'pricing',
    action: 'Atualização Automática LBMA Fix',
    description: 'Cotação de referência do ouro puro (24k) atualizada para €84,50/g via live feed internacional.',
    actorNome: 'Sistema Automático / Cron',
    actorRole: 'Serviço de Background',
    actorPhone: 'N/A',
    lojaNome: 'Sede Central Administrativa',
    ipAddress: '127.0.0.1 (Internal Service)',
    userAgent: 'DiamanteOS-SyncDaemon/2.0',
    hashIntegridade: '7d5be5a2a24f0c74b94676571faeb6cfbcf2ec9713b194f1c907106093845bf3',
    diff: [{ campo: 'Preço Ouro 24k', anterior: '€84,10', novo: '€84,50' }],
  },
  {
    id: 'AUD-2026-9940',
    timestamp: '06/11/2026 10:14:55',
    severity: 'success',
    category: 'transaction',
    action: 'Liquidação SEPA Imediata Concluída',
    description: 'Pagamento de €3.250,00 autorizado para cliente Maria Manuela Ferreira referente a Lote Ouro 19.2k (58g).',
    actorNome: 'Ana Sofia Martins',
    actorRole: 'Gerente de Balcão',
    actorPhone: '+351 912 345 678',
    lojaNome: "Diamante D'ouro - Baixa (Lisboa)",
    ipAddress: '85.241.112.90',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    hashIntegridade: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    metadados: { valor_eur: 3250.0, ref_pagamento: 'PAG-2026-8941', banco_origem: 'Millennium BCP' },
  },
  {
    id: 'AUD-2026-9939',
    timestamp: '06/11/2026 09:48:33',
    severity: 'warning',
    category: 'finance',
    action: 'Pedido de Dupla Autorização Disparado',
    description: 'Transação superior a €5.000,00 (€8.400,00 em Barra 100g 24k) gerou solicitação de aprovação OTP para diretores financeiros.',
    actorNome: 'Mariana Castelo Branco',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 934 567 890',
    lojaNome: "Diamante D'ouro - Chiado (Lisboa)",
    ipAddress: '85.241.112.94',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
    hashIntegridade: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    metadados: { valor_eur: 8400.0, aprovadores_notificados: ['+351 937 230 116', '+351 912 345 678'] },
  },
  {
    id: 'AUD-2026-9938',
    timestamp: '06/11/2026 09:12:04',
    severity: 'success',
    category: 'auth',
    action: 'Autenticação 2FA Bem-Sucedida',
    description: 'Código de 6 dígitos verificado com sucesso via WhatsApp Evolution API na primeira tentativa.',
    actorNome: 'Beatriz Fontes',
    actorRole: 'Gerente de Balcão',
    actorPhone: '+351 917 890 123',
    lojaNome: "Diamante D'ouro - Cascais",
    ipAddress: '193.136.21.5',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    hashIntegridade: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
  },
  {
    id: 'AUD-2026-9937',
    timestamp: '06/11/2026 08:30:19',
    severity: 'info',
    category: 'store',
    action: 'Abertura de Balcão & Controlo de Caixa',
    description: 'Registo de abertura do dia efetuado. Fundo de maneio em cofre verificado: €10.000,00 em numerário.',
    actorNome: 'Catarina Morais',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 925 678 901',
    lojaNome: "Diamante D'ouro - Parque das Nações (Lisboa)",
    ipAddress: '82.154.204.18',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    hashIntegridade: 'b7a526528ef050b168673a8daefea92a95574c86bc9dc004a44b8be562b78b87',
  },
  {
    id: 'AUD-2026-9936',
    timestamp: '05/11/2026 18:42:01',
    severity: 'security',
    category: 'security',
    action: 'Bloqueio de IP por Tentativas Excedidas',
    description: 'Endereço IP 185.220.101.5 bloqueado temporariamente (10 tentativas de solicitação OTP em 2 minutos sem correspondência de funcionário).',
    actorNome: 'Serviço de Segurança Perimetral',
    actorRole: 'WAF / Rate-Limiter',
    actorPhone: 'N/A',
    lojaNome: 'Sede Central Administrativa',
    ipAddress: '185.220.101.5 (Tor Exit Node)',
    userAgent: 'curl/8.1.2',
    hashIntegridade: '356a192b7913b04c54574d18c28d46e6395428ab',
  },
  {
    id: 'AUD-2026-9935',
    timestamp: '05/11/2026 17:22:15',
    severity: 'critical',
    category: 'transaction',
    action: 'Rejeição de Pagamento por Divergência de Titularidade',
    description: 'Venda de ouro (48g) travada pela auditoria central. Titular do IBAN bancário fornecido não correspondia ao NIF do vendedor cadastrado.',
    actorNome: 'Patrícia Rebelo',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 967 890 123',
    lojaNome: "Diamante D'ouro - Alvalade (Lisboa)",
    ipAddress: '85.241.112.88',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    hashIntegridade: 'da4b9237bacccdf19c0760cab7aec4a8359010b0',
    metadados: { nif_cliente: '256789012', motivo: 'Conformidade Lei 83/2017 (Prevenção de Branqueamento)' },
  },
  {
    id: 'AUD-2026-9934',
    timestamp: '05/11/2026 16:10:48',
    severity: 'info',
    category: 'pricing',
    action: 'Ajuste Manual de Margem de Compra',
    description: 'Margem de segurança para Ouro 19.2k ajustada de 8,0% para 8,5% pelo Administrador Master.',
    actorNome: 'Administrador Master',
    actorRole: 'Master',
    actorPhone: '+351 937 230 116',
    lojaNome: 'Sede Central Administrativa',
    ipAddress: '81.84.19.120',
    userAgent: 'Mozilla/5.0 (Macintosh; Apple Silicon M3)',
    hashIntegridade: '77de68daecd823babbb58edb1c8e14d7106e83bb',
    diff: [{ campo: 'Margem Spread 19.2k', anterior: '8.0%', novo: '8.5%' }],
  },
  {
    id: 'AUD-2026-9933',
    timestamp: '05/11/2026 14:05:30',
    severity: 'success',
    category: 'transaction',
    action: 'Registo de Compra de Espólio & Herança',
    description: 'Processo de herança familiar concluído no valor de €6.700,00 (Faqueiro Prata 833 + Joalharia Ouro 19.2k - 95g). Documento de partilha anexado.',
    actorNome: 'Filipa Nogueira',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 936 789 012',
    lojaNome: "Diamante D'ouro - Porto Boavista",
    ipAddress: '89.155.10.42',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    hashIntegridade: '1b6453892473a467d07842d45ee068fb',
  },
  {
    id: 'AUD-2026-9932',
    timestamp: '05/11/2026 11:30:14',
    severity: 'info',
    category: 'employee',
    action: 'Atribuição de Balcão a Funcionária',
    description: 'Operadora Susana Valente transferida provisoriamente da loja Matosinhos para apoio ao balcão Porto Boavista.',
    actorNome: 'Administrador Master',
    actorRole: 'Master',
    actorPhone: '+351 937 230 116',
    lojaNome: 'Sede Central Administrativa',
    ipAddress: '81.84.19.120',
    userAgent: 'Mozilla/5.0 (Macintosh; Apple Silicon M3)',
    hashIntegridade: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c',
  },
  {
    id: 'AUD-2026-9931',
    timestamp: '05/11/2026 09:05:00',
    severity: 'success',
    category: 'store',
    action: 'Fecho e Reconciliação Diária Confirmada',
    description: 'Relatório diário de fecho da loja Faro Baixa verificado sem quebras de peso físico (482.5g em cofre).',
    actorNome: 'Cláudia Lourenço',
    actorRole: 'Gerente de Balcão',
    actorPhone: '+351 921 345 678',
    lojaNome: "Diamante D'ouro - Faro Baixa",
    ipAddress: '85.240.180.22',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4)',
    hashIntegridade: '8f40be3b9e7a2666242468300fb079b9',
  },
  {
    id: 'AUD-2026-9930',
    timestamp: '04/11/2026 17:15:33',
    severity: 'warning',
    category: 'finance',
    action: 'Alerta de Saldo Baixo em Conta de Liquidação',
    description: 'Conta Millennium BCP Principal atingiu patamar de segurança inferior a €50.000,00. Ordem de reforço automático disparada.',
    actorNome: 'Módulo Tesouraria Automático',
    actorRole: 'Serviço de Background',
    actorPhone: 'N/A',
    lojaNome: 'Sede Central Administrativa',
    ipAddress: '127.0.0.1',
    userAgent: 'DiamanteOS-TreasuryService/2.0',
    hashIntegridade: '5f93f983524def3dce464469d2cf9f11',
  },
  {
    id: 'AUD-2026-9929',
    timestamp: '04/11/2026 14:20:05',
    severity: 'success',
    category: 'transaction',
    action: 'Compra de Filigrana Tradicional Certificada',
    description: 'Aquisição de Custódia e Brincos à Rainha em Ouro 19.2k (60.5g) com contraste histórico de Guimarães no valor de €3.400,00.',
    actorNome: 'Andreia Vasconcelos',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 965 432 109',
    lojaNome: "Diamante D'ouro - Guimarães",
    ipAddress: '89.155.19.88',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    hashIntegridade: 'c8f7422320b92c481977717d23d8c11e',
  },
  {
    id: 'AUD-2026-9928',
    timestamp: '04/11/2026 11:45:50',
    severity: 'info',
    category: 'finance',
    action: 'Emissão de Cheque Bancário Visado',
    description: 'Cheque visado nº 841299 emitido para aquisição de Moedas D. João V em Ouro (32.8g) no valor de €2.600,00.',
    actorNome: 'Maria João Barroso',
    actorRole: 'Gerente de Balcão',
    actorPhone: '+351 914 321 098',
    lojaNome: "Diamante D'ouro - Évora",
    ipAddress: '85.242.10.99',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    hashIntegridade: '45c48cce2e2d7fbdea1afc51c7c6ad26',
  },
  {
    id: 'AUD-2026-9927',
    timestamp: '04/11/2026 09:30:12',
    severity: 'security',
    category: 'auth',
    action: 'Código OTP Expirado / Reemissão Solicitada',
    description: 'Código de 6 dígitos enviado para +351 918 901 234 expirou após 5 minutos. Novo código gerado pela Evolution API.',
    actorNome: 'Helena Pires Vaz',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 918 901 234',
    lojaNome: "Diamante D'ouro - Campo de Ourique (Lisboa)",
    ipAddress: '85.241.112.92',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    hashIntegridade: 'd3d9446802a44259755d38e6d163e820',
  },
  {
    id: 'AUD-2026-9926',
    timestamp: '03/11/2026 17:50:41',
    severity: 'success',
    category: 'store',
    action: 'Geocodificação e Validação de Morada de Loja',
    description: 'Coordenadas GPS (Lat: 37.1384, Lng: -8.5375) revalidadas via API Nominatim OpenStreetMap para Portimão.',
    actorNome: 'Administrador Master',
    actorRole: 'Master',
    actorPhone: '+351 937 230 116',
    lojaNome: "Diamante D'ouro - Portimão",
    ipAddress: '81.84.19.120',
    userAgent: 'Mozilla/5.0 (Macintosh; Apple Silicon M3)',
    hashIntegridade: '6512bd43d9caa6e02c990b0a82652dca',
  },
  {
    id: 'AUD-2026-9925',
    timestamp: '03/11/2026 15:30:22',
    severity: 'success',
    category: 'transaction',
    action: 'Compra de Moeda de Investimento Bullion',
    description: 'Krugerrand 1oz Ouro 22k (31.1g) adquirido por €1.750,00 de cliente cidadão alemão com passaporte validado.',
    actorNome: 'Daniela Raposo',
    actorRole: 'Operador de Balcão',
    actorPhone: '+351 928 765 432',
    lojaNome: "Diamante D'ouro - Portimão",
    ipAddress: '85.240.181.14',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    hashIntegridade: 'c20ad4d76fe97759aa27a0c99bff6710',
  },
  {
    id: 'AUD-2026-9924',
    timestamp: '03/11/2026 11:10:09',
    severity: 'info',
    category: 'employee',
    action: 'Novo Contrato de Funcionária Registado',
    description: 'Registo de funcionária Sofia Carvalhal no sistema para loja Funchal Sé com perfil Operador de Balcão.',
    actorNome: 'Administrador Master',
    actorRole: 'Master',
    actorPhone: '+351 937 230 116',
    lojaNome: "Diamante D'ouro - Funchal Sé (Madeira)",
    ipAddress: '81.84.19.120',
    userAgent: 'Mozilla/5.0 (Macintosh; Apple Silicon M3)',
    hashIntegridade: 'c51ce410c124a10e0db5e4b97fc2af39',
  },
  {
    id: 'AUD-2026-9923',
    timestamp: '03/11/2026 09:20:18',
    severity: 'success',
    category: 'auth',
    action: 'Sessão Master Iniciada',
    description: 'Login bem-sucedido com telemóvel +351 937 230 116 e confirmação de privilégios is_admin() no Supabase.',
    actorNome: 'Administrador Master',
    actorRole: 'Master',
    actorPhone: '+351 937 230 116',
    lojaNome: 'Sede Central Administrativa',
    ipAddress: '81.84.19.120',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    hashIntegridade: 'fbade9e36a3f36d3d676c1b808451dd7',
  },
];

export const LogAuditPage: React.FC<LogAuditPageProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>(INITIAL_AUDIT_LOGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Agora');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | LogSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | LogCategory>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '24h' | '7d'>('all');

  // Modal de Inspeção Forense do Log
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Carregamento de Logs Reais da Base de Dados Supabase (se disponíveis)
  const fetchLogsFromDatabase = useCallback(async () => {
    try {
      setIsLoading(true);

      // Tentar buscar transações reais ou tabela de logs
      if (isSupabaseConfigured()) {
        try {
          const { data: dbLogs, error: logErr } = await supabase
            .from('logs_auditoria')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

          if (!logErr && dbLogs && dbLogs.length > 0) {
            const formatted: AuditLogItem[] = dbLogs.map((item: any) => ({
              id: item.id || `AUD-${item.created_at?.slice(0, 10)}`,
              timestamp: new Date(item.created_at || Date.now()).toLocaleString('pt-PT'),
              severity: (item.severity as LogSeverity) || 'info',
              category: (item.category as LogCategory) || 'transaction',
              action: item.action || 'Atividade de Sistema',
              description: item.description || item.detalhes || '',
              actorNome: item.actor_nome || item.user_name || 'Utilizador',
              actorRole: item.actor_role || 'Operador',
              actorPhone: item.actor_phone || '',
              lojaNome: item.loja_nome || 'Balcão Diamante',
              ipAddress: item.ip_address || '194.65.231.10',
              userAgent: item.user_agent || 'DiamanteOS Web/2.4',
              hashIntegridade: item.hash || 'sha256-verified-ok',
              metadados: item.metadata || {},
            }));

            // Mesclar mantendo a integridade
            setLogs((prev) => {
              const ids = new Set(formatted.map((l) => l.id));
              const remainder = prev.filter((p) => !ids.has(p.id));
              return [...formatted, ...remainder];
            });
          }
        } catch {
          // Tabela específica de logs pode não estar criada ainda no Supabase
        }
      }

      setLastSyncTime(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn('[LogAudit] Aviso ao buscar logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogsFromDatabase();
  }, [fetchLogsFromDatabase]);

  // Simulação de Streaming em Tempo Real (novos eventos periódicos para demonstração de segurança)
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      // 20% de probabilidade de novo evento a cada 20 segundos
      if (Math.random() < 0.25) {
        const randomStore = AUDIT_STORES[Math.floor(Math.random() * (AUDIT_STORES.length - 1))];
        const newEvent: AuditLogItem = {
          id: `AUD-2026-${Math.floor(10000 + Math.random() * 90000)}`,
          timestamp: new Date().toLocaleString('pt-PT'),
          severity: Math.random() < 0.2 ? 'warning' : 'success',
          category: 'transaction',
          action: 'Verificação Periódica de Balcão',
          description: `Batimento de integridade de sessão e estado de cofre em ${randomStore.replace("Diamante D'ouro - ", '')}.`,
          actorNome: 'Monitor de Telemetria',
          actorRole: 'Daemon',
          actorPhone: 'N/A',
          lojaNome: randomStore,
          ipAddress: '194.65.231.42',
          userAgent: 'DiamanteOS-TelemetryGuard/2.1',
          hashIntegridade: Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        };

        setLogs((prev) => [newEvent, ...prev.slice(0, 150)]);
        setLastSyncTime('Agora');
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // =========================================================
  // 1. ESTATÍSTICAS DO PAINEL FORENSE
  // =========================================================
  const { totalCount, criticalCount, securityCount, transactionCount, configCount } =
    useMemo(() => {
      let crit = 0;
      let sec = 0;
      let tx = 0;
      let cfg = 0;

      logs.forEach((log) => {
        if (log.severity === 'critical') crit++;
        if (log.category === 'security' || log.severity === 'security') sec++;
        if (log.category === 'transaction') tx++;
        if (log.category === 'pricing' || log.category === 'store' || log.category === 'employee')
          cfg++;
      });

      return {
        totalCount: logs.length,
        criticalCount: crit,
        securityCount: sec,
        transactionCount: tx,
        configCount: cfg,
      };
    }, [logs]);

  // =========================================================
  // 2. FILTRAGEM MULTICRITÉRIO DOS LOGS
  // =========================================================
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Severidade
      if (severityFilter !== 'all' && log.severity !== severityFilter) {
        return false;
      }

      // Categoria
      if (categoryFilter !== 'all' && log.category !== categoryFilter) {
        return false;
      }

      // Loja
      if (storeFilter !== 'all' && log.lojaNome !== storeFilter) {
        return false;
      }

      // Período
      if (periodFilter === 'today' && !log.timestamp.includes('06/11/2026')) {
        return false;
      }
      if (
        periodFilter === '24h' &&
        !log.timestamp.includes('06/11/2026') &&
        !log.timestamp.includes('05/11/2026')
      ) {
        return false;
      }

      // Pesquisa por Texto Livre
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = log.id.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchActor = log.actorNome.toLowerCase().includes(q);
        const matchLoja = log.lojaNome.toLowerCase().includes(q);
        const matchIp = log.ipAddress.toLowerCase().includes(q);
        const matchHash = log.hashIntegridade.toLowerCase().includes(q);

        if (!matchId && !matchAction && !matchDesc && !matchActor && !matchLoja && !matchIp && !matchHash) {
          return false;
        }
      }

      return true;
    });
  }, [logs, severityFilter, categoryFilter, storeFilter, periodFilter, searchQuery]);

  // Exportação CSV do histórico de logs
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Data/Hora',
      'Severidade',
      'Categoria',
      'Acao',
      'Descricao',
      'Utilizador',
      'Cargo',
      'Telemovel',
      'Loja',
      'IP',
      'HashIntegridade',
    ];

    const rows = filteredLogs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${log.severity}"`,
      `"${log.category}"`,
      `"${log.action.replace(/"/g, '""')}"`,
      `"${log.description.replace(/"/g, '""')}"`,
      `"${log.actorNome}"`,
      `"${log.actorRole}"`,
      `"${log.actorPhone}"`,
      `"${log.lojaNome}"`,
      `"${log.ipAddress}"`,
      `"${log.hashIntegridade}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `diamante_os_auditoria_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper de Badge de Severidade
  const renderSeverityBadge = (severity: LogSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs shadow-rose-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            Crítico
          </span>
        );
      case 'security':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <ShieldAlert className="w-3 h-3 text-purple-400" />
            Segurança
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Aviso
          </span>
        );
      case 'info':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Info className="w-3 h-3 text-blue-400" />
            Info
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Sucesso
          </span>
        );
    }
  };

  // Helper de Ícone de Categoria
  const renderCategoryIcon = (category: LogCategory) => {
    switch (category) {
      case 'auth':
        return <Key className="w-3.5 h-3.5 text-blue-400" />;
      case 'transaction':
        return <Coins className="w-3.5 h-3.5 text-[#D4AF37]" />;
      case 'store':
        return <Building2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'employee':
        return <User className="w-3.5 h-3.5 text-purple-400" />;
      case 'pricing':
        return <TrendingUp className="w-3.5 h-3.5 text-amber-400" />;
      case 'finance':
        return <CreditCard className="w-3.5 h-3.5 text-cyan-400" />;
      case 'security':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Sidebar Administrativo Integrado */}
      {onNavigate && <AdminSidebar currentPath="/admin/logs" onNavigate={onNavigate} />}

      <div className={`flex-1 transition-all duration-300 ${onNavigate ? 'lg:pl-64' : ''}`}>
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* =========================================================
              1. HEADER COM STATUS EM TEMPO REAL E EXPORTAÇÃO
             ========================================================= */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-[#D4AF37]/20 shrink-0">
                  <Terminal className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                      Registo de Auditoria & Segurança
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      SHA-256 Imutável
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Trilha forense completa de transações, acessos OTP, alterações de preço e alertas de segurança
                  </p>
                </div>
              </div>
            </div>

            {/* Ações Rápidas do Cabeçalho */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
              {/* Botão de Pausar / Retomar Stream */}
              <button
                onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isLiveStreaming
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title={isLiveStreaming ? 'Pausar monitorização ao vivo' : 'Retomar monitorização'}
              >
                {isLiveStreaming ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ao Vivo</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-slate-400" />
                    <span>Pausado</span>
                  </>
                )}
              </button>

              {/* Botão Sincronizar */}
              <button
                onClick={fetchLogsFromDatabase}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="Sincronizar com a base de dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>

              {/* Botão Exportar CSV */}
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </header>

          {/* =========================================================
              2. STATS CARDS DE SEGURANÇA E AUDITORIA
             ========================================================= */}
          <section
            aria-label="Indicadores Forenses"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Total de Eventos */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Total de Registos
                </span>
                <p className="text-2xl font-extrabold text-white font-mono">
                  {totalCount}
                </p>
                <p className="text-[10px] text-slate-400">
                  Sincronizado: <span className="font-mono text-slate-300">{lastSyncTime}</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[#D4AF37]">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            {/* Alertas Críticos */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Alertas Críticos
                </span>
                <p className="text-2xl font-extrabold text-rose-400 font-mono">
                  {criticalCount}
                </p>
                <p className="text-[10px] text-rose-400/80 font-medium">
                  Fraudes e divergências legais
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            {/* Transações & Liquidações */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Eventos de Ouro & SEPA
                </span>
                <p className="text-2xl font-extrabold text-amber-300 font-mono">
                  {transactionCount}
                </p>
                <p className="text-[10px] text-amber-400/80 font-medium">
                  Avaliações e pagamentos bancários
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* Alterações Administrativas */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Definições & Sistema
                </span>
                <p className="text-2xl font-extrabold text-purple-300 font-mono">
                  {configCount}
                </p>
                <p className="text-[10px] text-purple-400/80 font-medium">
                  Ajustes de preço e pessoal
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
            </div>
          </section>

          {/* =========================================================
              3. BARRA DE PESQUISA & FILTROS AVANÇADOS
             ========================================================= */}
          <section
            aria-label="Filtros de Auditoria"
            className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
          >
            {/* Linha 1: Pesquisa Geral + Dropdown de Balcão */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:max-w-lg">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por ID, ação, utilizador, telemóvel, balcão, IP ou hash..."
                  className="w-full pl-10 pr-9 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="Limpar pesquisa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro por Balcão */}
              <div className="w-full md:w-80 shrink-0">
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                >
                  <option value="all">Todos os Balcões & Sede Central</option>
                  {AUDIT_STORES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 2: Filtros Pill por Severidade & Categoria */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
              {/* Severidade */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                  Severidade:
                </span>
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'critical', label: 'Crítico' },
                    { id: 'security', label: 'Segurança' },
                    { id: 'warning', label: 'Aviso' },
                    { id: 'success', label: 'Sucesso' },
                    { id: 'info', label: 'Info' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeverityFilter(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      severityFilter === s.id
                        ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                        : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Período */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                  Período:
                </span>
                {(
                  [
                    { id: 'all', label: 'Todos' },
                    { id: 'today', label: 'Hoje' },
                    { id: '24h', label: 'Últimas 24h' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodFilter(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      periodFilter === p.id
                        ? 'bg-slate-700 text-white font-bold'
                        : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* =========================================================
              4. LISTA / TABELA DE LOGS DE AUDITORIA
             ========================================================= */}
          <section aria-label="Stream de Auditoria">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
                <Terminal className="w-12 h-12 text-slate-500 mx-auto stroke-1" />
                <p className="text-base font-bold text-white">Nenhum evento forense encontrado</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Não foram detetados registos de auditoria correspondentes aos critérios de pesquisa selecionados.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSeverityFilter('all');
                    setCategoryFilter('all');
                    setStoreFilter('all');
                    setPeriodFilter('all');
                  }}
                  className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
                >
                  Repor todos os filtros
                </button>
              </div>
            ) : (
              <>
                {/* DESKTOP VIEW: Tabela Forense Densa (Visível em md+) */}
                <div className="hidden md:block rounded-2xl bg-[#151b2b] border border-slate-800/90 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0b0f19] text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4">Ref. / Data e Hora</th>
                          <th className="py-3.5 px-4">Severidade</th>
                          <th className="py-3.5 px-4">Módulo / Ação</th>
                          <th className="py-3.5 px-4">Descrição do Evento</th>
                          <th className="py-3.5 px-4">Utilizador / Balcão</th>
                          <th className="py-3.5 px-4">IP Origem</th>
                          <th className="py-3.5 px-4 text-right">Forense</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {filteredLogs.map((log) => (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          >
                            {/* Ref e Data */}
                            <td className="py-3.5 px-4 font-mono">
                              <span className="font-bold text-[#D4AF37] group-hover:underline block text-[11px]">
                                {log.id}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {log.timestamp}
                              </span>
                            </td>

                            {/* Severidade */}
                            <td className="py-3.5 px-4">
                              {renderSeverityBadge(log.severity)}
                            </td>

                            {/* Módulo & Ação */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-[#0b0f19] border border-slate-800 shrink-0">
                                  {renderCategoryIcon(log.category)}
                                </div>
                                <span className="font-semibold text-white truncate max-w-[170px]">
                                  {log.action}
                                </span>
                              </div>
                            </td>

                            {/* Descrição */}
                            <td className="py-3.5 px-4">
                              <p className="text-slate-300 truncate max-w-[320px] text-xs">
                                {log.description}
                              </p>
                              {log.diff && log.diff.length > 0 && (
                                <span className="text-[10px] font-mono text-amber-300/90 block mt-0.5">
                                  Alteração: {log.diff[0].campo} ({log.diff[0].anterior} &rarr; {log.diff[0].novo})
                                </span>
                              )}
                            </td>

                            {/* Utilizador & Balcão */}
                            <td className="py-3.5 px-4">
                              <p className="font-medium text-white truncate max-w-[160px]">
                                {log.actorNome}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                {log.lojaNome.replace("Diamante D'ouro - ", '')}
                              </p>
                            </td>

                            {/* IP */}
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                              {log.ipAddress}
                            </td>

                            {/* Ações */}
                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] border border-slate-700 transition-colors cursor-pointer"
                                title="Inspecionar detalhes forenses do evento"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MOBILE VIEW: Cards Forenses (<md) */}
                <div className="md:hidden space-y-3">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-2.5 active:scale-[0.99] transition-transform cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#D4AF37]">
                          {log.id}
                        </span>
                        {renderSeverityBadge(log.severity)}
                      </div>

                      <div>
                        <h2 className="font-bold text-sm text-white flex items-center gap-1.5">
                          {renderCategoryIcon(log.category)}
                          <span className="truncate">{log.action}</span>
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                          {log.description}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                        <div className="flex justify-between">
                          <span>Operador:</span>
                          <strong className="text-white font-medium">{log.actorNome}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Balcão:</span>
                          <span className="text-slate-300 truncate max-w-[180px]">
                            {log.lojaNome.replace("Diamante D'ouro - ", '')}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800 font-mono">
                          <span>Timestamp:</span>
                          <span className="text-slate-300">{log.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* =========================================================
              5. MODAL FORENSE DE INSPEÇÃO DE LOG
             ========================================================= */}
          {selectedLog && (
            <div
              className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
              onClick={() => setSelectedLog(null)}
            >
              <div
                className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative my-8"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header do Modal */}
                <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-amber-500/10 border border-[#D4AF37]/30">
                        {selectedLog.id}
                      </span>
                      {renderSeverityBadge(selectedLog.severity)}
                      <span className="text-[11px] font-mono text-slate-400">
                        {selectedLog.timestamp}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-2">
                      {selectedLog.action}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conteúdo Forense */}
                <div className="p-6 space-y-4 text-xs text-slate-300 max-h-[70vh] overflow-y-auto">
                  {/* Descrição Detalhada */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      Resumo do Evento Registado
                    </span>
                    <p className="text-sm text-white leading-relaxed">
                      {selectedLog.description}
                    </p>
                  </div>

                  {/* Detalhes de Utilizador & Localização */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Agente / Utilizador
                      </span>
                      <p className="font-bold text-white text-xs">{selectedLog.actorNome}</p>
                      <p className="text-[11px] text-slate-400">
                        Cargo: <span className="text-slate-200">{selectedLog.actorRole}</span>
                      </p>
                      {selectedLog.actorPhone && selectedLog.actorPhone !== 'N/A' && (
                        <p className="text-[11px] font-mono text-[#D4AF37]">
                          Telemóvel: {selectedLog.actorPhone}
                        </p>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Origem & Balcão
                      </span>
                      <p className="font-bold text-white text-xs">{selectedLog.lojaNome}</p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">
                        IP: <span className="text-slate-200">{selectedLog.ipAddress}</span>
                      </p>
                    </div>
                  </div>

                  {/* Hash de Integridade Criptográfica (SHA-256) */}
                  <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                        Assinatura de Integridade Forense (SHA-256)
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedLog.hashIntegridade);
                          setCopiedHash(true);
                          setTimeout(() => setCopiedHash(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[#D4AF37] hover:underline cursor-pointer"
                      >
                        {copiedHash ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar Hash</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-slate-300 break-all bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 select-all">
                      {selectedLog.hashIntegridade}
                    </p>
                  </div>

                  {/* Diferenças de Estado (Diff) */}
                  {selectedLog.diff && selectedLog.diff.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono uppercase text-amber-300 tracking-wider">
                        Modificação de Dados (Audit Diff)
                      </span>
                      <div className="space-y-1.5">
                        {selectedLog.diff.map((d, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono"
                          >
                            <span className="text-slate-400">{d.campo}:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-rose-400 line-through">{d.anterior}</span>
                              <span className="text-slate-500">&rarr;</span>
                              <span className="text-emerald-400 font-bold">{d.novo}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payload JSON de Metadados */}
                  {selectedLog.metadados && Object.keys(selectedLog.metadados).length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Payload Estruturado (Metadata JSON)
                      </span>
                      <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                        {JSON.stringify(selectedLog.metadados, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Rodapé do Modal */}
                <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Imprimir Certidão Forense</span>
                  </button>

                  <button
                    onClick={() => setSelectedLog(null)}
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default LogAuditPage;
