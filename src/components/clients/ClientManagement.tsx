// PATH: src/components/clients/ClientManagement.tsx
import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  FileText,
  Eye,
  Edit,
  X,
  Filter,
  ArrowUpRight,
  ChevronRight,
  AlertTriangle,
  Lock,
  Unlock,
  CreditCard,
  Plus,
} from 'lucide-react';
import { useClients } from '../../hooks/useSupabaseData';

export type ClientStatus = 'vip' | 'normal' | 'bloqueado';

export interface ClientTransactionRecord {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  pesoGramas: number;
  lojaNome: string;
}

export interface Client {
  id: string;
  codigoCliente: string;
  nome: string;
  nif: string;
  telemovel: string;
  email: string;
  docIdentificacao: string; // Ex: CC 14892301 2 ZX4
  dataNascimento: string;
  morada: string;
  cidade: string;
  lojaOrigemId: string;
  lojaOrigemNome: string;
  status: ClientStatus;
  totalTransacoes: number;
  totalCompradoEUR: number; // Volume total pago ao cliente pelas peças vendidas
  ultimaVisita: string;
  dataRegisto: string;
  notasInternas: string;
  historico: ClientTransactionRecord[];
}

export interface ClientManagementProps {
  onNavigate?: (path: string) => void;
}

// 24 Lojas Oficiais da Rede Diamante D'ouro
export const CLIENT_STORES = [
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

// Dados Mockados Realistas de ~40 Clientes e Fornecedores Portugueses
const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-001',
    codigoCliente: 'CLI-001',
    nome: 'Maria Manuela Ferreira',
    nif: '213456789',
    telemovel: '+351 912 345 678',
    email: 'm.manuela.ferreira@gmail.com',
    docIdentificacao: 'CC 12894567 4 ZX2',
    dataNascimento: '14/05/1968',
    morada: 'Rua das Flores 45, 2º Dto',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-001',
    lojaOrigemNome: "Diamante D'ouro - Baixa (Lisboa)",
    status: 'vip',
    totalTransacoes: 9,
    totalCompradoEUR: 28450.0,
    ultimaVisita: '06/11/2026',
    dataRegisto: '12/03/2022',
    notasInternas: 'Cliente habitual de joalharia de herança. Apresenta sempre documentação fidedigna e faturas de compra originais.',
    historico: [
      { id: 'h-101', data: '06/11/2026', descricao: 'Lote Ouro 19.2k (58g - Peças Tradicionais)', valor: 3250.0, pesoGramas: 58.0, lojaNome: "Diamante D'ouro - Baixa (Lisboa)" },
      { id: 'h-102', data: '18/09/2026', descricao: 'Brincos e Anel Ouro 18k (24.5g)', valor: 1420.0, pesoGramas: 24.5, lojaNome: "Diamante D'ouro - Baixa (Lisboa)" },
      { id: 'h-103', data: '04/05/2026', descricao: 'Pulseira Ouro Português 19.2k (42g)', valor: 2600.0, pesoGramas: 42.0, lojaNome: "Diamante D'ouro - Chiado (Lisboa)" },
    ],
  },
  {
    id: 'cli-002',
    codigoCliente: 'CLI-002',
    nome: 'Bernardo Castanheira de Melo',
    nif: '245678123',
    telemovel: '+351 934 567 890',
    email: 'bernardo.castanheira@investgold.pt',
    docIdentificacao: 'CC 14209841 8 ZZ1',
    dataNascimento: '28/11/1975',
    morada: 'Avenida da Liberdade 180, 5º',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-002',
    lojaOrigemNome: "Diamante D'ouro - Chiado (Lisboa)",
    status: 'vip',
    totalTransacoes: 14,
    totalCompradoEUR: 89400.0,
    ultimaVisita: '06/11/2026',
    dataRegisto: '08/01/2021',
    notasInternas: 'Investidor e numismata. Vende com regularidade barras 24k com certificado de ensaio da Contrastaria.',
    historico: [
      { id: 'h-201', data: '06/11/2026', descricao: 'Barra 100g Ouro Fino 24k (Investimento)', valor: 8400.0, pesoGramas: 100.0, lojaNome: "Diamante D'ouro - Chiado (Lisboa)" },
      { id: 'h-202', data: '22/10/2026', descricao: 'Lote de Moedas Krugerrand (62.2g)', valor: 5100.0, pesoGramas: 62.2, lojaNome: "Diamante D'ouro - Chiado (Lisboa)" },
      { id: 'h-203', data: '15/07/2026', descricao: '2x Barra 50g Ouro 24k', valor: 8200.0, pesoGramas: 100.0, lojaNome: "Diamante D'ouro - Chiado (Lisboa)" },
    ],
  },
  {
    id: 'cli-003',
    codigoCliente: 'CLI-003',
    nome: 'Joaquim Silva Moreira',
    nif: '198765432',
    telemovel: '+351 961 234 567',
    email: 'j.moreira.joaquim@sapo.pt',
    docIdentificacao: 'CC 09876543 1 XY9',
    dataNascimento: '02/09/1954',
    morada: 'Rua de Santa Catarina 512, 1º',
    cidade: 'Porto',
    lojaOrigemId: 'loj-011',
    lojaOrigemNome: "Diamante D'ouro - Porto Santa Catarina",
    status: 'normal',
    totalTransacoes: 4,
    totalCompradoEUR: 7350.0,
    ultimaVisita: '06/11/2026',
    dataRegisto: '19/04/2023',
    notasInternas: 'Reformado da CP. Vendeu peças familiares e alianças de família.',
    historico: [
      { id: 'h-301', data: '06/11/2026', descricao: 'Cordão Ouro 19.2k (26.2g)', valor: 1450.5, pesoGramas: 26.2, lojaNome: "Diamante D'ouro - Porto Santa Catarina" },
      { id: 'h-302', data: '12/03/2025', descricao: 'Relógio de Bolso Ouro 14k (45g)', valor: 1850.0, pesoGramas: 45.0, lojaNome: "Diamante D'ouro - Porto Santa Catarina" },
    ],
  },
  {
    id: 'cli-004',
    codigoCliente: 'CLI-004',
    nome: 'Guilherme Telles Moniz',
    nif: '234567812',
    telemovel: '+351 917 890 123',
    email: 'telles.moniz@cascaisnet.pt',
    docIdentificacao: 'CC 11223344 5 ZY0',
    dataNascimento: '19/12/1982',
    morada: 'Quinta da Marinha, Lote 12',
    cidade: 'Cascais',
    lojaOrigemId: 'loj-006',
    lojaOrigemNome: "Diamante D'ouro - Cascais",
    status: 'vip',
    totalTransacoes: 7,
    totalCompradoEUR: 34200.0,
    ultimaVisita: '06/11/2026',
    dataRegisto: '11/09/2022',
    notasInternas: 'Colecionador de relojoaria de ouro (Rolex, Omega, Patek) e pratas antigas portuguesas.',
    historico: [
      { id: 'h-401', data: '06/11/2026', descricao: 'Relógio Ouro 18k + Lote Pulseiras (82.4g)', valor: 5890.0, pesoGramas: 82.4, lojaNome: "Diamante D'ouro - Cascais" },
      { id: 'h-402', data: '02/08/2026', descricao: 'Relógio Vintage Ouro 18k (105g)', valor: 7400.0, pesoGramas: 105.0, lojaNome: "Diamante D'ouro - Cascais" },
    ],
  },
  {
    id: 'cli-005',
    codigoCliente: 'CLI-005',
    nome: 'Vítor Manuel Sobral',
    nif: '223456123',
    telemovel: '+351 925 678 901',
    email: 'vitor.sobral.parque@gmail.com',
    docIdentificacao: 'CC 13456789 9 WX3',
    dataNascimento: '30/03/1988',
    morada: 'Alameda dos Oceanos 42, 8º B',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-005',
    lojaOrigemNome: "Diamante D'ouro - Parque das Nações (Lisboa)",
    status: 'normal',
    totalTransacoes: 2,
    totalCompradoEUR: 1650.0,
    ultimaVisita: '06/11/2026',
    dataRegisto: '14/02/2024',
    notasInternas: 'Cliente residente no Parque das Nações. Pagamento efetuado em numerário de acordo com o limite legal.',
    historico: [
      { id: 'h-501', data: '06/11/2026', descricao: 'Anel Solitário e Brincos Ouro 14k (18.8g)', valor: 750.0, pesoGramas: 18.8, lojaNome: "Diamante D'ouro - Parque das Nações (Lisboa)" },
    ],
  },
  {
    id: 'cli-006',
    codigoCliente: 'CLI-006',
    nome: 'Custódio Alves Pimenta',
    nif: '187654321',
    telemovel: '+351 933 456 789',
    email: 'custodio.pimenta@bragatel.pt',
    docIdentificacao: 'CC 08765432 0 XY1',
    dataNascimento: '11/07/1949',
    morada: 'Rua do Souto 88, 3º',
    cidade: 'Braga',
    lojaOrigemId: 'loj-015',
    lojaOrigemNome: "Diamante D'ouro - Braga Centro",
    status: 'vip',
    totalTransacoes: 6,
    totalCompradoEUR: 19800.0,
    ultimaVisita: '05/11/2026',
    dataRegisto: '15/05/2021',
    notasInternas: 'Antigo ourives reformado do Minho. Vende peças de filigrana certificadas e sobras purificadas.',
    historico: [
      { id: 'h-601', data: '05/11/2026', descricao: 'Coração de Viana Antigo + Pulseira Portuguesa (38.9g)', valor: 2180.0, pesoGramas: 38.9, lojaNome: "Diamante D'ouro - Braga Centro" },
    ],
  },
  {
    id: 'cli-007',
    codigoCliente: 'CLI-007',
    nome: 'Teresa Paula Coutinho',
    nif: '256789012',
    telemovel: '+351 967 890 123',
    email: 'teresa.coutinho@alvalade.net',
    docIdentificacao: 'CC 15678901 3 ZX5',
    dataNascimento: '05/10/1979',
    morada: 'Avenida de Roma 74, 2º Esq',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-004',
    lojaOrigemNome: "Diamante D'ouro - Alvalade (Lisboa)",
    status: 'bloqueado',
    totalTransacoes: 1,
    totalCompradoEUR: 0.0,
    ultimaVisita: '05/11/2026',
    dataRegisto: '05/11/2026',
    notasInternas: 'ALERTA DE FRAUDE: Tentativa de levantamento com IBAN em nome de terceiro e documento com indícios de contrafação. Caso reportado à gerência central.',
    historico: [
      { id: 'h-701', data: '05/11/2026', descricao: 'Tentativa Venda Lote Rejeitada (Divergência Titularidade)', valor: 0.0, pesoGramas: 48.0, lojaNome: "Diamante D'ouro - Alvalade (Lisboa)" },
    ],
  },
  {
    id: 'cli-008',
    codigoCliente: 'CLI-008',
    nome: 'António Vasco Loureiro',
    nif: '209876543',
    telemovel: '+351 919 012 345',
    email: 'antonio.loureiro@uc.pt',
    docIdentificacao: 'CC 10987654 7 YY4',
    dataNascimento: '17/04/1963',
    morada: 'Rua da Sofia 102',
    cidade: 'Coimbra',
    lojaOrigemId: 'loj-017',
    lojaOrigemNome: "Diamante D'ouro - Coimbra Baixa",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 4950.0,
    ultimaVisita: '05/11/2026',
    dataRegisto: '20/10/2023',
    notasInternas: 'Docente universitário. Vendeu peças decorativas em prata 925 e moedas históricas de ouro.',
    historico: [
      { id: 'h-801', data: '05/11/2026', descricao: 'Salva de Prata 925 + Moedas Ouro (14g Ouro)', valor: 1620.0, pesoGramas: 14.0, lojaNome: "Diamante D'ouro - Coimbra Baixa" },
    ],
  },
  {
    id: 'cli-009',
    codigoCliente: 'CLI-009',
    nome: 'David Alistair Smith',
    nif: '298765432',
    telemovel: '+351 921 345 678',
    email: 'david.smith.algarve@gmail.com',
    docIdentificacao: 'Passaporte GBR 541098231',
    dataNascimento: '23/08/1958',
    morada: 'Urbanização Vale do Lobo, Villa 84',
    cidade: 'Faro / Almancil',
    lojaOrigemId: 'loj-021',
    lojaOrigemNome: "Diamante D'ouro - Faro Baixa",
    status: 'vip',
    totalTransacoes: 8,
    totalCompradoEUR: 39600.0,
    ultimaVisita: '05/11/2026',
    dataRegisto: '03/06/2022',
    notasInternas: 'Residente não habitual no Algarve. Especialista em moedas de ouro britânicas (Sovereigns George V e Elizabeth II).',
    historico: [
      { id: 'h-901', data: '05/11/2026', descricao: '5x Sovereign George V Ouro 22k (39.9g)', valor: 4120.0, pesoGramas: 39.9, lojaNome: "Diamante D'ouro - Faro Baixa" },
    ],
  },
  {
    id: 'cli-010',
    codigoCliente: 'CLI-010',
    nome: 'Camilo Castelo Branco Neto',
    nif: '265432198',
    telemovel: '+351 936 789 012',
    email: 'camilo.branco@boavistaadvogados.pt',
    docIdentificacao: 'CC 16543219 4 ZZ8',
    dataNascimento: '12/01/1972',
    morada: 'Avenida da Boavista 1450, 4º',
    cidade: 'Porto',
    lojaOrigemId: 'loj-012',
    lojaOrigemNome: "Diamante D'ouro - Porto Boavista",
    status: 'vip',
    totalTransacoes: 11,
    totalCompradoEUR: 54100.0,
    ultimaVisita: '05/11/2026',
    dataRegisto: '14/11/2021',
    notasInternas: 'Advogado com espólios familiares volumosos. Histórico de transações sempre auditado sem divergências.',
    historico: [
      { id: 'h-1001', data: '05/11/2026', descricao: 'Herança Familiar: Faqueiro Prata + Joalharia (95g Ouro)', valor: 6700.0, pesoGramas: 95.0, lojaNome: "Diamante D'ouro - Porto Boavista" },
    ],
  },
  {
    id: 'cli-011',
    codigoCliente: 'CLI-011',
    nome: 'Sílvia Ramos Meireles',
    nif: '241239876',
    telemovel: '+351 915 678 901',
    email: 'silvia.meireles@aveironet.pt',
    docIdentificacao: 'CC 14123987 8 WX2',
    dataNascimento: '08/06/1985',
    morada: 'Canal Central dos Moliceiros 19',
    cidade: 'Aveiro',
    lojaOrigemId: 'loj-018',
    lojaOrigemNome: "Diamante D'ouro - Aveiro",
    status: 'normal',
    totalTransacoes: 2,
    totalCompradoEUR: 2150.0,
    ultimaVisita: '05/11/2026',
    dataRegisto: '10/01/2024',
    notasInternas: 'Cliente particular. Peças pessoais com marcas de contraste legíveis.',
    historico: [
      { id: 'h-1101', data: '05/11/2026', descricao: 'Pulseira Ouro 9k e Alianças (34g)', valor: 980.0, pesoGramas: 34.0, lojaNome: "Diamante D'ouro - Aveiro" },
    ],
  },
  {
    id: 'cli-012',
    codigoCliente: 'CLI-012',
    nome: 'Álvaro Sampaio Dias',
    nif: '210987654',
    telemovel: '+351 963 456 789',
    email: 'alvaro.sampaio.dias@sapo.pt',
    docIdentificacao: 'CC 11098765 2 ZX7',
    dataNascimento: '29/09/1966',
    morada: 'Rua do Choupelo 80',
    cidade: 'Vila Nova de Gaia',
    lojaOrigemId: 'loj-013',
    lojaOrigemNome: "Diamante D'ouro - Vila Nova de Gaia",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 5900.0,
    ultimaVisita: '05/11/2026',
    dataRegisto: '18/05/2023',
    notasInternas: 'Engenheiro civil. Vendeu gargantilha e medalhão da avó.',
    historico: [
      { id: 'h-1201', data: '05/11/2026', descricao: 'Gargantilha Ouro 19.2k com pendente (51.2g)', valor: 2850.0, pesoGramas: 51.2, lojaNome: "Diamante D'ouro - Vila Nova de Gaia" },
    ],
  },
  {
    id: 'cli-013',
    codigoCliente: 'CLI-013',
    nome: 'Emília Augusta Trindade',
    nif: '232109876',
    telemovel: '+351 918 901 234',
    email: 'emilia.trindade@gmail.com',
    docIdentificacao: 'CC 13210987 6 XY3',
    dataNascimento: '14/02/1951',
    morada: 'Rua Coelho da Rocha 94, 1º',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-003',
    lojaOrigemNome: "Diamante D'ouro - Campo de Ourique (Lisboa)",
    status: 'normal',
    totalTransacoes: 4,
    totalCompradoEUR: 4800.0,
    ultimaVisita: '04/11/2026',
    dataRegisto: '02/11/2022',
    notasInternas: 'Moradora de Campo de Ourique há mais de 40 anos. Peças religiosas antigas.',
    historico: [
      { id: 'h-1301', data: '04/11/2026', descricao: 'Anéis e medalhas religiosas Ouro 19.2k (20g)', valor: 1120.0, pesoGramas: 20.0, lojaNome: "Diamante D'ouro - Campo de Ourique (Lisboa)" },
    ],
  },
  {
    id: 'cli-014',
    codigoCliente: 'CLI-014',
    nome: 'Manuel Fernando Nobre',
    nif: '243210987',
    telemovel: '+351 932 109 876',
    email: 'manuel.nobre@setubal.pt',
    docIdentificacao: 'CC 14321098 1 ZZ6',
    dataNascimento: '03/11/1970',
    morada: 'Avenida Luísa Todi 240',
    cidade: 'Setúbal',
    lojaOrigemId: 'loj-010',
    lojaOrigemNome: "Diamante D'ouro - Setúbal",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 4100.0,
    ultimaVisita: '04/11/2026',
    dataRegisto: '22/07/2023',
    notasInternas: 'Técnico de prótese dentária. Vende sobras de ouro técnico e amálgamas com certificado.',
    historico: [
      { id: 'h-1401', data: '04/11/2026', descricao: 'Ouro dental e sobras técnicas (32.1g)', valor: 1890.0, pesoGramas: 32.1, lojaNome: "Diamante D'ouro - Setúbal" },
    ],
  },
  {
    id: 'cli-015',
    codigoCliente: 'CLI-015',
    nome: 'Alzira Guimarães Peixoto',
    nif: '254321098',
    telemovel: '+351 965 432 109',
    email: 'alzira.peixoto@guimaraes.com',
    docIdentificacao: 'CC 15432109 5 WX0',
    dataNascimento: '18/08/1959',
    morada: 'Largo do Toural 15, 2º',
    cidade: 'Guimarães',
    lojaOrigemId: 'loj-016',
    lojaOrigemNome: "Diamante D'ouro - Guimarães",
    status: 'vip',
    totalTransacoes: 6,
    totalCompradoEUR: 18700.0,
    ultimaVisita: '04/11/2026',
    dataRegisto: '12/04/2022',
    notasInternas: 'Colecionadora de filigrana vimaranense e custódias de ouro sacro.',
    historico: [
      { id: 'h-1501', data: '04/11/2026', descricao: 'Custódia de ouro e brincos à rainha (60.5g)', valor: 3400.0, pesoGramas: 60.5, lojaNome: "Diamante D'ouro - Guimarães" },
    ],
  },
  {
    id: 'cli-016',
    codigoCliente: 'CLI-016',
    nome: 'Duarte Pacheco de Carvalho',
    nif: '265432109',
    telemovel: '+351 914 321 098',
    email: 'duarte.carvalho@evorawine.pt',
    docIdentificacao: 'CC 16543210 9 ZX9',
    dataNascimento: '27/05/1976',
    morada: 'Praça do Giraldo 12',
    cidade: 'Évora',
    lojaOrigemId: 'loj-020',
    lojaOrigemNome: "Diamante D'ouro - Évora",
    status: 'vip',
    totalTransacoes: 8,
    totalCompradoEUR: 32100.0,
    ultimaVisita: '04/11/2026',
    dataRegisto: '19/09/2021',
    notasInternas: 'Produtor vinícola do Alentejo. Transaciona moedas imperiais portuguesas e peças D. João V.',
    historico: [
      { id: 'h-1601', data: '04/11/2026', descricao: 'Moedas D. João V em Ouro (32.8g)', valor: 2600.0, pesoGramas: 32.8, lojaNome: "Diamante D'ouro - Évora" },
    ],
  },
  {
    id: 'cli-017',
    codigoCliente: 'CLI-017',
    nome: 'Rosa Maria Figueiredo',
    nif: '276543210',
    telemovel: '+351 931 209 876',
    email: 'rosa.figueiredo@almada.pt',
    docIdentificacao: 'CC 17654321 3 YY8',
    dataNascimento: '09/12/1981',
    morada: 'Avenida Bento Gonçalves 45',
    cidade: 'Almada',
    lojaOrigemId: 'loj-009',
    lojaOrigemNome: "Diamante D'ouro - Almada",
    status: 'bloqueado',
    totalTransacoes: 0,
    totalCompradoEUR: 0.0,
    ultimaVisita: '03/11/2026',
    dataRegisto: '03/11/2026',
    notasInternas: 'BLOQUEADA POR SUSPEITA DE CONTRAFAÇÃO: Apresentou pulseira com banho dourado pesando 65g que falhou nos testes de ácido nítrico e densitometria.',
    historico: [],
  },
  {
    id: 'cli-018',
    codigoCliente: 'CLI-018',
    nome: 'Hans Peter Becker',
    nif: '287654321',
    telemovel: '+351 928 765 432',
    email: 'hans.becker@portimaomarina.de',
    docIdentificacao: 'Passaporte DEU 984120931',
    dataNascimento: '04/04/1953',
    morada: 'Marina de Portimão, Bloco C, Apt 204',
    cidade: 'Portimão',
    lojaOrigemId: 'loj-022',
    lojaOrigemNome: "Diamante D'ouro - Portimão",
    status: 'vip',
    totalTransacoes: 10,
    totalCompradoEUR: 41900.0,
    ultimaVisita: '03/11/2026',
    dataRegisto: '15/01/2022',
    notasInternas: 'Residente alemão aposentado no Algarve. Fornecedor frequente de moedas de ouro 1oz bullion.',
    historico: [
      { id: 'h-1801', data: '03/11/2026', descricao: 'Krugerrand Ouro 1oz (31.1g)', valor: 1750.0, pesoGramas: 31.1, lojaNome: "Diamante D'ouro - Portimão" },
    ],
  },
  {
    id: 'cli-019',
    codigoCliente: 'CLI-019',
    nome: 'Lúcia Faria Valadares',
    nif: '298765430',
    telemovel: '+351 969 876 543',
    email: 'lucia.valadares@matosinhos.net',
    docIdentificacao: 'CC 19876543 7 ZZ3',
    dataNascimento: '21/03/1969',
    morada: 'Rua Brito Capelo 310, 2º',
    cidade: 'Matosinhos',
    lojaOrigemId: 'loj-014',
    lojaOrigemNome: "Diamante D'ouro - Matosinhos",
    status: 'normal',
    totalTransacoes: 4,
    totalCompradoEUR: 6800.0,
    ultimaVisita: '03/11/2026',
    dataRegisto: '17/08/2022',
    notasInternas: 'Cliente fiel da loja de Matosinhos. Transaciona anéis de brasão e peças tradicionais.',
    historico: [
      { id: 'h-1901', data: '03/11/2026', descricao: 'Pulseira Grossa e Anel de Brasão (41g)', valor: 2300.0, pesoGramas: 41.0, lojaNome: "Diamante D'ouro - Matosinhos" },
    ],
  },
  {
    id: 'cli-020',
    codigoCliente: 'CLI-020',
    nome: 'Fernando Jorge Matos',
    nif: '209123456',
    telemovel: '+351 913 210 987',
    email: 'fernando.matos@leirianet.pt',
    docIdentificacao: 'CC 10912345 8 WX1',
    dataNascimento: '14/10/1973',
    morada: 'Largo da Sé 8',
    cidade: 'Leiria',
    lojaOrigemId: 'loj-019',
    lojaOrigemNome: "Diamante D'ouro - Leiria",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 3950.0,
    ultimaVisita: '03/11/2026',
    dataRegisto: '28/02/2023',
    notasInternas: 'Comerciante em Leiria. Vendeu alianças e brincos em ouro de lei.',
    historico: [
      { id: 'h-2001', data: '03/11/2026', descricao: 'Alianças de casamento e brincos (24.3g)', valor: 1350.0, pesoGramas: 24.3, lojaNome: "Diamante D'ouro - Leiria" },
    ],
  },
  {
    id: 'cli-021',
    codigoCliente: 'CLI-021',
    nome: 'João Rodrigo Alvim',
    nif: '219876543',
    telemovel: '+351 938 765 432',
    email: 'joao.alvim@cascais.org',
    docIdentificacao: 'CC 11987654 4 ZX2',
    dataNascimento: '02/12/1980',
    morada: 'Rua Visconde da Luz 14',
    cidade: 'Cascais',
    lojaOrigemId: 'loj-006',
    lojaOrigemNome: "Diamante D'ouro - Cascais",
    status: 'vip',
    totalTransacoes: 9,
    totalCompradoEUR: 46200.0,
    ultimaVisita: '02/11/2026',
    dataRegisto: '10/05/2021',
    notasInternas: 'Antiquário em Cascais com licença de contrastaria. Fornece lotes com relatório de toque.',
    historico: [
      { id: 'h-2101', data: '02/11/2026', descricao: 'Salva D. Maria em Prata + Ouro 18k (72g)', valor: 4200.0, pesoGramas: 72.0, lojaNome: "Diamante D'ouro - Cascais" },
    ],
  },
  {
    id: 'cli-022',
    codigoCliente: 'CLI-022',
    nome: 'Margarida Sousa Tavares',
    nif: '228765432',
    telemovel: '+351 962 109 876',
    email: 'm.sousa.tavares@sapo.pt',
    docIdentificacao: 'CC 12876543 6 YY7',
    dataNascimento: '19/05/1965',
    morada: 'Rua Garrett 82, 3º Esq',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-002',
    lojaOrigemNome: "Diamante D'ouro - Chiado (Lisboa)",
    status: 'vip',
    totalTransacoes: 8,
    totalCompradoEUR: 31800.0,
    ultimaVisita: '01/11/2026',
    dataRegisto: '04/09/2022',
    notasInternas: 'Herdeira de família nobre do Chiado. Peças de alta joalharia francesa e portuguesa.',
    historico: [
      { id: 'h-2201', data: '01/11/2026', descricao: 'Broche Ouro Branco e Diamantes (28g)', valor: 2950.0, pesoGramas: 28.0, lojaNome: "Diamante D'ouro - Chiado (Lisboa)" },
    ],
  },
  {
    id: 'cli-023',
    codigoCliente: 'CLI-023',
    nome: 'Carlos Alberto Sequeira',
    nif: '237654321',
    telemovel: '+351 917 654 321',
    email: 'carlos.sequeira@sintra.pt',
    docIdentificacao: 'CC 13765432 0 ZZ4',
    dataNascimento: '15/09/1957',
    morada: 'Volta do Duche 22',
    cidade: 'Sintra',
    lojaOrigemId: 'loj-007',
    lojaOrigemNome: "Diamante D'ouro - Sintra",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 3600.0,
    ultimaVisita: '31/10/2026',
    dataRegisto: '14/03/2023',
    notasInternas: 'Residente na vila de Sintra. Vendeu medalhas de prata e anéis antigos.',
    historico: [
      { id: 'h-2301', data: '31/10/2026', descricao: 'Lote de Medalhas e Fivelas Antigas (30g)', valor: 1400.0, pesoGramas: 30.0, lojaNome: "Diamante D'ouro - Sintra" },
    ],
  },
  {
    id: 'cli-024',
    codigoCliente: 'CLI-024',
    nome: 'Vasco Henrique Guedes',
    nif: '246543210',
    telemovel: '+351 935 432 109',
    email: 'vasco.guedes@amadora.pt',
    docIdentificacao: 'CC 14654321 8 WX9',
    dataNascimento: '11/11/1984',
    morada: 'Avenida General Humberto Delgado 40',
    cidade: 'Amadora',
    lojaOrigemId: 'loj-008',
    lojaOrigemNome: "Diamante D'ouro - Amadora",
    status: 'normal',
    totalTransacoes: 2,
    totalCompradoEUR: 1950.0,
    ultimaVisita: '30/10/2026',
    dataRegisto: '22/08/2024',
    notasInternas: 'Cliente particular. Verificação de NIF e telemóvel concluída sem pendências.',
    historico: [
      { id: 'h-2401', data: '30/10/2026', descricao: 'Cordão Masculino Ouro 19.2k (21g)', valor: 1100.0, pesoGramas: 21.0, lojaNome: "Diamante D'ouro - Amadora" },
    ],
  },
  {
    id: 'cli-025',
    codigoCliente: 'CLI-025',
    nome: 'Patrícia Alexandra Bessa',
    nif: '255432109',
    telemovel: '+351 964 321 098',
    email: 'patricia.bessa@portonet.pt',
    docIdentificacao: 'CC 15543210 2 ZX1',
    dataNascimento: '07/07/1990',
    morada: 'Rua de Passos Manuel 89, 4º',
    cidade: 'Porto',
    lojaOrigemId: 'loj-011',
    lojaOrigemNome: "Diamante D'ouro - Porto Santa Catarina",
    status: 'vip',
    totalTransacoes: 7,
    totalCompradoEUR: 24700.0,
    ultimaVisita: '29/10/2026',
    dataRegisto: '19/11/2022',
    notasInternas: 'Designer de joias. Fornece peças descartadas e restos de fundição com toque comprovado.',
    historico: [
      { id: 'h-2501', data: '29/10/2026', descricao: 'Restos de bancada e lingote 18k (64g)', valor: 3100.0, pesoGramas: 64.0, lojaNome: "Diamante D'ouro - Porto Santa Catarina" },
    ],
  },
  {
    id: 'cli-026',
    codigoCliente: 'CLI-026',
    nome: 'Igor Semenov',
    nif: '264321098',
    telemovel: '+351 916 543 210',
    email: 'igor.semenov@lisboainvest.com',
    docIdentificacao: 'Passaporte UKR 784910293',
    dataNascimento: '25/01/1987',
    morada: 'Rua do Polo Norte 12, Apt 501',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-005',
    lojaOrigemNome: "Diamante D'ouro - Parque das Nações (Lisboa)",
    status: 'bloqueado',
    totalTransacoes: 0,
    totalCompradoEUR: 0.0,
    ultimaVisita: '28/10/2026',
    dataRegisto: '28/10/2026',
    notasInternas: 'BLOQUEADO: Falha na justificação de proveniência de 3 barras sem carimbo ou selo de refinaria. Cumprimento da Lei 83/2017 (Branqueamento de Capitais).',
    historico: [],
  },
  {
    id: 'cli-027',
    codigoCliente: 'CLI-027',
    nome: 'Helena Maria Saldanha',
    nif: '273210987',
    telemovel: '+351 937 654 321',
    email: 'helena.saldanha@funchal.pt',
    docIdentificacao: 'CC 17321098 7 YY5',
    dataNascimento: '04/09/1962',
    morada: 'Rua do Aljube 44',
    cidade: 'Funchal (Madeira)',
    lojaOrigemId: 'loj-023',
    lojaOrigemNome: "Diamante D'ouro - Funchal Sé (Madeira)",
    status: 'vip',
    totalTransacoes: 8,
    totalCompradoEUR: 27900.0,
    ultimaVisita: '27/10/2026',
    dataRegisto: '15/04/2021',
    notasInternas: 'Cliente residente no Funchal. Envia lotes com guia de transporte aéreo e seguro assegurado.',
    historico: [
      { id: 'h-2701', data: '27/10/2026', descricao: 'Colar de Pérolas com Fecho Ouro 19.2k e Anel (44g)', valor: 2450.0, pesoGramas: 44.0, lojaNome: "Diamante D'ouro - Funchal Sé (Madeira)" },
    ],
  },
  {
    id: 'cli-028',
    codigoCliente: 'CLI-028',
    nome: 'Bento Medeiros Cabral',
    nif: '282109876',
    telemovel: '+351 963 210 987',
    email: 'bento.cabral@acores.pt',
    docIdentificacao: 'CC 18210987 1 ZZ8',
    dataNascimento: '16/06/1971',
    morada: 'Largo da Matriz 19',
    cidade: 'Ponta Delgada (Açores)',
    lojaOrigemId: 'loj-024',
    lojaOrigemNome: "Diamante D'ouro - Ponta Delgada (Açores)",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 4200.0,
    ultimaVisita: '26/10/2026',
    dataRegisto: '11/02/2023',
    notasInternas: 'Comerciante em São Miguel. Vende ouro tradicional açoriano com toque 800.',
    historico: [
      { id: 'h-2801', data: '26/10/2026', descricao: 'Moedas antigas dos Açores e Aliança Ouro (35g)', valor: 1950.0, pesoGramas: 35.0, lojaNome: "Diamante D'ouro - Ponta Delgada (Açores)" },
    ],
  },
  {
    id: 'cli-029',
    codigoCliente: 'CLI-029',
    nome: 'Rui Miguel Cordeiro',
    nif: '291098765',
    telemovel: '+351 919 876 543',
    email: 'rui.cordeiro@braga.org',
    docIdentificacao: 'CC 19109876 5 WX4',
    dataNascimento: '28/08/1983',
    morada: 'Praça Conde de Agrolongo 50',
    cidade: 'Braga',
    lojaOrigemId: 'loj-015',
    lojaOrigemNome: "Diamante D'ouro - Braga Centro",
    status: 'normal',
    totalTransacoes: 2,
    totalCompradoEUR: 2300.0,
    ultimaVisita: '25/10/2026',
    dataRegisto: '03/05/2024',
    notasInternas: 'Engenheiro de automação. Transacionou pulseira de família.',
    historico: [
      { id: 'h-2901', data: '25/10/2026', descricao: 'Pulseira Ouro 19.2k (30g)', valor: 1550.0, pesoGramas: 30.0, lojaNome: "Diamante D'ouro - Braga Centro" },
    ],
  },
  {
    id: 'cli-030',
    codigoCliente: 'CLI-030',
    nome: 'Filomena Esteves Caldas',
    nif: '208765432',
    telemovel: '+351 934 321 098',
    email: 'filomena.caldas@coimbra.net',
    docIdentificacao: 'CC 10876543 9 ZX3',
    dataNascimento: '13/11/1955',
    morada: 'Praça 8 de Maio 31',
    cidade: 'Coimbra',
    lojaOrigemId: 'loj-017',
    lojaOrigemNome: "Diamante D'ouro - Coimbra Baixa",
    status: 'vip',
    totalTransacoes: 6,
    totalCompradoEUR: 21400.0,
    ultimaVisita: '24/10/2026',
    dataRegisto: '09/07/2021',
    notasInternas: 'Cliente VIP assídua em Coimbra. Vende relógios e joias antigas de coleção.',
    historico: [
      { id: 'h-3001', data: '24/10/2026', descricao: 'Relógio Ouro 18k Longines + Pulseira (50g)', valor: 2800.0, pesoGramas: 50.0, lojaNome: "Diamante D'ouro - Coimbra Baixa" },
    ],
  },
  {
    id: 'cli-031',
    codigoCliente: 'CLI-031',
    nome: 'Gonçalo Nuno Resende',
    nif: '217654320',
    telemovel: '+351 965 210 987',
    email: 'goncalo.resende@aveiro.pt',
    docIdentificacao: 'CC 11765432 3 YY1',
    dataNascimento: '01/01/1986',
    morada: 'Rua Direita 140',
    cidade: 'Aveiro',
    lojaOrigemId: 'loj-018',
    lojaOrigemNome: "Diamante D'ouro - Aveiro",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 3100.0,
    ultimaVisita: '22/10/2026',
    dataRegisto: '14/12/2023',
    notasInternas: 'Comerciante em Aveiro. Peças conferidas e pagamento via SEPA.',
    historico: [
      { id: 'h-3101', data: '22/10/2026', descricao: 'Alianças e Medalhas em Ouro 14k (32g)', valor: 1250.0, pesoGramas: 32.0, lojaNome: "Diamante D'ouro - Aveiro" },
    ],
  },
  {
    id: 'cli-032',
    codigoCliente: 'CLI-032',
    nome: 'Inês Filipa Lourenço',
    nif: '226543219',
    telemovel: '+351 912 901 234',
    email: 'ines.lourenco@lisboalaw.pt',
    docIdentificacao: 'CC 12654321 7 ZZ5',
    dataNascimento: '19/04/1992',
    morada: 'Rua do Ouro 190, 3º',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-001',
    lojaOrigemNome: "Diamante D'ouro - Baixa (Lisboa)",
    status: 'normal',
    totalTransacoes: 2,
    totalCompradoEUR: 2800.0,
    ultimaVisita: '20/10/2026',
    dataRegisto: '15/06/2024',
    notasInternas: 'Advogada na Baixa. Vendeu joias antigas de prata e anel solitário.',
    historico: [
      { id: 'h-3201', data: '20/10/2026', descricao: 'Solitário Ouro Branco 18k e Diamante (12g)', valor: 1400.0, pesoGramas: 12.0, lojaNome: "Diamante D'ouro - Baixa (Lisboa)" },
    ],
  },
  {
    id: 'cli-033',
    codigoCliente: 'CLI-033',
    nome: 'Tiago Alexandre Saraiva',
    nif: '235432108',
    telemovel: '+351 936 543 210',
    email: 'tiago.saraiva@gaia.pt',
    docIdentificacao: 'CC 13543210 1 WX8',
    dataNascimento: '12/10/1988',
    morada: 'Avenida da República 1800, 2º',
    cidade: 'Vila Nova de Gaia',
    lojaOrigemId: 'loj-013',
    lojaOrigemNome: "Diamante D'ouro - Vila Nova de Gaia",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 4100.0,
    ultimaVisita: '19/10/2026',
    dataRegisto: '20/09/2023',
    notasInternas: 'Cliente particular. Verificado sem anomalias.',
    historico: [
      { id: 'h-3301', data: '19/10/2026', descricao: 'Colar e pulseira Ouro 19.2k (36g)', valor: 1950.0, pesoGramas: 36.0, lojaNome: "Diamante D'ouro - Vila Nova de Gaia" },
    ],
  },
  {
    id: 'cli-034',
    codigoCliente: 'CLI-034',
    nome: 'Raquel Maria Fontes',
    nif: '244321097',
    telemovel: '+351 967 654 321',
    email: 'raquel.fontes@chiado.org',
    docIdentificacao: 'CC 14432109 5 ZX6',
    dataNascimento: '24/06/1977',
    morada: 'Calçada do Sacramento 14',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-002',
    lojaOrigemNome: "Diamante D'ouro - Chiado (Lisboa)",
    status: 'vip',
    totalTransacoes: 8,
    totalCompradoEUR: 36500.0,
    ultimaVisita: '18/10/2026',
    dataRegisto: '11/03/2022',
    notasInternas: 'Curadora de arte e joalharia histórica. Vendas regulares de peças de autor dos séculos XIX e XX.',
    historico: [
      { id: 'h-3401', data: '18/10/2026', descricao: 'Broche Art Déco Platina e Ouro 18k (38g)', valor: 3400.0, pesoGramas: 38.0, lojaNome: "Diamante D'ouro - Chiado (Lisboa)" },
    ],
  },
  {
    id: 'cli-035',
    codigoCliente: 'CLI-035',
    nome: 'Artur Jorge Marinho',
    nif: '253210986',
    telemovel: '+351 918 765 432',
    email: 'artur.marinho@matosinhosporto.pt',
    docIdentificacao: 'CC 15321098 9 YY0',
    dataNascimento: '08/03/1964',
    morada: 'Avenida Norton de Matos 45',
    cidade: 'Matosinhos',
    lojaOrigemId: 'loj-014',
    lojaOrigemNome: "Diamante D'ouro - Matosinhos",
    status: 'normal',
    totalTransacoes: 4,
    totalCompradoEUR: 5700.0,
    ultimaVisita: '16/10/2026',
    dataRegisto: '05/01/2023',
    notasInternas: 'Empresário do setor conserveiro. Vendeu peças de família em ouro amarelo.',
    historico: [
      { id: 'h-3501', data: '16/10/2026', descricao: 'Relógio de Bolso Ouro 18k e Medalhas (42g)', valor: 2200.0, pesoGramas: 42.0, lojaNome: "Diamante D'ouro - Matosinhos" },
    ],
  },
  {
    id: 'cli-036',
    codigoCliente: 'CLI-036',
    nome: 'Susana Cristina Antunes',
    nif: '262109875',
    telemovel: '+351 933 210 987',
    email: 'susana.antunes@setubalnet.pt',
    docIdentificacao: 'CC 16210987 3 ZZ2',
    dataNascimento: '15/12/1982',
    morada: 'Rua Serpa Pinto 77',
    cidade: 'Setúbal',
    lojaOrigemId: 'loj-010',
    lojaOrigemNome: "Diamante D'ouro - Setúbal",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 3800.0,
    ultimaVisita: '15/10/2026',
    dataRegisto: '18/07/2023',
    notasInternas: 'Cliente habitual em Setúbal. Processos de venda em conformidade.',
    historico: [
      { id: 'h-3601', data: '15/10/2026', descricao: 'Cordão e Brincos Ouro 19.2k (25g)', valor: 1450.0, pesoGramas: 25.0, lojaNome: "Diamante D'ouro - Setúbal" },
    ],
  },
  {
    id: 'cli-037',
    codigoCliente: 'CLI-037',
    nome: 'Gisela Maria Brandão',
    nif: '271098764',
    telemovel: '+351 961 876 543',
    email: 'gisela.brandao@portocentro.pt',
    docIdentificacao: 'CC 17109876 7 WX7',
    dataNascimento: '22/07/1974',
    morada: 'Rua do Almada 210, 2º',
    cidade: 'Porto',
    lojaOrigemId: 'loj-012',
    lojaOrigemNome: "Diamante D'ouro - Porto Boavista",
    status: 'vip',
    totalTransacoes: 9,
    totalCompradoEUR: 38900.0,
    ultimaVisita: '14/10/2026',
    dataRegisto: '08/04/2022',
    notasInternas: 'Arquiteta no Porto. Vendedora recorrente de pratas portuguesas antigas e joias clássicas.',
    historico: [
      { id: 'h-3701', data: '14/10/2026', descricao: 'Faqueiro Prata 833 (2.4kg) + Broche Ouro (22g)', valor: 3100.0, pesoGramas: 22.0, lojaNome: "Diamante D'ouro - Porto Boavista" },
    ],
  },
  {
    id: 'cli-038',
    codigoCliente: 'CLI-038',
    nome: 'Pedro Manuel Abrantes',
    nif: '280987653',
    telemovel: '+351 915 210 987',
    email: 'pedro.abrantes@alvalade.pt',
    docIdentificacao: 'CC 18098765 1 ZX8',
    dataNascimento: '30/09/1986',
    morada: 'Rua Acácio Paiva 18',
    cidade: 'Lisboa',
    lojaOrigemId: 'loj-004',
    lojaOrigemNome: "Diamante D'ouro - Alvalade (Lisboa)",
    status: 'normal',
    totalTransacoes: 3,
    totalCompradoEUR: 4100.0,
    ultimaVisita: '12/10/2026',
    dataRegisto: '19/11/2023',
    notasInternas: 'Cliente particular. Verificação NIF validada com sucesso.',
    historico: [
      { id: 'h-3801', data: '12/10/2026', descricao: 'Alianças e Anel Solitário Ouro 19.2k (28g)', valor: 1600.0, pesoGramas: 28.0, lojaNome: "Diamante D'ouro - Alvalade (Lisboa)" },
    ],
  },
  {
    id: 'cli-039',
    codigoCliente: 'CLI-039',
    nome: 'Marco Aurélio Simões',
    nif: '299876541',
    telemovel: '+351 927 654 321',
    email: 'marco.simoes.faro@gmail.com',
    docIdentificacao: 'CC 19987654 4 YY9',
    dataNascimento: '11/05/1979',
    morada: 'Rua de Santo António 48',
    cidade: 'Faro',
    lojaOrigemId: 'loj-021',
    lojaOrigemNome: "Diamante D'ouro - Faro Baixa",
    status: 'normal',
    totalTransacoes: 4,
    totalCompradoEUR: 5800.0,
    ultimaVisita: '10/10/2026',
    dataRegisto: '14/02/2023',
    notasInternas: 'Comerciante local em Faro. Pagamentos regulares por transferência bancária.',
    historico: [
      { id: 'h-3901', data: '10/10/2026', descricao: 'Moedas de Ouro D. Luís I (28.5g)', valor: 2150.0, pesoGramas: 28.5, lojaNome: "Diamante D'ouro - Faro Baixa" },
    ],
  },
  {
    id: 'cli-040',
    codigoCliente: 'CLI-040',
    nome: 'Sebastião Paiva Couceiro',
    nif: '207654329',
    telemovel: '+351 931 876 543',
    email: 'sebastiao.couceiro@sintraheritage.pt',
    docIdentificacao: 'CC 10765432 8 ZZ7',
    dataNascimento: '03/02/1950',
    morada: 'São Pedro de Sintra, Quinta dos Cedros',
    cidade: 'Sintra',
    lojaOrigemId: 'loj-007',
    lojaOrigemNome: "Diamante D'ouro - Sintra",
    status: 'vip',
    totalTransacoes: 12,
    totalCompradoEUR: 62400.0,
    ultimaVisita: '08/10/2026',
    dataRegisto: '10/01/2021',
    notasInternas: 'Colecionador de heráldica e joalharia aristocrática. Histórico impecável de conformidade legal e documentação.',
    historico: [
      { id: 'h-4001', data: '08/10/2026', descricao: 'Par de Castiçais em Prata de Lei + Joias Ouro 19.2k (98g)', valor: 5400.0, pesoGramas: 98.0, lojaNome: "Diamante D'ouro - Sintra" },
      { id: 'h-4002', data: '15/06/2026', descricao: 'Anel com Brasão Familiar e Pulseira de Toque (64g)', valor: 3800.0, pesoGramas: 64.0, lojaNome: "Diamante D'ouro - Sintra" },
    ],
  },
];

