// PATH: src/components/finance/FinanceManagement.tsx
import React, { useState, useMemo } from 'react';
import { useFinanceTransactions } from '../../hooks/useSupabaseData';
import {
  Wallet,
  Plus,
  Search,
  Building2,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Download,
  Filter,
  Check,
  X,
  Eye,
  ShieldCheck,
  Send,
  RefreshCw,
  Printer,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export type PaymentStatus = 'pago' | 'pendente' | 'rejeitado';
export type PaymentMethod =
  | 'Transferência Imediata'
  | 'Transferência SEPA'
  | 'Numerário Balcão'
  | 'Cheque Bancário';

export interface FinancialTransaction {
  id: string;
  referencia: string;
  lojaId: string;
  lojaNome: string;
  beneficiarioNome: string;
  beneficiarioNif: string;
  beneficiarioIban?: string;
  valor: number;
  estado: PaymentStatus;
  data: string;
  hora: string;
  metodo: PaymentMethod;
  contaOrigem: string;
  descricao: string;
  pesoOuroGramas?: number;
  tipoMetal?: string;
  operadorNome: string;
  comprovativoRef?: string;
}

// 24 Balcões da Rede Diamante D'ouro para vinculação
export const STORE_LIST = [
  { id: 'loj-001', nome: "Diamante D'ouro - Baixa (Lisboa)" },
  { id: 'loj-002', nome: "Diamante D'ouro - Chiado (Lisboa)" },
  { id: 'loj-003', nome: "Diamante D'ouro - Campo de Ourique (Lisboa)" },
  { id: 'loj-004', nome: "Diamante D'ouro - Alvalade (Lisboa)" },
  { id: 'loj-005', nome: "Diamante D'ouro - Parque das Nações (Lisboa)" },
  { id: 'loj-006', nome: "Diamante D'ouro - Cascais" },
  { id: 'loj-007', nome: "Diamante D'ouro - Sintra" },
  { id: 'loj-008', nome: "Diamante D'ouro - Amadora" },
  { id: 'loj-009', nome: "Diamante D'ouro - Almada" },
  { id: 'loj-010', nome: "Diamante D'ouro - Setúbal" },
  { id: 'loj-011', nome: "Diamante D'ouro - Porto Santa Catarina" },
  { id: 'loj-012', nome: "Diamante D'ouro - Porto Boavista" },
  { id: 'loj-013', nome: "Diamante D'ouro - Vila Nova de Gaia" },
  { id: 'loj-014', nome: "Diamante D'ouro - Matosinhos" },
  { id: 'loj-015', nome: "Diamante D'ouro - Braga Centro" },
  { id: 'loj-016', nome: "Diamante D'ouro - Guimarães" },
  { id: 'loj-017', nome: "Diamante D'ouro - Coimbra Baixa" },
  { id: 'loj-018', nome: "Diamante D'ouro - Aveiro" },
  { id: 'loj-019', nome: "Diamante D'ouro - Leiria" },
  { id: 'loj-020', nome: "Diamante D'ouro - Évora" },
  { id: 'loj-021', nome: "Diamante D'ouro - Faro Baixa" },
  { id: 'loj-022', nome: "Diamante D'ouro - Portimão" },
  { id: 'loj-023', nome: "Diamante D'ouro - Funchal Sé (Madeira)" },
  { id: 'loj-024', nome: "Diamante D'ouro - Ponta Delgada (Açores)" },
];

// Dados Mockados Realistas de 20 Transações Financeiras
const INITIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'tx-001',
    referencia: 'PAG-2026-8941',
    lojaId: 'loj-001',
    lojaNome: "Diamante D'ouro - Baixa (Lisboa)",
    beneficiarioNome: 'Maria Manuela Ferreira',
    beneficiarioNif: '213456789',
    beneficiarioIban: 'PT50 0033 0000 4521 8963 2145 8',
    valor: 3250.0,
    estado: 'pendente',
    data: '06/11/2026',
    hora: '10:14',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Compra Lote Ouro 19.2k (58.0g - Peças de Joalharia Tradicional)',
    pesoOuroGramas: 58.0,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Ana Sofia Martins',
    comprovativoRef: 'SEPA-COMP-8941-PEND',
  },
  {
    id: 'tx-002',
    referencia: 'PAG-2026-8940',
    lojaId: 'loj-002',
    lojaNome: "Diamante D'ouro - Chiado (Lisboa)",
    beneficiarioNome: 'Bernardo Castanheira',
    beneficiarioNif: '245678123',
    beneficiarioIban: 'PT50 0035 0124 0002 9874 5632 1',
    valor: 8400.0,
    estado: 'pendente',
    data: '06/11/2026',
    hora: '09:48',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Compra Barra 100g Ouro Fino 24k (Investimento)',
    pesoOuroGramas: 100.0,
    tipoMetal: 'Ouro 24k (Toque 999)',
    operadorNome: 'Mariana Castelo Branco',
    comprovativoRef: 'SEPA-COMP-8940-PEND',
  },
  {
    id: 'tx-003',
    referencia: 'PAG-2026-8939',
    lojaId: 'loj-011',
    lojaNome: "Diamante D'ouro - Porto Santa Catarina",
    beneficiarioNome: 'Joaquim Silva Moreira',
    beneficiarioNif: '198765432',
    beneficiarioIban: 'PT50 0018 0001 2345 6789 0123 4',
    valor: 1450.5,
    estado: 'pago',
    data: '06/11/2026',
    hora: '09:15',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Caixa Geral de Depósitos - Tesouraria Norte',
    descricao: 'Compra Cordão Ouro 19.2k (26.2g)',
    pesoOuroGramas: 26.2,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Marta Ribeiro Sousa',
    comprovativoRef: 'SEPA-COMP-8939-OK',
  },
  {
    id: 'tx-004',
    referencia: 'PAG-2026-8938',
    lojaId: 'loj-006',
    lojaNome: "Diamante D'ouro - Cascais",
    beneficiarioNome: 'Guilherme Telles Moniz',
    beneficiarioNif: '234567812',
    beneficiarioIban: 'PT50 0007 0021 3456 7890 1234 5',
    valor: 5890.0,
    estado: 'pago',
    data: '06/11/2026',
    hora: '08:52',
    metodo: 'Transferência SEPA',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Relógio Ouro 18k + Lote Pulseiras (82.4g)',
    pesoOuroGramas: 82.4,
    tipoMetal: 'Ouro 18k (Toque 750)',
    operadorNome: 'Beatriz Fontes',
    comprovativoRef: 'SEPA-COMP-8938-OK',
  },
  {
    id: 'tx-005',
    referencia: 'PAG-2026-8937',
    lojaId: 'loj-005',
    lojaNome: "Diamante D'ouro - Parque das Nações (Lisboa)",
    beneficiarioNome: 'Vítor Manuel Sobral',
    beneficiarioNif: '223456123',
    beneficiarioIban: 'PT50 0033 0000 8765 4321 0987 6',
    valor: 750.0,
    estado: 'pago',
    data: '06/11/2026',
    hora: '08:30',
    metodo: 'Numerário Balcão',
    contaOrigem: 'Caixa Fundo de Maneio - Balcão Nações',
    descricao: 'Anel Solitário e Brincos Ouro 14k (18.8g)',
    pesoOuroGramas: 18.8,
    tipoMetal: 'Ouro 14k (Toque 585)',
    operadorNome: 'Catarina Morais',
    comprovativoRef: 'NUM-COMP-8937-REC',
  },
  {
    id: 'tx-006',
    referencia: 'PAG-2026-8936',
    lojaId: 'loj-015',
    lojaNome: "Diamante D'ouro - Braga Centro",
    beneficiarioNome: 'Custódio Alves Pimenta',
    beneficiarioNif: '187654321',
    beneficiarioIban: 'PT50 0035 0245 1122 3344 5566 7',
    valor: 2180.0,
    estado: 'pago',
    data: '05/11/2026',
    hora: '18:40',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Caixa Geral de Depósitos - Tesouraria Norte',
    descricao: 'Coração de Viana Antigo + Pulseira Portuguesa (38.9g)',
    pesoOuroGramas: 38.9,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Diana Pinheiro',
    comprovativoRef: 'SEPA-COMP-8936-OK',
  },
  {
    id: 'tx-007',
    referencia: 'PAG-2026-8935',
    lojaId: 'loj-004',
    lojaNome: "Diamante D'ouro - Alvalade (Lisboa)",
    beneficiarioNome: 'Teresa Paula Coutinho',
    beneficiarioNif: '256789012',
    beneficiarioIban: 'PT50 0033 0000 1111 2222 3333 4',
    valor: 3950.0,
    estado: 'rejeitado',
    data: '05/11/2026',
    hora: '17:22',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Divergência de Titularidade na Conta Bancária / Rejeitado pela Sede',
    pesoOuroGramas: 48.0,
    tipoMetal: 'Ouro 18k (Toque 750)',
    operadorNome: 'Patrícia Rebelo',
    comprovativoRef: 'REJ-AUDIT-8935',
  },
  {
    id: 'tx-008',
    referencia: 'PAG-2026-8934',
    lojaId: 'loj-017',
    lojaNome: "Diamante D'ouro - Coimbra Baixa",
    beneficiarioNome: 'António Vasco Loureiro',
    beneficiarioNif: '209876543',
    beneficiarioIban: 'PT50 0025 0000 9876 5432 1098 7',
    valor: 1620.0,
    estado: 'pago',
    data: '05/11/2026',
    hora: '16:55',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Compra Salva de Prata 925 + Moedas Ouro (480g Prata + 14g Ouro)',
    pesoOuroGramas: 14.0,
    tipoMetal: 'Ouro 19.2k & Prata 925',
    operadorNome: 'Luísa Antunes',
    comprovativoRef: 'SEPA-COMP-8934-OK',
  },
  {
    id: 'tx-009',
    referencia: 'PAG-2026-8933',
    lojaId: 'loj-021',
    lojaNome: "Diamante D'ouro - Faro Baixa",
    beneficiarioNome: 'David Alistair Smith',
    beneficiarioNif: '298765432',
    beneficiarioIban: 'PT50 0036 0000 5555 6666 7777 8',
    valor: 4120.0,
    estado: 'pendente',
    data: '05/11/2026',
    hora: '15:10',
    metodo: 'Transferência SEPA',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Libras de Ouro George V (5x Sovereign 39.9g)',
    pesoOuroGramas: 39.9,
    tipoMetal: 'Ouro 22k (Toque 916)',
    operadorNome: 'Cláudia Lourenço',
    comprovativoRef: 'SEPA-COMP-8933-PEND',
  },
  {
    id: 'tx-010',
    referencia: 'PAG-2026-8932',
    lojaId: 'loj-012',
    lojaNome: "Diamante D'ouro - Porto Boavista",
    beneficiarioNome: 'Camilo Castelo Branco Neto',
    beneficiarioNif: '265432198',
    beneficiarioIban: 'PT50 0010 0000 3344 5566 7788 9',
    valor: 6700.0,
    estado: 'pago',
    data: '05/11/2026',
    hora: '14:05',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Caixa Geral de Depósitos - Tesouraria Norte',
    descricao: 'Herança Familiar: Faqueiro de Prata + Joias em Ouro (95.0g Ouro)',
    pesoOuroGramas: 95.0,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Filipa Nogueira',
    comprovativoRef: 'SEPA-COMP-8932-OK',
  },
  {
    id: 'tx-011',
    referencia: 'PAG-2026-8931',
    lojaId: 'loj-018',
    lojaNome: "Diamante D'ouro - Aveiro",
    beneficiarioNome: 'Sílvia Ramos Meireles',
    beneficiarioNif: '241239876',
    beneficiarioIban: 'PT50 0033 0000 8899 0011 2233 4',
    valor: 980.0,
    estado: 'pago',
    data: '05/11/2026',
    hora: '12:30',
    metodo: 'Numerário Balcão',
    contaOrigem: 'Caixa Fundo de Maneio - Balcão Aveiro',
    descricao: 'Pulseira Ouro 9k e Alianças (34.0g)',
    pesoOuroGramas: 34.0,
    tipoMetal: 'Ouro 9k (Toque 375)',
    operadorNome: 'Célia Bernardo',
    comprovativoRef: 'NUM-COMP-8931-REC',
  },
  {
    id: 'tx-012',
    referencia: 'PAG-2026-8930',
    lojaId: 'loj-013',
    lojaNome: "Diamante D'ouro - Vila Nova de Gaia",
    beneficiarioNome: 'Álvaro Sampaio Dias',
    beneficiarioNif: '210987654',
    beneficiarioIban: 'PT50 0035 0100 2233 4455 6677 8',
    valor: 2850.0,
    estado: 'pendente',
    data: '05/11/2026',
    hora: '11:15',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Gargantilha Ouro 19.2k com pendente (51.2g)',
    pesoOuroGramas: 51.2,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Rita Magalhães',
    comprovativoRef: 'SEPA-COMP-8930-PEND',
  },
  {
    id: 'tx-013',
    referencia: 'PAG-2026-8929',
    lojaId: 'loj-003',
    lojaNome: "Diamante D'ouro - Campo de Ourique (Lisboa)",
    beneficiarioNome: 'Emília Augusta Trindade',
    beneficiarioNif: '232109876',
    beneficiarioIban: 'PT50 0033 0000 9988 7766 5544 3',
    valor: 1120.0,
    estado: 'pago',
    data: '04/11/2026',
    hora: '17:50',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Anéis e medalhas religiosas Ouro 19.2k (20.0g)',
    pesoOuroGramas: 20.0,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Helena Pires Vaz',
    comprovativoRef: 'SEPA-COMP-8929-OK',
  },
  {
    id: 'tx-014',
    referencia: 'PAG-2026-8928',
    lojaId: 'loj-010',
    lojaNome: "Diamante D'ouro - Setúbal",
    beneficiarioNome: 'Manuel Fernando Nobre',
    beneficiarioNif: '243210987',
    beneficiarioIban: 'PT50 0045 0000 1212 3434 5656 7',
    valor: 1890.0,
    estado: 'pago',
    data: '04/11/2026',
    hora: '16:15',
    metodo: 'Transferência SEPA',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Lote de ouro dental e sobras de oficina (32.1g)',
    pesoOuroGramas: 32.1,
    tipoMetal: 'Ouro 14k (Toque 585)',
    operadorNome: 'Carla Silveira',
    comprovativoRef: 'SEPA-COMP-8928-OK',
  },
  {
    id: 'tx-015',
    referencia: 'PAG-2026-8927',
    lojaId: 'loj-016',
    lojaNome: "Diamante D'ouro - Guimarães",
    beneficiarioNome: 'Alzira Guimarães Peixoto',
    beneficiarioNif: '254321098',
    beneficiarioIban: 'PT50 0035 0890 9988 7766 1122 3',
    valor: 3400.0,
    estado: 'pago',
    data: '04/11/2026',
    hora: '14:20',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Caixa Geral de Depósitos - Tesouraria Norte',
    descricao: 'Custódia de ouro e brincos à rainha (60.5g)',
    pesoOuroGramas: 60.5,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Andreia Vasconcelos',
    comprovativoRef: 'SEPA-COMP-8927-OK',
  },
  {
    id: 'tx-016',
    referencia: 'PAG-2026-8926',
    lojaId: 'loj-020',
    lojaNome: "Diamante D'ouro - Évora",
    beneficiarioNome: 'Duarte Pacheco de Carvalho',
    beneficiarioNif: '265432109',
    beneficiarioIban: 'PT50 0033 0000 4455 6677 8899 0',
    valor: 2600.0,
    estado: 'pago',
    data: '04/11/2026',
    hora: '11:45',
    metodo: 'Cheque Bancário',
    contaOrigem: 'Millennium BCP - Cheque Visado',
    descricao: 'Moedas de D. João V em Ouro (32.8g)',
    pesoOuroGramas: 32.8,
    tipoMetal: 'Ouro 22k (Toque 916)',
    operadorNome: 'Maria João Barroso',
    comprovativoRef: 'CHQ-COMP-8926-VIS',
  },
  {
    id: 'tx-017',
    referencia: 'PAG-2026-8925',
    lojaId: 'loj-009',
    lojaNome: "Diamante D'ouro - Almada",
    beneficiarioNome: 'Rosa Maria Figueiredo',
    beneficiarioNif: '276543210',
    beneficiarioIban: 'PT50 0007 0000 3322 1100 9988 7',
    valor: 4300.0,
    estado: 'rejeitado',
    data: '03/11/2026',
    hora: '17:10',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Suspeita de metal não conforme em ensaio ácido / Rejeição de Segurança',
    pesoOuroGramas: 65.0,
    tipoMetal: 'Metal Falso / Não Conforme',
    operadorNome: 'Joana Figueiredo',
    comprovativoRef: 'REJ-LAUDO-8925',
  },
  {
    id: 'tx-018',
    referencia: 'PAG-2026-8924',
    lojaId: 'loj-022',
    lojaNome: "Diamante D'ouro - Portimão",
    beneficiarioNome: 'Hans Peter Becker',
    beneficiarioNif: '287654321',
    beneficiarioIban: 'PT50 0036 0000 1234 9876 5432 1',
    valor: 1750.0,
    estado: 'pago',
    data: '03/11/2026',
    hora: '15:30',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Krugerrand Ouro 1oz (31.1g)',
    pesoOuroGramas: 31.1,
    tipoMetal: 'Ouro 22k (Toque 916)',
    operadorNome: 'Daniela Raposo',
    comprovativoRef: 'SEPA-COMP-8924-OK',
  },
  {
    id: 'tx-019',
    referencia: 'PAG-2026-8923',
    lojaId: 'loj-014',
    lojaNome: "Diamante D'ouro - Matosinhos",
    beneficiarioNome: 'Lúcia Faria Valadares',
    beneficiarioNif: '298765430',
    beneficiarioIban: 'PT50 0035 0999 8877 6655 4433 2',
    valor: 2300.0,
    estado: 'pago',
    data: '03/11/2026',
    hora: '11:05',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Caixa Geral de Depósitos - Tesouraria Norte',
    descricao: 'Pulseira Grossa e Anel de Brasão Ouro 19.2k (41.0g)',
    pesoOuroGramas: 41.0,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Susana Valente',
    comprovativoRef: 'SEPA-COMP-8923-OK',
  },
  {
    id: 'tx-020',
    referencia: 'PAG-2026-8922',
    lojaId: 'loj-019',
    lojaNome: "Diamante D'ouro - Leiria",
    beneficiarioNome: 'Fernando Jorge Matos',
    beneficiarioNif: '209123456',
    beneficiarioIban: 'PT50 0033 0000 7711 2233 4455 6',
    valor: 1350.0,
    estado: 'pago',
    data: '03/11/2026',
    hora: '09:20',
    metodo: 'Transferência Imediata',
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Alianças de casamento e brincos (24.3g)',
    pesoOuroGramas: 24.3,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Sónia Henriques',
    comprovativoRef: 'SEPA-COMP-8922-OK',
  },
];

export interface FinanceManagementProps {
  onNavigate?: (path: string) => void;
}

export const FinanceManagement: React.FC<FinanceManagementProps> = ({ onNavigate }) => {
  const {
    data: transactions,
    loading,
    error,
    confirmPayment,
    rejectPayment,
    createPayment,
  } = useFinanceTransactions();

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | PaymentStatus>('todos');
  const [storeFilter, setStoreFilter] = useState<string>('todas');
  const [dateFilter, setDateFilter] = useState<'todos' | 'hoje' | '7dias' | 'mes'>('todos');

  // Modais
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State para Novo Pagamento
  const [newPayment, setNewPayment] = useState({
    lojaId: STORE_LIST[0].id,
    beneficiarioNome: '',
    beneficiarioNif: '',
    beneficiarioIban: 'PT50 ',
    valor: 1500,
    metodo: 'Transferência Imediata' as PaymentMethod,
    contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
    descricao: 'Compra de Lote de Ouro Usado',
    pesoOuroGramas: 25.0,
    tipoMetal: 'Ouro 19.2k (Toque 800)',
    operadorNome: 'Operador de Balcão',
  });

  // Saldo base da tesouraria
  const [saldoDisponivelBase, setSaldoDisponivelBase] = useState<number>(184250.0);

  // =========================================================
  // 1. ESTATÍSTICAS CALCULADAS EM TEMPO REAL
  // =========================================================
  const { totalPendenteValor, totalPendenteQtd, totalPagoHojeValor } = useMemo(() => {
    let pendenteVal = 0;
    let pendenteQtd = 0;
    let pagoHojeVal = 0;

    const dataHoje = '06/11/2026';

    transactions.forEach((tx) => {
      if (tx.estado === 'pendente') {
        pendenteVal += tx.valor;
        pendenteQtd += 1;
      }
      if (tx.estado === 'pago' && tx.data === dataHoje) {
        pagoHojeVal += tx.valor;
      }
    });

    return {
      totalPendenteValor: pendenteVal,
      totalPendenteQtd: pendenteQtd,
      totalPagoHojeValor: pagoHojeVal,
    };
  }, [transactions]);

  // Formatação de Valores Monetários em Euros
  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // =========================================================
  // 2. FILTRAGEM DE TRANSAÇÕES
  // =========================================================
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filtro por Estado
      if (statusFilter !== 'todos' && tx.estado !== statusFilter) {
        return false;
      }

      // Filtro por Loja
      if (storeFilter !== 'todas' && tx.lojaId !== storeFilter) {
        return false;
      }

      // Filtro por Data
      if (dateFilter === 'hoje' && tx.data !== '06/11/2026') {
        return false;
      }
      if (
        dateFilter === '7dias' &&
        !['06/11/2026', '05/11/2026', '04/11/2026', '03/11/2026'].includes(tx.data)
      ) {
        return false;
      }

      // Pesquisa por Texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchRef = tx.referencia.toLowerCase().includes(q);
        const matchNome = tx.beneficiarioNome.toLowerCase().includes(q);
        const matchNif = tx.beneficiarioNif.includes(q);
        const matchIban = tx.beneficiarioIban?.toLowerCase().includes(q);
        const matchLoja = tx.lojaNome.toLowerCase().includes(q);
        const matchDesc = tx.descricao.toLowerCase().includes(q);

        if (!matchRef && !matchNome && !matchNif && !matchIban && !matchLoja && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, statusFilter, storeFilter, dateFilter, searchTerm]);

  // =========================================================
  // 3. AÇÕES RÁPIDAS (CONFIRMAR, REJEITAR, CRIAR)
  // =========================================================
  const handleConfirmPayment = async (txId: string) => {
    await confirmPayment(txId);

    // Deduz do saldo disponível
    const tx = transactions.find((t) => t.id === txId);
    if (tx && tx.estado === 'pendente') {
      setSaldoDisponivelBase((prev) => Math.max(0, prev - tx.valor));
    }

    if (selectedTx && selectedTx.id === txId) {
      setSelectedTx((prev) => (prev ? { ...prev, estado: 'pago' } : null));
    }
  };

  const handleRejectPayment = async (txId: string) => {
    await rejectPayment(txId);
    if (selectedTx && selectedTx.id === txId) {
      setSelectedTx((prev) => (prev ? { ...prev, estado: 'rejeitado' } : null));
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.beneficiarioNome.trim() || !newPayment.valor) return;

    const storeObj = STORE_LIST.find((s) => s.id === newPayment.lojaId);
    const id = `tx-${Date.now()}`;
    const refNum = Math.floor(8950 + Math.random() * 1000);
    const referencia = `PAG-2026-${refNum}`;

    const createdTx: FinancialTransaction = {
      id,
      referencia,
      lojaId: newPayment.lojaId,
      lojaNome: storeObj ? storeObj.nome : "Diamante D'ouro - Baixa (Lisboa)",
      beneficiarioNome: newPayment.beneficiarioNome.trim(),
      beneficiarioNif: newPayment.beneficiarioNif.trim() || '299999999',
      beneficiarioIban: newPayment.beneficiarioIban.trim().toUpperCase(),
      valor: Number(newPayment.valor),
      estado: 'pendente',
      data: '06/11/2026',
      hora: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      metodo: newPayment.metodo,
      contaOrigem: newPayment.contaOrigem,
      descricao: newPayment.descricao.trim(),
      pesoOuroGramas: Number(newPayment.pesoOuroGramas) || 0,
      tipoMetal: newPayment.tipoMetal,
      operadorNome: newPayment.operadorNome || 'Operador Tesouraria',
      comprovativoRef: `SEPA-COMP-${refNum}-PEND`,
    };

    await createPayment(createdTx);
    setIsCreateModalOpen(false);
    setNewPayment({
      lojaId: STORE_LIST[0].id,
      beneficiarioNome: '',
      beneficiarioNif: '',
      beneficiarioIban: 'PT50 ',
      valor: 1500,
      metodo: 'Transferência Imediata',
      contaOrigem: 'Millennium BCP - Conta Principal Liquidação',
      descricao: 'Compra de Lote de Ouro Usado',
      pesoOuroGramas: 25.0,
      tipoMetal: 'Ouro 19.2k (Toque 800)',
      operadorNome: 'Operador de Balcão',
    });
  };

  // Helper de Badge de Estado
  const renderStatusBadge = (estado: PaymentStatus) => {
    switch (estado) {
      case 'pago':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Liquidado / Pago
          </span>
        );
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Aguardar Validação
          </span>
        );
      case 'rejeitado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Rejeitado
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* =========================================================
            1. HEADER
           ========================================================= */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-[#D4AF37]/20 shrink-0">
                <Wallet className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Financeiro & Tesouraria
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Gestão Central de Liquidações, Transferências Imediatas e Pagamentos a Clientes
                </p>
                {onNavigate && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onNavigate('/dashboard-admin')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] flex items-center gap-1 transition-colors cursor-pointer font-mono"
                    >
                      &larr; Sala de Guerra
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/stores')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Gestão de Lojas
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/employees')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Funcionários
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/clients')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Clientes & Fornecedores
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Pagamento</span>
          </button>
        </header>

        {/* =========================================================
            2. STATS CARDS FINANCEIROS (Topo)
           ========================================================= */}
        <section
          aria-label="Indicadores de Tesouraria"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6"
        >
          {/* Card 1: Saldo Disponível */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Saldo Disponível em Conta
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {formatEUR(saldoDisponivelBase)}
              </p>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Millennium BCP & CGD Ativas
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Pagamentos Pendentes */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Pagamentos Pendentes
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                  {formatEUR(totalPendenteValor)}
                </p>
              </div>
              <p className="text-[11px] text-amber-400/90 font-mono">
                {totalPendenteQtd} pedidos a aguardar liquidação
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Total Pago Hoje */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Pago Hoje
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {formatEUR(totalPagoHojeValor)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Liquidações diretas aos balcões
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* =========================================================
            3. BARRA DE PESQUISA & FILTROS RÁPIDOS
           ========================================================= */}
        <section
          aria-label="Filtros e Pesquisa Financeira"
          className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
        >
          {/* Linha 1: Pesquisa + Filtro de Balcão */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por referência, cliente, NIF, IBAN ou balcão..."
                className="w-full pl-10 pr-9 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-[#D4AF37] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown de Filtro por Loja */}
            <div className="w-full md:w-72 shrink-0">
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
              >
                <option value="todas">Todos os Balcões (24 Lojas)</option>
                {STORE_LIST.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Filtros Pill por Estado e Data */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            {/* Estado Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Estado:
              </span>
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'todos'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({transactions.length})
              </button>
              <button
                onClick={() => setStatusFilter('pendente')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'pendente'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-amber-400 border border-slate-800'
                }`}
              >
                Pendentes ({totalPendenteQtd})
              </button>
              <button
                onClick={() => setStatusFilter('pago')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'pago'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-emerald-400 border border-slate-800'
                }`}
              >
                Pagos ({transactions.filter((t) => t.estado === 'pago').length})
              </button>
              <button
                onClick={() => setStatusFilter('rejeitado')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'rejeitado'
                    ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-rose-400 border border-slate-800'
                }`}
              >
                Rejeitados ({transactions.filter((t) => t.estado === 'rejeitado').length})
              </button>
            </div>

            {/* Período Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Período:
              </span>
              {(['todos', 'hoje', '7dias', 'mes'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setDateFilter(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize ${
                    dateFilter === p
                      ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                      : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {p === '7dias' ? 'Últimos 7 dias' : p === 'mes' ? 'Este Mês' : p}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            4. LISTA / TABELA RESPONSIVA DE TRANSAÇÕES FINANCEIRAS
           ========================================================= */}
        <section aria-label="Histórico de Pagamentos">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
              <Wallet className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
              <p className="text-base font-bold text-white">Nenhum pagamento encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não existem transações financeiras correspondentes aos filtros selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('todos');
                  setStoreFilter('todas');
                  setDateFilter('todos');
                }}
                className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW: Tabela Elegante (Visível em md+) */}
              <div className="hidden md:block rounded-2xl bg-[#151b2b] border border-slate-800/90 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0b0f19] text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Ref. / Transação</th>
                        <th className="py-3.5 px-4">Balcão Origem</th>
                        <th className="py-3.5 px-4">Beneficiário (Cliente)</th>
                        <th className="py-3.5 px-4">Método</th>
                        <th className="py-3.5 px-4">Data / Hora</th>
                        <th className="py-3.5 px-4">Valor Liquidado</th>
                        <th className="py-3.5 px-4">Estado</th>
                        <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Referência */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-[#D4AF37] group-hover:underline">
                              {tx.referencia}
                            </span>
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                              {tx.tipoMetal || 'Ouro Geral'}
                            </p>
                          </td>

                          {/* Balcão */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 max-w-[180px] truncate" title={tx.lojaNome}>
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-white font-medium">
                                {tx.lojaNome.replace("Diamante D'ouro - ", '')}
                              </span>
                            </div>
                          </td>

                          {/* Beneficiário */}
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-white truncate max-w-[170px]">
                              {tx.beneficiarioNome}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              NIF: {tx.beneficiarioNif}
                            </p>
                          </td>

                          {/* Método */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            {tx.metodo}
                          </td>

                          {/* Data / Hora */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            <span>{tx.data}</span>
                            <span className="text-slate-400 ml-1.5">{tx.hora}</span>
                          </td>

                          {/* Valor */}
                          <td className="py-3.5 px-4 font-mono text-sm font-bold text-white">
                            {formatEUR(tx.valor)}
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(tx.estado)}
                          </td>

                          {/* Ações Rápidas */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {tx.estado === 'pendente' && (
                                <>
                                  <button
                                    onClick={() => handleConfirmPayment(tx.id)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                                    title="Confirmar Liquidação Imediata"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRejectPayment(tx.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                                    title="Rejeitar Pagamento"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedTx(tx)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] transition-colors cursor-pointer"
                                title="Ver Detalhes e Comprovativo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE VIEW: Cards Verticais Elegantes (Visível em <md) */}
              <div className="md:hidden space-y-3">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {/* Topo do Card */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-bold text-[#D4AF37]">
                          {tx.referencia}
                        </span>
                        <h2 className="font-bold text-sm text-white truncate">
                          {tx.beneficiarioNome}
                        </h2>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-base text-white">
                          {formatEUR(tx.valor)}
                        </p>
                      </div>
                    </div>

                    {/* Informações da Transação */}
                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Balcão:</span>
                        <span className="text-white font-medium truncate max-w-[200px]">
                          {tx.lojaNome.replace("Diamante D'ouro - ", '')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Método:</span>
                        <span className="font-mono text-slate-200">{tx.metodo}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Data / Hora:</span>
                        <span className="font-mono text-slate-300">
                          {tx.data} às {tx.hora}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Estado:</span>
                        {renderStatusBadge(tx.estado)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            5. MODAL DE DETALHES DO PAGAMENTO & COMPROVATIVO
           ========================================================= */}
        {selectedTx && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedTx(null)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-amber-500/10 border border-[#D4AF37]/30">
                      {selectedTx.referencia}
                    </span>
                    {renderStatusBadge(selectedTx.estado)}
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1.5">
                    {formatEUR(selectedTx.valor)}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    {selectedTx.metodo} &bull; {selectedTx.data} às {selectedTx.hora}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informações Completas */}
              <div className="p-6 space-y-4 text-xs text-slate-300">
                {/* Beneficiário e Dados Bancários */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Dados do Beneficiário & Destino</span>
                  </h4>
                  <div className="space-y-1">
                    <p>
                      <span className="text-slate-400">Nome:</span>{' '}
                      <strong className="text-white">{selectedTx.beneficiarioNome}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">NIF Cliente:</span>{' '}
                      <span className="font-mono text-white">{selectedTx.beneficiarioNif}</span>
                    </p>
                    {selectedTx.beneficiarioIban && (
                      <p>
                        <span className="text-slate-400">IBAN Destino:</span>{' '}
                        <span className="font-mono text-white select-all">
                          {selectedTx.beneficiarioIban}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Dados da Compra de Ouro */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                    <span>Origem & Descrição da Transação</span>
                  </h4>
                  <div className="space-y-1">
                    <p>
                      <span className="text-slate-400">Balcão Emissor:</span>{' '}
                      <strong className="text-white">{selectedTx.lojaNome}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Conta de Saída:</span>{' '}
                      <span className="text-slate-200">{selectedTx.contaOrigem}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Operador Responsável:</span>{' '}
                      <span className="text-white">{selectedTx.operadorNome}</span>
                    </p>
                    <p className="pt-1 text-slate-300 italic border-t border-slate-800/80">
                      "{selectedTx.descricao}"
                    </p>
                  </div>
                </div>

                {/* Comprovativo Bancário Digital Simulador */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    <div>
                      <p className="text-[11px] font-semibold text-white">
                        Comprovativo SEPA Digital
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        Ref: {selectedTx.comprovativoRef || 'SEPA-REF-PEND'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Visualizar Recibo</span>
                  </button>
                </div>
              </div>

              {/* Ações do Rodapé */}
              <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3">
                {selectedTx.estado === 'pendente' ? (
                  <>
                    <button
                      onClick={() => handleRejectPayment(selectedTx.id)}
                      className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Rejeitar Pagamento
                    </button>

                    <button
                      onClick={() => handleConfirmPayment(selectedTx.id)}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-[#D4AF37]/25 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirmar Pagamento Imediato</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsReceiptModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-[#D4AF37]" />
                      <span>Imprimir Comprovativo</span>
                    </button>

                    <button
                      onClick={() => setSelectedTx(null)}
                      className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            6. MODAL DO COMPROVATIVO OFICIAL (Impressão / Visualização)
           ========================================================= */}
        {isReceiptModalOpen && selectedTx && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsReceiptModalOpen(false)}
          >
            <div
              className="bg-white text-slate-950 rounded-2xl max-w-md w-full p-6 shadow-2xl relative font-sans space-y-4 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h4 className="font-extrabold text-base tracking-wider uppercase">
                    Diamante D'ouro Lda
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono">
                    NIF: 509 123 456 &bull; Registo Contrastaria Lisboa
                  </p>
                </div>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center py-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Comprovativo de Liquidação Financeira
                </span>
                <p className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {formatEUR(selectedTx.valor)}
                </p>
                <p className="text-xs text-emerald-700 font-bold uppercase mt-1">
                  &bull; Operação Liquidada com Sucesso &bull;
                </p>
              </div>

              <div className="text-xs space-y-2 border-y py-3 border-dashed">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ref. Operação:</span>
                  <span className="font-mono font-bold">{selectedTx.referencia}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data e Hora:</span>
                  <span className="font-mono">
                    {selectedTx.data} às {selectedTx.hora}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficiário:</span>
                  <span className="font-bold">{selectedTx.beneficiarioNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NIF Beneficiário:</span>
                  <span className="font-mono">{selectedTx.beneficiarioNif}</span>
                </div>
                {selectedTx.beneficiarioIban && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">IBAN Destino:</span>
                    <span className="font-mono text-[10px]">{selectedTx.beneficiarioIban}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Balcão de Origem:</span>
                  <span className="font-medium">{selectedTx.lojaNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Código SEPA:</span>
                  <span className="font-mono text-[10px]">
                    {selectedTx.comprovativoRef || 'SEPA-AUT-9921'}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center leading-relaxed">
                Este documento serve de comprovativo oficial da ordem de transferência irrevogável
                para aquisição de artefactos em metais preciosos.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 font-semibold text-xs"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            7. MODAL: NOVO PAGAMENTO (Formulário)
           ========================================================= */}
        {isCreateModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#D4AF37]" />
                  <span>Registar Nova Ordem de Pagamento</span>
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePayment} className="p-6 space-y-4 text-xs">
                {/* Balcão */}
                <div>
                  <label className="block text-slate-400 mb-1">Balcão de Origem da Compra *</label>
                  <select
                    value={newPayment.lojaId}
                    onChange={(e) => setNewPayment({ ...newPayment, lojaId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                  >
                    {STORE_LIST.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Nome do Beneficiário */}
                  <div>
                    <label className="block text-slate-400 mb-1">Nome do Cliente / Beneficiário *</label>
                    <input
                      type="text"
                      required
                      value={newPayment.beneficiarioNome}
                      onChange={(e) =>
                        setNewPayment({ ...newPayment, beneficiarioNome: e.target.value })
                      }
                      placeholder="Ex: Maria Santos"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 mb-1">NIF do Cliente *</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={newPayment.beneficiarioNif}
                      onChange={(e) =>
                        setNewPayment({ ...newPayment, beneficiarioNif: e.target.value })
                      }
                      placeholder="213456789"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* IBAN */}
                <div>
                  <label className="block text-slate-400 mb-1">IBAN de Destino (SEPA) *</label>
                  <input
                    type="text"
                    required
                    value={newPayment.beneficiarioIban}
                    onChange={(e) =>
                      setNewPayment({ ...newPayment, beneficiarioIban: e.target.value })
                    }
                    placeholder="PT50 0033 0000 1234 5678 9012 3"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono uppercase focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Valor (€) */}
                  <div>
                    <label className="block text-slate-400 mb-1">Valor a Liquidar (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newPayment.valor}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          valor: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Método */}
                  <div>
                    <label className="block text-slate-400 mb-1">Método de Liquidação</label>
                    <select
                      value={newPayment.metodo}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          metodo: e.target.value as PaymentMethod,
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="Transferência Imediata">Transferência Imediata</option>
                      <option value="Transferência SEPA">Transferência SEPA</option>
                      <option value="Numerário Balcão">Numerário Balcão</option>
                      <option value="Cheque Bancário">Cheque Bancário</option>
                    </select>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-slate-400 mb-1">Descrição / Lote de Ouro</label>
                  <input
                    type="text"
                    value={newPayment.descricao}
                    onChange={(e) => setNewPayment({ ...newPayment, descricao: e.target.value })}
                    placeholder="Ex: Compra de Ouro 19.2k (34.5g)"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Botões do Rodapé */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    Submeter Pagamento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceManagement;