export const ClientManagement: React.FC<ClientManagementProps> = ({ onNavigate }) => {
  const { data: clients, loading, createClient, toggleBlockClient, toggleVipClient } = useClients();

  // Filtros de Pesquisa & Visualização
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ClientStatus>('todos');
  const [storeFilter, setStoreFilter] = useState<string>('todas');

  // Modais de Ação
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // Form State para Novo Cliente
  const [newClient, setNewClient] = useState({
    nome: '',
    nif: '',
    telemovel: '+351 ',
    email: '',
    docIdentificacao: '',
    dataNascimento: '',
    morada: '',
    cidade: 'Lisboa',
    lojaOrigemId: CLIENT_STORES[0].id,
    status: 'normal' as ClientStatus,
    notasInternas: '',
  });

  // =========================================================
  // 1. STATS CALCULADAS EM TEMPO REAL
  // =========================================================
  const { totalClients, vipCount, blockedCount, totalVolumeEUR } = useMemo(() => {
    let vip = 0;
    let blocked = 0;
    let volume = 0;

    clients.forEach((c) => {
      if (c.status === 'vip') vip++;
      if (c.status === 'bloqueado') blocked++;
      volume += c.totalCompradoEUR;
    });

    return {
      totalClients: clients.length,
      vipCount: vip,
      blockedCount: blocked,
      totalVolumeEUR: volume,
    };
  }, [clients]);

  // Formatação Moeda EUR
  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // =========================================================
  // 2. FILTRAGEM DE CLIENTES
  // =========================================================
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Filtro Status
      if (statusFilter !== 'todos' && client.status !== statusFilter) {
        return false;
      }

      // Filtro Loja de Origem
      if (storeFilter !== 'todas' && client.lojaOrigemId !== storeFilter) {
        return false;
      }

      // Pesquisa por Texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchNome = client.nome.toLowerCase().includes(q);
        const matchNif = client.nif.includes(q);
        const matchTel = client.telemovel.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
        const matchDoc = client.docIdentificacao.toLowerCase().includes(q);
        const matchEmail = client.email.toLowerCase().includes(q);
        const matchCidade = client.cidade.toLowerCase().includes(q);
        const matchLoja = client.lojaOrigemNome.toLowerCase().includes(q);

        if (!matchNome && !matchNif && !matchTel && !matchDoc && !matchEmail && !matchCidade && !matchLoja) {
          return false;
        }
      }

      return true;
    });
  }, [clients, statusFilter, storeFilter, searchTerm]);

  // =========================================================
  // 3. AÇÕES SOBRE CLIENTES (MUDAR STATUS / CRIAR)
  // =========================================================
  const handleToggleBlockClient = async (clientId: string) => {
    await toggleBlockClient(clientId);

    if (selectedClient && selectedClient.id === clientId) {
      setSelectedClient((prev) =>
        prev
          ? {
              ...prev,
              status: prev.status === 'bloqueado' ? 'normal' : 'bloqueado',
            }
          : null
      );
    }
  };

  const handleToggleVipClient = async (clientId: string) => {
    await toggleVipClient(clientId);

    if (selectedClient && selectedClient.id === clientId) {
      setSelectedClient((prev) =>
        prev
          ? {
              ...prev,
              status: prev.status === 'vip' ? 'normal' : 'vip',
            }
          : null
      );
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.nome.trim() || !newClient.nif.trim()) return;

    const storeObj = CLIENT_STORES.find((s) => s.id === newClient.lojaOrigemId);
    const newId = `cli-${Date.now()}`;
    const nextCode = `CLI-${String(clients.length + 1).padStart(3, '0')}`;

    const created: Client = {
      id: newId,
      codigoCliente: nextCode,
      nome: newClient.nome.trim(),
      nif: newClient.nif.trim(),
      telemovel: newClient.telemovel.trim(),
      email: newClient.email.trim() || `${newClient.nome.toLowerCase().replace(/\s+/g, '.')}@email.pt`,
      docIdentificacao: newClient.docIdentificacao.trim() || 'CC Nacional Não Declarado',
      dataNascimento: newClient.dataNascimento || '01/01/1980',
      morada: newClient.morada.trim() || 'Morada não especificada',
      cidade: newClient.cidade.trim() || 'Lisboa',
      lojaOrigemId: newClient.lojaOrigemId,
      lojaOrigemNome: storeObj ? storeObj.nome : "Diamante D'ouro - Baixa (Lisboa)",
      status: newClient.status,
      totalTransacoes: 0,
      totalCompradoEUR: 0.0,
      ultimaVisita: 'Hoje',
      dataRegisto: new Date().toLocaleDateString('pt-PT'),
      notasInternas: newClient.notasInternas.trim() || 'Cliente registado manualmente no sistema Diamante OS.',
      historico: [],
    };

    await createClient(created);
    setIsNewClientModalOpen(false);
    setNewClient({
      nome: '',
      nif: '',
      telemovel: '+351 ',
      email: '',
      docIdentificacao: '',
      dataNascimento: '',
      morada: '',
      cidade: 'Lisboa',
      lojaOrigemId: CLIENT_STORES[0].id,
      status: 'normal',
      notasInternas: '',
    });
  };

  // Helper de Badge de Status
  const renderStatusBadge = (status: ClientStatus) => {
    switch (status) {
      case 'vip':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-[#D4AF37]/30 shadow-xs shadow-amber-500/10">
            <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
            <span>VIP Especial</span>
          </span>
        );
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Normal Conforme</span>
          </span>
        );
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs shadow-rose-500/10">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>Blacklist / Bloqueado</span>
          </span>
        );
    }
  };

  // Iniciais do Nome
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
                <Users className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Clientes & Fornecedores
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Ficha de Identificação Legal, Rastreabilidade de Peças e Histórico de Confiança
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
                      Lojas
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/finance')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Tesouraria
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          >
            <UserPlus className="w-4 h-4 stroke-[3]" />
            <span>Novo Cliente</span>
          </button>
        </header>

        {/* =========================================================
            2. STATS CARDS
           ========================================================= */}
        <section
          aria-label="Indicadores da Carteira de Clientes"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6"
        >
          {/* Card 1: Total Clientes */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Clientes Registados
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {totalClients}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Volume liquidado: <strong className="text-white font-mono">{formatEUR(totalVolumeEUR)}</strong>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: VIPs (>5 transações) */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Clientes VIP (&gt;5 Transações)
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                {vipCount}
              </p>
              <p className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
                Alta fidelização e verificação prévia
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Star className="w-6 h-6 fill-[#D4AF37]/30" />
            </div>
          </div>

          {/* Card 3: Blacklist / Bloqueados */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Blacklist / Bloqueados
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-400">
                {blockedCount}
              </p>
              <p className="text-[11px] text-rose-400/90 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Divergências legais ou contrafações
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* =========================================================
            3. BARRA DE PESQUISA & FILTROS RÁPIDOS
           ========================================================= */}
        <section
          aria-label="Filtros e Pesquisa de Clientes"
          className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
        >
          {/* Linha 1: Pesquisa + Filtro por Loja */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome, NIF, telemóvel, CC ou cidade..."
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

            {/* Dropdown de Balcão de Origem */}
            <div className="w-full md:w-72 shrink-0">
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
              >
                <option value="todas">Todos os Balcões (24 Lojas)</option>
                {CLIENT_STORES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Filtros Pill por Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Status:
              </span>
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'todos'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({clients.length})
              </button>
              <button
                onClick={() => setStatusFilter('vip')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'vip'
                    ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-[#D4AF37] border border-slate-800'
                }`}
              >
                VIP ({vipCount})
              </button>
              <button
                onClick={() => setStatusFilter('normal')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'normal'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-emerald-400 border border-slate-800'
                }`}
              >
                Normal ({clients.filter((c) => c.status === 'normal').length})
              </button>
              <button
                onClick={() => setStatusFilter('bloqueado')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'bloqueado'
                    ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-rose-400 border border-slate-800'
                }`}
              >
                Blacklist ({blockedCount})
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Mostrando <strong className="text-white">{filteredClients.length}</strong> de {clients.length} clientes
            </div>
          </div>
        </section>

        {/* =========================================================
            4. LISTA / TABELA RESPONSIVA DE CLIENTES
           ========================================================= */}
        <section aria-label="Carteira de Clientes">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
              <Users className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
              <p className="text-base font-bold text-white">Nenhum cliente encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não existem clientes que correspondam aos filtros de pesquisa selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('todos');
                  setStoreFilter('todas');
                }}
                className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
              >
                Limpar filtros de pesquisa
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
                        <th className="py-3.5 px-4">Cliente / Código</th>
                        <th className="py-3.5 px-4">NIF & Identificação</th>
                        <th className="py-3.5 px-4">Contacto</th>
                        <th className="py-3.5 px-4">Balcão Frequente</th>
                        <th className="py-3.5 px-4">Total Comprado</th>
                        <th className="py-3.5 px-4">Última Visita</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredClients.map((client) => (
                        <tr
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Nome e Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  client.status === 'vip'
                                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                                    : client.status === 'bloqueado'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                                }`}
                              >
                                {getInitials(client.nome)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors truncate max-w-[180px]">
                                  {client.nome}
                                </p>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {client.codigoCliente} &bull; {client.cidade}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* NIF */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-100">
                              {client.nif}
                            </span>
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                              {client.docIdentificacao}
                            </p>
                          </td>

                          {/* Contacto */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{client.telemovel}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              {client.email}
                            </p>
                          </td>

                          {/* Balcão */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 max-w-[170px] truncate" title={client.lojaOrigemNome}>
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-slate-200">
                                {client.lojaOrigemNome.replace("Diamante D'ouro - ", '')}
                              </span>
                            </div>
                          </td>

                          {/* Total Comprado */}
                          <td className="py-3.5 px-4">
                            <p className="font-mono font-bold text-white text-xs">
                              {formatEUR(client.totalCompradoEUR)}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              {client.totalTransacoes} {client.totalTransacoes === 1 ? 'venda' : 'vendas'}
                            </p>
                          </td>

                          {/* Última Visita */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            {client.ultimaVisita}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(client.status)}
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleVipClient(client.id)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  client.status === 'vip'
                                    ? 'bg-amber-500/20 text-[#D4AF37] border-[#D4AF37]/40'
                                    : 'bg-slate-800 text-slate-400 hover:text-[#D4AF37] border-slate-700'
                                }`}
                                title={client.status === 'vip' ? 'Remover estatuto VIP' : 'Promover a VIP'}
                              >
                                <Star className={`w-3.5 h-3.5 ${client.status === 'vip' ? 'fill-[#D4AF37]' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleToggleBlockClient(client.id)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  client.status === 'bloqueado'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : 'bg-slate-800 text-slate-400 hover:text-rose-400 border-slate-700'
                                }`}
                                title={client.status === 'bloqueado' ? 'Desbloquear Cliente' : 'Bloquear / Colocar na Blacklist'}
                              >
                                {client.status === 'bloqueado' ? (
                                  <Unlock className="w-3.5 h-3.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => setSelectedClient(client)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] border border-slate-700 transition-colors cursor-pointer"
                                title="Ver Perfil Completo & Histórico"
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

              {/* MOBILE VIEW: Cards Elegantes (Visível em <md) */}
              <div className="md:hidden space-y-3">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {/* Topo do Card */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            client.status === 'vip'
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                              : client.status === 'bloqueado'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {getInitials(client.nome)}
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-bold text-sm text-white truncate">
                            {client.nome}
                          </h2>
                          <p className="text-[10px] font-mono text-slate-400">
                            NIF: {client.nif} &bull; {client.codigoCliente}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {renderStatusBadge(client.status)}
                      </div>
                    </div>

                    {/* Informações Centrais */}
                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Telemóvel:</span>
                        <span className="font-mono text-slate-100">{client.telemovel}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Balcão Origem:</span>
                        <span className="truncate max-w-[180px] text-white">
                          {client.lojaOrigemNome.replace("Diamante D'ouro - ", '')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Total Pago em Compras:</span>
                        <span className="font-mono font-bold text-[#D4AF37]">
                          {formatEUR(client.totalCompradoEUR)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-400">Última Visita:</span>
                        <span className="font-mono text-slate-300">{client.ultimaVisita}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            5. MODAL DE PERFIL DO CLIENTE (Histórico & Dados Legais)
           ========================================================= */}
        {selectedClient && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedClient(null)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Perfil */}
              <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-lg ${
                      selectedClient.status === 'vip'
                        ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-2 border-[#D4AF37]/50 shadow-[#D4AF37]/10'
                        : selectedClient.status === 'bloqueado'
                        ? 'bg-rose-500/20 text-rose-400 border-2 border-rose-500/50 shadow-rose-500/10'
                        : 'bg-slate-800 text-slate-200 border-2 border-slate-700'
                    }`}
                  >
                    {getInitials(selectedClient.nome)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-white">
                        {selectedClient.nome}
                      </h3>
                      {renderStatusBadge(selectedClient.status)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Ref: {selectedClient.codigoCliente} &bull; Registado a {selectedClient.dataRegisto}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo com Informações & Histórico */}
              <div className="p-6 space-y-6 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
                {/* 1. Dados Pessoais & Documentação Legal */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    <span>Dados Pessoais & Identificação Legal (KYC)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">NIF (Contribuinte):</span>
                      <strong className="text-white font-mono">{selectedClient.nif}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Documento de Identificação:</span>
                      <span className="text-white font-mono">{selectedClient.docIdentificacao}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Telemóvel:</span>
                      <span className="text-white font-mono">{selectedClient.telemovel}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email:</span>
                      <span className="text-slate-200">{selectedClient.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Data de Nascimento:</span>
                      <span className="text-white font-mono">{selectedClient.dataNascimento}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Balcão Habitual:</span>
                      <span className="text-white">{selectedClient.lojaOrigemNome}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Morada Completa:</span>
                      <span className="text-slate-200">{selectedClient.morada}, {selectedClient.cidade}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Resumo de Compras */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Transações</span>
                    <strong className="text-lg text-white font-mono">{selectedClient.totalTransacoes}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Volume Total Pago</span>
                    <strong className="text-lg text-[#D4AF37] font-mono">{formatEUR(selectedClient.totalCompradoEUR)}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Última Visita</span>
                    <strong className="text-xs text-white font-mono">{selectedClient.ultimaVisita}</strong>
                  </div>
                </div>

                {/* 3. Notas Internas & Compliance */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                      Notas Internas & Conformidade Legal
                    </span>
                    {selectedClient.status === 'bloqueado' && (
                      <span className="text-[10px] font-mono text-rose-400 uppercase font-bold">
                        Atenção Requerida
                      </span>
                    )}
                  </h4>
                  <p className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 leading-relaxed italic">
                    "{selectedClient.notasInternas}"
                  </p>
                </div>

                {/* 4. Histórico de Vendas / Transações */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-[#D4AF37]" />
                      Histórico Recente de Transações
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {selectedClient.historico.length} registos
                    </span>
                  </h4>

                  {selectedClient.historico.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-[#0b0f19] border border-slate-800 text-slate-400">
                      Sem transações anteriores registadas para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedClient.historico.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate text-xs">
                              {tx.descricao}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {tx.data} &bull; {tx.lojaNome.replace("Diamante D'ouro - ", '')} &bull; {tx.pesoGramas}g
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-sm text-[#D4AF37]">
                              {formatEUR(tx.valor)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ações do Rodapé do Modal */}
              <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleVipClient(selectedClient.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedClient.status === 'vip'
                        ? 'bg-amber-500/15 text-[#D4AF37] border-[#D4AF37]/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${selectedClient.status === 'vip' ? 'fill-[#D4AF37]' : ''}`} />
                    <span>{selectedClient.status === 'vip' ? 'Remover VIP' : 'Promover VIP'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleBlockClient(selectedClient.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedClient.status === 'bloqueado'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {selectedClient.status === 'bloqueado' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Desbloquear Cliente</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Bloquear na Blacklist</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedClient(null)}
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer ml-auto"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            6. MODAL: NOVO CLIENTE (Formulário)
           ========================================================= */}
        {isNewClientModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsNewClientModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#D4AF37]" />
                  <span>Ficha de Registo de Novo Cliente</span>
                </h3>
                <button
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="p-6 space-y-4 text-xs">
                {/* Nome Completo */}
                <div>
                  <label className="block text-slate-400 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={newClient.nome}
                    onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })}
                    placeholder="Ex: João Miguel Santos"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 mb-1">NIF Português (9 dígitos) *</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={newClient.nif}
                      onChange={(e) => setNewClient({ ...newClient, nif: e.target.value.replace(/\D/g, '') })}
                      placeholder="213456789"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Telemóvel */}
                  <div>
                    <label className="block text-slate-400 mb-1">Telemóvel (+351) *</label>
                    <input
                      type="text"
                      required
                      value={newClient.telemovel}
                      onChange={(e) => setNewClient({ ...newClient, telemovel: e.target.value })}
                      placeholder="+351 912 345 678"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Doc Identificação */}
                  <div>
                    <label className="block text-slate-400 mb-1">Documento (CC / Passaporte) *</label>
                    <input
                      type="text"
                      required
                      value={newClient.docIdentificacao}
                      onChange={(e) => setNewClient({ ...newClient, docIdentificacao: e.target.value })}
                      placeholder="CC 12345678 9 ZX1"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Data Nascimento */}
                  <div>
                    <label className="block text-slate-400 mb-1">Data Nascimento</label>
                    <input
                      type="text"
                      value={newClient.dataNascimento}
                      onChange={(e) => setNewClient({ ...newClient, dataNascimento: e.target.value })}
                      placeholder="DD/MM/AAAA"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="cliente@exemplo.pt"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Morada & Cidade */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1">Morada Residência</label>
                    <input
                      type="text"
                      value={newClient.morada}
                      onChange={(e) => setNewClient({ ...newClient, morada: e.target.value })}
                      placeholder="Rua, Número, Andar"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={newClient.cidade}
                      onChange={(e) => setNewClient({ ...newClient, cidade: e.target.value })}
                      placeholder="Lisboa"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Balcão */}
                  <div>
                    <label className="block text-slate-400 mb-1">Balcão de Registo</label>
                    <select
                      value={newClient.lojaOrigemId}
                      onChange={(e) => setNewClient({ ...newClient, lojaOrigemId: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      {CLIENT_STORES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Inicial */}
                  <div>
                    <label className="block text-slate-400 mb-1">Classificação Inicial</label>
                    <select
                      value={newClient.status}
                      onChange={(e) => setNewClient({ ...newClient, status: e.target.value as ClientStatus })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="normal">Normal (Conforme)</option>
                      <option value="vip">VIP (Fornecedor Regular)</option>
                      <option value="bloqueado">Blacklist (Suspeito / Bloqueado)</option>
                    </select>
                  </div>
                </div>

                {/* Notas Internas */}
                <div>
                  <label className="block text-slate-400 mb-1">Notas Internas de Conformidade</label>
                  <textarea
                    rows={2}
                    value={newClient.notasInternas}
                    onChange={(e) => setNewClient({ ...newClient, notasInternas: e.target.value })}
                    placeholder="Observações sobre proveniência das peças ou verificação documental..."
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Botões */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewClientModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Criar Ficha de Cliente
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

export default ClientManagement;
