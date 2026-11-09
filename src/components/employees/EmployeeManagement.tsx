// PATH: src/components/employees/EmployeeManagement.tsx
import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  Shield,
  Clock,
  Calendar,
  Euro,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  UserCheck,
  UserX,
  CreditCard,
  Filter,
  Sparkles,
  ArrowUpDown,
  MoreVertical,
} from 'lucide-react';

export type EmployeeRole = 'Gerente' | 'Operador' | 'Estagiário';
export type EmployeeStatus = 'em_servico' | 'ausente' | 'ferias';

export interface Employee {
  id: string;
  codigo: string;
  nome: string;
  nif: string;
  telemovel: string;
  email: string;
  lojaId: string;
  lojaNome: string;
  cargo: EmployeeRole;
  salarioBase: number;
  dataAdmissao: string;
  status: EmployeeStatus;
  avatarColor: string;
  especialidade?: string;
  transacoesMes?: number;
}

// 24 Lojas da Rede Diamante D'ouro para vinculação
export const STORE_OPTIONS = [
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

// Array com 30 colaboradores realistas da rede
const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-001',
    codigo: 'COL-001',
    nome: 'Ana Sofia Martins',
    nif: '234567891',
    telemovel: '+351 912 345 678',
    email: 'ana.martins@diamantedouro.pt',
    lojaId: 'loj-001',
    lojaNome: "Diamante D'ouro - Baixa (Lisboa)",
    cargo: 'Gerente',
    salarioBase: 1850,
    dataAdmissao: '12/03/2019',
    status: 'em_servico',
    avatarColor: 'from-amber-600 to-yellow-500',
    especialidade: 'Peritagem de Joalharia Antiga',
    transacoesMes: 52,
  },
  {
    id: 'emp-002',
    codigo: 'COL-002',
    nome: 'Ricardo Jorge Silva',
    nif: '219876543',
    telemovel: '+351 934 567 890',
    email: 'ricardo.silva@diamantedouro.pt',
    lojaId: 'loj-001',
    lojaNome: "Diamante D'ouro - Baixa (Lisboa)",
    cargo: 'Operador',
    salarioBase: 1250,
    dataAdmissao: '04/09/2021',
    status: 'em_servico',
    avatarColor: 'from-blue-600 to-indigo-500',
    especialidade: 'Testes de Densidade & Espectrometria',
    transacoesMes: 44,
  },
  {
    id: 'emp-003',
    codigo: 'COL-003',
    nome: 'Mariana Castelo Branco',
    nif: '245678912',
    telemovel: '+351 961 234 567',
    email: 'mariana.branco@diamantedouro.pt',
    lojaId: 'loj-002',
    lojaNome: "Diamante D'ouro - Chiado (Lisboa)",
    cargo: 'Gerente',
    salarioBase: 1950,
    dataAdmissao: '15/05/2019',
    status: 'em_servico',
    avatarColor: 'from-purple-600 to-pink-500',
    especialidade: 'Diamantes & Pedras Preciosas',
    transacoesMes: 61,
  },
  {
    id: 'emp-004',
    codigo: 'COL-004',
    nome: 'Tiago André Santos',
    nif: '256789123',
    telemovel: '+351 917 890 123',
    email: 'tiago.santos@diamantedouro.pt',
    lojaId: 'loj-002',
    lojaNome: "Diamante D'ouro - Chiado (Lisboa)",
    cargo: 'Operador',
    salarioBase: 1300,
    dataAdmissao: '10/01/2022',
    status: 'em_servico',
    avatarColor: 'from-emerald-600 to-teal-500',
    especialidade: 'Avaliação de Barras de Ouro Fino',
    transacoesMes: 38,
  },
  {
    id: 'emp-005',
    codigo: 'COL-005',
    nome: 'Helena Pires Vaz',
    nif: '223456789',
    telemovel: '+351 925 678 901',
    email: 'helena.vaz@diamantedouro.pt',
    lojaId: 'loj-003',
    lojaNome: "Diamante D'ouro - Campo de Ourique (Lisboa)",
    cargo: 'Gerente',
    salarioBase: 1750,
    dataAdmissao: '08/01/2020',
    status: 'em_servico',
    avatarColor: 'from-rose-600 to-orange-500',
    especialidade: 'Ourivesaria Portuguesa Toque 800',
    transacoesMes: 41,
  },
  {
    id: 'emp-006',
    codigo: 'COL-006',
    nome: 'Gonçalo Nuno Ramos',
    nif: '267891234',
    telemovel: '+351 938 901 234',
    email: 'goncalo.ramos@diamantedouro.pt',
    lojaId: 'loj-003',
    lojaNome: "Diamante D'ouro - Campo de Ourique (Lisboa)",
    cargo: 'Estagiário',
    salarioBase: 950,
    dataAdmissao: '01/02/2024',
    status: 'em_servico',
    avatarColor: 'from-cyan-600 to-blue-500',
    especialidade: 'Atendimento & Triagem de Metais',
    transacoesMes: 19,
  },
  {
    id: 'emp-007',
    codigo: 'COL-007',
    nome: 'Patrícia Rebelo',
    nif: '238901234',
    telemovel: '+351 919 012 345',
    email: 'patricia.rebelo@diamantedouro.pt',
    lojaId: 'loj-004',
    lojaNome: "Diamante D'ouro - Alvalade (Lisboa)",
    cargo: 'Gerente',
    salarioBase: 1800,
    dataAdmissao: '18/09/2020',
    status: 'em_servico',
    avatarColor: 'from-amber-600 to-emerald-500',
    especialidade: 'Relojoaria Suíça de Luxo',
    transacoesMes: 47,
  },
  {
    id: 'emp-008',
    codigo: 'COL-008',
    nome: 'Catarina Morais',
    nif: '278901234',
    telemovel: '+351 962 345 678',
    email: 'catarina.morais@diamantedouro.pt',
    lojaId: 'loj-005',
    lojaNome: "Diamante D'ouro - Parque das Nações (Lisboa)",
    cargo: 'Gerente',
    salarioBase: 1900,
    dataAdmissao: '05/04/2021',
    status: 'em_servico',
    avatarColor: 'from-indigo-600 to-purple-500',
    especialidade: 'Negociação de Lotes Corporativos',
    transacoesMes: 55,
  },
  {
    id: 'emp-009',
    codigo: 'COL-009',
    nome: 'Diogo Miguel Ferreira',
    nif: '289012345',
    telemovel: '+351 926 789 012',
    email: 'diogo.ferreira@diamantedouro.pt',
    lojaId: 'loj-005',
    lojaNome: "Diamante D'ouro - Parque das Nações (Lisboa)",
    cargo: 'Operador',
    salarioBase: 1280,
    dataAdmissao: '14/11/2022',
    status: 'ausente',
    avatarColor: 'from-slate-600 to-zinc-500',
    especialidade: 'Avaliação de Moedas Numismáticas',
    transacoesMes: 33,
  },
  {
    id: 'emp-010',
    codigo: 'COL-010',
    nome: 'Beatriz Fontes',
    nif: '249012345',
    telemovel: '+351 913 456 789',
    email: 'beatriz.fontes@diamantedouro.pt',
    lojaId: 'loj-006',
    lojaNome: "Diamante D'ouro - Cascais",
    cargo: 'Gerente',
    salarioBase: 2100,
    dataAdmissao: '12/11/2019',
    status: 'em_servico',
    avatarColor: 'from-yellow-600 to-amber-500',
    especialidade: 'Alta Joalharia & Heranças',
    transacoesMes: 64,
  },
  {
    id: 'emp-011',
    codigo: 'COL-011',
    nome: 'João Pedro Correia',
    nif: '259012345',
    telemovel: '+351 935 678 901',
    email: 'joao.correia@diamantedouro.pt',
    lojaId: 'loj-006',
    lojaNome: "Diamante D'ouro - Cascais",
    cargo: 'Operador',
    salarioBase: 1350,
    dataAdmissao: '22/03/2022',
    status: 'em_servico',
    avatarColor: 'from-blue-600 to-cyan-500',
    especialidade: 'Espectrometria XRF',
    transacoesMes: 45,
  },
  {
    id: 'emp-012',
    codigo: 'COL-012',
    nome: 'Inês Carvalhal',
    nif: '269012345',
    telemovel: '+351 963 456 789',
    email: 'ines.carvalhal@diamantedouro.pt',
    lojaId: 'loj-007',
    lojaNome: "Diamante D'ouro - Sintra",
    cargo: 'Gerente',
    salarioBase: 1700,
    dataAdmissao: '14/02/2021',
    status: 'em_servico',
    avatarColor: 'from-emerald-600 to-teal-500',
    especialidade: 'Filigrana Portuguesa Tradicional',
    transacoesMes: 34,
  },
  {
    id: 'emp-013',
    codigo: 'COL-013',
    nome: 'Teresa Alentejano',
    nif: '279012345',
    telemovel: '+351 914 567 890',
    email: 'teresa.alentejano@diamantedouro.pt',
    lojaId: 'loj-008',
    lojaNome: "Diamante D'ouro - Amadora",
    cargo: 'Gerente',
    salarioBase: 1750,
    dataAdmissao: '22/05/2020',
    status: 'em_servico',
    avatarColor: 'from-rose-600 to-pink-500',
    especialidade: 'Ouro Usado & Peças Danificadas',
    transacoesMes: 46,
  },
  {
    id: 'emp-014',
    codigo: 'COL-014',
    nome: 'Joana Figueiredo',
    nif: '280123456',
    telemovel: '+351 927 890 123',
    email: 'joana.figueiredo@diamantedouro.pt',
    lojaId: 'loj-009',
    lojaNome: "Diamante D'ouro - Almada",
    cargo: 'Gerente',
    salarioBase: 1800,
    dataAdmissao: '08/08/2020',
    status: 'em_servico',
    avatarColor: 'from-purple-600 to-indigo-500',
    especialidade: 'Prata de Lei 925 & Bajos Teores',
    transacoesMes: 48,
  },
  {
    id: 'emp-015',
    codigo: 'COL-015',
    nome: 'Carla Silveira',
    nif: '290123456',
    telemovel: '+351 936 789 012',
    email: 'carla.silveira@diamantedouro.pt',
    lojaId: 'loj-010',
    lojaNome: "Diamante D'ouro - Setúbal",
    cargo: 'Gerente',
    salarioBase: 1750,
    dataAdmissao: '30/10/2020',
    status: 'ferias',
    avatarColor: 'from-amber-600 to-orange-500',
    especialidade: 'Gestão de Balcão & Conformidade RGPD',
    transacoesMes: 0,
  },
  {
    id: 'emp-016',
    codigo: 'COL-016',
    nome: 'Marta Ribeiro Sousa',
    nif: '211234567',
    telemovel: '+351 915 678 901',
    email: 'marta.sousa@diamantedouro.pt',
    lojaId: 'loj-011',
    lojaNome: "Diamante D'ouro - Porto Santa Catarina",
    cargo: 'Gerente',
    salarioBase: 2000,
    dataAdmissao: '20/04/2019',
    status: 'em_servico',
    avatarColor: 'from-blue-600 to-sky-500',
    especialidade: 'Ouro do Norte & Joias de Época',
    transacoesMes: 62,
  },
  {
    id: 'emp-017',
    codigo: 'COL-017',
    nome: 'Rui Manuel Costa',
    nif: '221234567',
    telemovel: '+351 964 567 890',
    email: 'rui.costa@diamantedouro.pt',
    lojaId: 'loj-011',
    lojaNome: "Diamante D'ouro - Porto Santa Catarina",
    cargo: 'Operador',
    salarioBase: 1300,
    dataAdmissao: '12/10/2021',
    status: 'em_servico',
    avatarColor: 'from-emerald-600 to-green-500',
    especialidade: 'Análise de Toques com Ácido Nítrico',
    transacoesMes: 51,
  },
  {
    id: 'emp-018',
    codigo: 'COL-018',
    nome: 'Filipa Nogueira',
    nif: '231234567',
    telemovel: '+351 928 901 234',
    email: 'filipa.nogueira@diamantedouro.pt',
    lojaId: 'loj-012',
    lojaNome: "Diamante D'ouro - Porto Boavista",
    cargo: 'Gerente',
    salarioBase: 1850,
    dataAdmissao: '15/07/2020',
    status: 'em_servico',
    avatarColor: 'from-purple-600 to-violet-500',
    especialidade: 'Peritagem Diamantífera HRD/GIA',
    transacoesMes: 49,
  },
  {
    id: 'emp-019',
    codigo: 'COL-019',
    nome: 'Rita Magalhães',
    nif: '241234567',
    telemovel: '+351 937 890 123',
    email: 'rita.magalhaes@diamantedouro.pt',
    lojaId: 'loj-013',
    lojaNome: "Diamante D'ouro - Vila Nova de Gaia",
    cargo: 'Gerente',
    salarioBase: 1750,
    dataAdmissao: '11/02/2021',
    status: 'em_servico',
    avatarColor: 'from-rose-600 to-red-500',
    especialidade: 'Gestão de Liquidez & Caixa',
    transacoesMes: 43,
  },
  {
    id: 'emp-020',
    codigo: 'COL-020',
    nome: 'Susana Valente',
    nif: '251234567',
    telemovel: '+351 916 789 012',
    email: 'susana.valente@diamantedouro.pt',
    lojaId: 'loj-014',
    lojaNome: "Diamante D'ouro - Matosinhos",
    cargo: 'Gerente',
    salarioBase: 1700,
    dataAdmissao: '19/06/2021',
    status: 'em_servico',
    avatarColor: 'from-amber-600 to-yellow-600',
    especialidade: 'Metais Preciosos Industriais',
    transacoesMes: 37,
  },
  {
    id: 'emp-021',
    codigo: 'COL-021',
    nome: 'Diana Pinheiro',
    nif: '261234567',
    telemovel: '+351 965 678 901',
    email: 'diana.pinheiro@diamantedouro.pt',
    lojaId: 'loj-015',
    lojaNome: "Diamante D'ouro - Braga Centro",
    cargo: 'Gerente',
    salarioBase: 1800,
    dataAdmissao: '04/10/2019',
    status: 'em_servico',
    avatarColor: 'from-teal-600 to-cyan-500',
    especialidade: 'Corações de Viana & Tradição Minhota',
    transacoesMes: 48,
  },
  {
    id: 'emp-022',
    codigo: 'COL-022',
    nome: 'Pedro Miguel Braga',
    nif: '271234567',
    telemovel: '+351 929 012 345',
    email: 'pedro.braga@diamantedouro.pt',
    lojaId: 'loj-015',
    lojaNome: "Diamante D'ouro - Braga Centro",
    cargo: 'Estagiário',
    salarioBase: 950,
    dataAdmissao: '15/01/2024',
    status: 'em_servico',
    avatarColor: 'from-indigo-600 to-blue-500',
    especialidade: 'Pesagem de Precisão e Registo de Lotes',
    transacoesMes: 22,
  },
  {
    id: 'emp-023',
    codigo: 'COL-023',
    nome: 'Andreia Vasconcelos',
    nif: '281234567',
    telemovel: '+351 938 123 456',
    email: 'andreia.vasconcelos@diamantedouro.pt',
    lojaId: 'loj-016',
    lojaNome: "Diamante D'ouro - Guimarães",
    cargo: 'Gerente',
    salarioBase: 1750,
    dataAdmissao: '16/12/2020',
    status: 'em_servico',
    avatarColor: 'from-pink-600 to-rose-500',
    especialidade: 'Joalharia Tradicional do Berço',
    transacoesMes: 41,
  },
  {
    id: 'emp-024',
    codigo: 'COL-024',
    nome: 'Luísa Antunes',
    nif: '291234567',
    telemovel: '+351 917 234 567',
    email: 'luisa.antunes@diamantedouro.pt',
    lojaId: 'loj-017',
    lojaNome: "Diamante D'ouro - Coimbra Baixa",
    cargo: 'Gerente',
    salarioBase: 1800,
    dataAdmissao: '18/05/2020',
    status: 'em_servico',
    avatarColor: 'from-yellow-600 to-amber-600',
    especialidade: 'Prataria Manuelina & Ouro Antigo',
    transacoesMes: 44,
  },
  {
    id: 'emp-025',
    codigo: 'COL-025',
    nome: 'Célia Bernardo',
    nif: '212345678',
    telemovel: '+351 966 789 012',
    email: 'celia.bernardo@diamantedouro.pt',
    lojaId: 'loj-018',
    lojaNome: "Diamante D'ouro - Aveiro",
    cargo: 'Gerente',
    salarioBase: 1700,
    dataAdmissao: '22/09/2021',
    status: 'em_servico',
    avatarColor: 'from-blue-600 to-indigo-600',
    especialidade: 'Atendimento & Certificação Contrastaria',
    transacoesMes: 39,
  },
  {
    id: 'emp-026',
    codigo: 'COL-026',
    nome: 'Sónia Henriques',
    nif: '222345678',
    telemovel: '+351 930 123 456',
    email: 'sonia.henriques@diamantedouro.pt',
    lojaId: 'loj-019',
    lojaNome: "Diamante D'ouro - Leiria",
    cargo: 'Gerente',
    salarioBase: 1680,
    dataAdmissao: '07/03/2022',
    status: 'em_servico',
    avatarColor: 'from-emerald-600 to-teal-600',
    especialidade: 'Triagem Rápida de Sucata de Ouro',
    transacoesMes: 35,
  },
  {
    id: 'emp-027',
    codigo: 'COL-027',
    nome: 'Maria João Barroso',
    nif: '232345678',
    telemovel: '+351 918 345 678',
    email: 'maria.barroso@diamantedouro.pt',
    lojaId: 'loj-020',
    lojaNome: "Diamante D'ouro - Évora",
    cargo: 'Gerente',
    salarioBase: 1650,
    dataAdmissao: '14/11/2021',
    status: 'em_servico',
    avatarColor: 'from-amber-600 to-orange-600',
    especialidade: 'Cordões Alentejanos & Moedas de Ouro',
    transacoesMes: 31,
  },
  {
    id: 'emp-028',
    codigo: 'COL-028',
    nome: 'Cláudia Lourenço',
    nif: '242345678',
    telemovel: '+351 967 890 123',
    email: 'claudia.lourenco@diamantedouro.pt',
    lojaId: 'loj-021',
    lojaNome: "Diamante D'ouro - Faro Baixa",
    cargo: 'Gerente',
    salarioBase: 1850,
    dataAdmissao: '25/06/2020',
    status: 'em_servico',
    avatarColor: 'from-rose-600 to-pink-600',
    especialidade: 'Mercado de Ouro Internacional (Turismo)',
    transacoesMes: 51,
  },
  {
    id: 'emp-029',
    codigo: 'COL-029',
    nome: 'Daniela Raposo',
    nif: '252345678',
    telemovel: '+351 931 234 567',
    email: 'daniela.raposo@diamantedouro.pt',
    lojaId: 'loj-022',
    lojaNome: "Diamante D'ouro - Portimão",
    cargo: 'Gerente',
    salarioBase: 1750,
    dataAdmissao: '10/08/2021',
    status: 'em_servico',
    avatarColor: 'from-cyan-600 to-blue-600',
    especialidade: 'Avaliação de Barras e Libras Esterlinas',
    transacoesMes: 43,
  },
  {
    id: 'emp-030',
    codigo: 'COL-030',
    nome: 'Vera Lúcia Camacho',
    nif: '262345678',
    telemovel: '+351 919 456 789',
    email: 'vera.camacho@diamantedouro.pt',
    lojaId: 'loj-023',
    lojaNome: "Diamante D'ouro - Funchal Sé (Madeira)",
    cargo: 'Gerente',
    salarioBase: 1700,
    dataAdmissao: '03/05/2022',
    status: 'ausente',
    avatarColor: 'from-purple-600 to-violet-600',
    especialidade: 'Logística de Valores Insulares',
    transacoesMes: 12,
  },
];

export const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Todos' | EmployeeRole>('Todos');
  const [storeFilter, setStoreFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | EmployeeStatus>('todos');

  // Modais
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Form State (para criar ou editar)
  const [formData, setFormData] = useState<Omit<Employee, 'id' | 'codigo' | 'avatarColor'>>({
    nome: '',
    nif: '',
    telemovel: '+351 ',
    email: '',
    lojaId: STORE_OPTIONS[0].id,
    lojaNome: STORE_OPTIONS[0].nome,
    cargo: 'Operador',
    salarioBase: 1300,
    dataAdmissao: new Date().toLocaleDateString('pt-PT'),
    status: 'em_servico',
    especialidade: '',
  });

  // 1. Estatísticas Calculadas
  const totalEmployees = employees.length;
  const activeNow = useMemo(
    () => employees.filter((e) => e.status === 'em_servico').length,
    [employees]
  );

  // Lojas com equipe completa (lojas que possuem pelo menos 1 Gerente e 1 Operador/Estagiário)
  const storesWithCompleteTeam = useMemo(() => {
    const storeEmployeeMap = new Map<string, Set<EmployeeRole>>();
    employees.forEach((emp) => {
      if (emp.status === 'em_servico') {
        const set = storeEmployeeMap.get(emp.lojaId) || new Set<EmployeeRole>();
        set.add(emp.cargo);
        storeEmployeeMap.set(emp.lojaId, set);
      }
    });

    let completeCount = 0;
    storeEmployeeMap.forEach((roles) => {
      if (roles.has('Gerente') && (roles.has('Operador') || roles.has('Estagiário'))) {
        completeCount++;
      }
    });
    return completeCount;
  }, [employees]);

  // 2. Filtragem de Colaboradores
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Filtro por Cargo
      if (roleFilter !== 'Todos' && emp.cargo !== roleFilter) {
        return false;
      }

      // Filtro por Loja
      if (storeFilter !== 'todas' && emp.lojaId !== storeFilter) {
        return false;
      }

      // Filtro por Status
      if (statusFilter !== 'todos' && emp.status !== statusFilter) {
        return false;
      }

      // Pesquisa por Texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchNome = emp.nome.toLowerCase().includes(query);
        const matchNif = emp.nif.includes(query);
        const matchTelefone = emp.telemovel.toLowerCase().includes(query);
        const matchEmail = emp.email.toLowerCase().includes(query);
        const matchLoja = emp.lojaNome.toLowerCase().includes(query);
        const matchCodigo = emp.codigo.toLowerCase().includes(query);
        const matchCargo = emp.cargo.toLowerCase().includes(query);

        if (
          !matchNome &&
          !matchNif &&
          !matchTelefone &&
          !matchEmail &&
          !matchLoja &&
          !matchCodigo &&
          !matchCargo
        ) {
          return false;
        }
      }

      return true;
    });
  }, [employees, roleFilter, storeFilter, statusFilter, searchTerm]);

  // Formatação de Valores Monetários
  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // Obter Iniciais do Nome
  const getInitials = (nome: string) => {
    const parts = nome.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return nome.slice(0, 2).toUpperCase();
  };

  // Helper de Badge de Status
  const renderStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case 'em_servico':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Em Serviço
          </span>
        );
      case 'ausente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Ausente / Folga
          </span>
        );
      case 'ferias':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Férias
          </span>
        );
    }
  };

  // Helper de Badge de Cargo
  const renderRoleBadge = (cargo: EmployeeRole) => {
    switch (cargo) {
      case 'Gerente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
            <Shield className="w-3 h-3" />
            Gerente
          </span>
        );
      case 'Operador':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Briefcase className="w-3 h-3" />
            Operador
          </span>
        );
      case 'Estagiário':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
            Estagiário
          </span>
        );
    }
  };

  // Abrir Modal de Criação
  const handleOpenCreate = () => {
    setFormData({
      nome: '',
      nif: '',
      telemovel: '+351 ',
      email: '',
      lojaId: STORE_OPTIONS[0].id,
      lojaNome: STORE_OPTIONS[0].nome,
      cargo: 'Operador',
      salarioBase: 1300,
      dataAdmissao: new Date().toLocaleDateString('pt-PT'),
      status: 'em_servico',
      especialidade: '',
    });
    setIsCreateModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormData({
      nome: emp.nome,
      nif: emp.nif,
      telemovel: emp.telemovel,
      email: emp.email,
      lojaId: emp.lojaId,
      lojaNome: emp.lojaNome,
      cargo: emp.cargo,
      salarioBase: emp.salarioBase,
      dataAdmissao: emp.dataAdmissao,
      status: emp.status,
      especialidade: emp.especialidade || '',
    });
    setIsEditModalOpen(true);
  };

  // Submeter Novo Funcionário
  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.nif.trim()) return;

    const nextIdNum = employees.length + 1;
    const codigo = `COL-${String(nextIdNum).padStart(3, '0')}`;
    const id = `emp-${Date.now()}`;

    const colorGradients = [
      'from-amber-600 to-yellow-500',
      'from-blue-600 to-indigo-500',
      'from-emerald-600 to-teal-500',
      'from-purple-600 to-pink-500',
      'from-rose-600 to-orange-500',
    ];
    const avatarColor = colorGradients[nextIdNum % colorGradients.length];

    const storeObj = STORE_OPTIONS.find((s) => s.id === formData.lojaId);
    const lojaNome = storeObj ? storeObj.nome : formData.lojaNome;

    const newEmp: Employee = {
      id,
      codigo,
      ...formData,
      lojaNome,
      avatarColor,
      transacoesMes: 0,
    };

    setEmployees((prev) => [newEmp, ...prev]);
    setIsCreateModalOpen(false);
  };

  // Submeter Edição
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    const storeObj = STORE_OPTIONS.find((s) => s.id === formData.lojaId);
    const lojaNome = storeObj ? storeObj.nome : formData.lojaNome;

    const updated: Employee = {
      ...selectedEmployee,
      ...formData,
      lojaNome,
    };

    setEmployees((prev) =>
      prev.map((emp) => (emp.id === selectedEmployee.id ? updated : emp))
    );
    setSelectedEmployee(updated);
    setIsEditModalOpen(false);
  };

  // Eliminar Funcionário
  const handleDeleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setIsDeletingId(null);
    setSelectedEmployee(null);
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
                  Equipa & Funcionários
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Recursos Humanos, Alocação aos 24 Balcões e Gestão de Escalas
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Funcionário</span>
          </button>
        </header>

        {/* =========================================================
            2. STATS CARDS DO TOPO
           ========================================================= */}
        <section
          aria-label="Indicadores da Equipa"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6"
        >
          {/* Card 1: Total Colaboradores */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Colaboradores
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {totalEmployees}
              </p>
              <p className="text-[11px] text-[#D4AF37] font-medium">
                Alocados a 24 balcões ativos
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Em Serviço Agora */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Em Serviço Agora
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                  {activeNow}
                </p>
                <span className="text-xs font-mono text-slate-400">
                  / {totalEmployees} operacionais
                </span>
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {Math.round((activeNow / totalEmployees) * 100)}% de taxa de presença
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Lojas com Equipa Completa */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Lojas com Equipa Completa
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  {storesWithCompleteTeam}
                </p>
                <span className="text-xs font-mono text-slate-400">
                  / 24 balcões
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Gerente + Operador em escala ativa
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* =========================================================
            3. BARRA DE PESQUISA & FILTROS RÁPIDOS (Pills)
           ========================================================= */}
        <section
          aria-label="Filtros e Pesquisa"
          className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
        >
          {/* Linha 1: Pesquisa + Filtro de Loja Dropdown */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome, NIF, telemóvel (+351), loja ou cargo..."
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
                <option value="todas">Todas as Lojas (24 Balcões)</option>
                {STORE_OPTIONS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Filtros Pill por Cargo e Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            {/* Cargo Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Cargo:
              </span>
              {(['Todos', 'Gerente', 'Operador', 'Estagiário'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    roleFilter === r
                      ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                      : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Status Pills */}
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
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('em_servico')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'em_servico'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-emerald-400 border border-slate-800'
                }`}
              >
                Em Serviço ({activeNow})
              </button>
              <button
                onClick={() => setStatusFilter('ausente')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'ausente'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-amber-400 border border-slate-800'
                }`}
              >
                Ausentes
              </button>
              <button
                onClick={() => setStatusFilter('ferias')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'ferias'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-sky-400 border border-slate-800'
                }`}
              >
                Férias
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================
            4. LISTA / TABELA RESPONSIVA
           ========================================================= */}
        <section aria-label="Lista de Colaboradores">
          {filteredEmployees.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
              <Users className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
              <p className="text-base font-bold text-white">
                Nenhum colaborador encontrado
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não existem colaboradores com os critérios de pesquisa ou filtros selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('Todos');
                  setStoreFilter('todas');
                  setStatusFilter('todos');
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
                        <th className="py-3.5 px-4">Colaborador</th>
                        <th className="py-3.5 px-4">NIF</th>
                        <th className="py-3.5 px-4">Telemóvel</th>
                        <th className="py-3.5 px-4">Balcão Alocado</th>
                        <th className="py-3.5 px-4">Cargo</th>
                        <th className="py-3.5 px-4 font-right">Salário Base</th>
                        <th className="py-3.5 px-4">Estado</th>
                        <th className="py-3.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedEmployee(emp)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Colaborador (Avatar + Nome + Código) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${emp.avatarColor} text-slate-950 font-bold flex items-center justify-center text-xs shadow-md shrink-0`}
                              >
                                {getInitials(emp.nome)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors truncate">
                                  {emp.nome}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {emp.codigo} &bull; {emp.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* NIF */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {emp.nif}
                          </td>

                          {/* Telemóvel */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{emp.telemovel}</span>
                            </div>
                          </td>

                          {/* Loja */}
                          <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-300" title={emp.lojaNome}>
                            <div className="flex items-center gap-1.5 truncate">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{emp.lojaNome}</span>
                            </div>
                          </td>

                          {/* Cargo */}
                          <td className="py-3.5 px-4">
                            {renderRoleBadge(emp.cargo)}
                          </td>

                          {/* Salário Base */}
                          <td className="py-3.5 px-4 font-mono font-medium text-white">
                            {formatEUR(emp.salarioBase)}
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(emp.status)}
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(emp);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] transition-colors"
                                title="Editar Colaborador"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
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
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {/* Header do Card Mobile */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${emp.avatarColor} text-slate-950 font-bold flex items-center justify-center text-xs shadow-md shrink-0`}
                        >
                          {getInitials(emp.nome)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">
                            {emp.nome}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {emp.codigo} &bull; {emp.nif}
                          </p>
                        </div>
                      </div>

                      {renderStatusBadge(emp.status)}
                    </div>

                    {/* Informações Centrais */}
                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Cargo:</span>
                        {renderRoleBadge(emp.cargo)}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Balcão:</span>
                        <span className="truncate max-w-[190px] text-right font-medium text-white">
                          {emp.lojaNome.replace("Diamante D'ouro - ", "")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Contacto:</span>
                        <span className="font-mono text-slate-200">{emp.telemovel}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Salário Base:</span>
                        <span className="font-mono font-bold text-white">
                          {formatEUR(emp.salarioBase)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            5. MODAL DE DETALHES DO COLABORADOR
           ========================================================= */}
        {selectedEmployee && !isEditModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedEmployee(null)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${selectedEmployee.avatarColor} text-slate-950 font-bold flex items-center justify-center text-sm shadow-md shrink-0`}
                  >
                    {getInitials(selectedEmployee.nome)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-amber-500/10 border border-[#D4AF37]/30">
                        {selectedEmployee.codigo}
                      </span>
                      {renderStatusBadge(selectedEmployee.status)}
                    </div>
                    <h2 className="text-lg font-bold text-white mt-1">
                      {selectedEmployee.nome}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informação Completa */}
              <div className="p-6 space-y-5 text-xs text-slate-300">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Cargo</p>
                    <p className="font-bold text-white text-sm mt-0.5">
                      {selectedEmployee.cargo}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Vencimento Base</p>
                    <p className="font-bold text-emerald-400 font-mono text-sm mt-0.5">
                      {formatEUR(selectedEmployee.salarioBase)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Data Admissão</p>
                    <p className="font-bold text-slate-200 font-mono text-sm mt-0.5">
                      {selectedEmployee.dataAdmissao}
                    </p>
                  </div>
                </div>

                {/* Detalhes de Contacto e Balcão */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Balcão de Atribuição & Especialidade</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p>
                      <span className="text-slate-400">Loja Alocada:</span>{' '}
                      <strong className="text-white">{selectedEmployee.lojaNome}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Especialidade / Foco:</span>{' '}
                      <span className="text-[#D4AF37]">
                        {selectedEmployee.especialidade || 'Avaliação Geral de Metais Preciosos'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">Transações este Mês:</span>{' '}
                      <strong className="font-mono text-white">
                        {selectedEmployee.transacoesMes || 0} compras registadas
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                    <span>Dados Fiscais & Contactos Pessoais</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p>
                      <span className="text-slate-400">NIF:</span>{' '}
                      <strong className="font-mono text-white">{selectedEmployee.nif}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Telemóvel (WhatsApp):</span>{' '}
                      <span className="font-mono text-white">{selectedEmployee.telemovel}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Email Corporativo:</span>{' '}
                      <span className="text-slate-200">{selectedEmployee.email}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Ações do Rodapé */}
              <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3">
                <button
                  onClick={() => setIsDeletingId(selectedEmployee.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(selectedEmployee)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Editar Dados</span>
                  </button>

                  <button
                    onClick={() => setSelectedEmployee(null)}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Concluído
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            6. MODAL: EDITAR / NOVO FUNCIONÁRIO (Formulário Completo)
           ========================================================= */}
        {(isCreateModalOpen || isEditModalOpen) && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => {
              setIsCreateModalOpen(false);
              setIsEditModalOpen(false);
            }}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {isCreateModalOpen ? (
                    <>
                      <Plus className="w-5 h-5 text-[#D4AF37]" />
                      <span>Registar Novo Funcionário</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-5 h-5 text-[#D4AF37]" />
                      <span>Editar Colaborador ({selectedEmployee?.codigo})</span>
                    </>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={isCreateModalOpen ? handleSaveCreate : handleSaveEdit}
                className="p-6 space-y-4 text-xs"
              >
                {/* Nome Completo */}
                <div>
                  <label className="block text-slate-400 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Ana Sofia Martins"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 mb-1">NIF (9 Dígitos) *</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={formData.nif}
                      onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                      placeholder="234567891"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Telemóvel */}
                  <div>
                    <label className="block text-slate-400 mb-1">Telemóvel (+351) *</label>
                    <input
                      type="tel"
                      required
                      value={formData.telemovel}
                      onChange={(e) => setFormData({ ...formData, telemovel: e.target.value })}
                      placeholder="+351 9XX XXX XXX"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Loja de Alocação */}
                <div>
                  <label className="block text-slate-400 mb-1">Balcão de Alocação *</label>
                  <select
                    value={formData.lojaId}
                    onChange={(e) => {
                      const sel = STORE_OPTIONS.find((s) => s.id === e.target.value);
                      setFormData({
                        ...formData,
                        lojaId: e.target.value,
                        lojaNome: sel ? sel.nome : formData.lojaNome,
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                  >
                    {STORE_OPTIONS.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Cargo */}
                  <div>
                    <label className="block text-slate-400 mb-1">Cargo *</label>
                    <select
                      value={formData.cargo}
                      onChange={(e) =>
                        setFormData({ ...formData, cargo: e.target.value as EmployeeRole })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="Gerente">Gerente</option>
                      <option value="Operador">Operador</option>
                      <option value="Estagiário">Estagiário</option>
                    </select>
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="block text-slate-400 mb-1">Estado Operacional</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as EmployeeStatus })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="em_servico">Em Serviço</option>
                      <option value="ausente">Ausente / Folga</option>
                      <option value="ferias">Férias</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Salário Base */}
                  <div>
                    <label className="block text-slate-400 mb-1">Salário Base (€)</label>
                    <input
                      type="number"
                      step="50"
                      value={formData.salarioBase}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          salarioBase: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Data de Admissão */}
                  <div>
                    <label className="block text-slate-400 mb-1">Data de Admissão</label>
                    <input
                      type="text"
                      value={formData.dataAdmissao}
                      onChange={(e) =>
                        setFormData({ ...formData, dataAdmissao: e.target.value })
                      }
                      placeholder="DD/MM/AAAA"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Email Corporativo */}
                <div>
                  <label className="block text-slate-400 mb-1">Email Corporativo</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="nome.sobrenome@diamantedouro.pt"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Especialidade */}
                <div>
                  <label className="block text-slate-400 mb-1">Especialidade / Peritagem</label>
                  <input
                    type="text"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                    placeholder="Ex: Joalharia Antiga, Diamantes, Ouro Toque 800"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Botões do Rodapé */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setIsEditModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    {isCreateModalOpen ? 'Registar Funcionário' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            7. MODAL DE CONFIRMAÇÃO DE ELIMINAÇÃO
           ========================================================= */}
        {isDeletingId && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsDeletingId(null)}
          >
            <div
              className="bg-[#151b2b] border border-rose-900/50 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Eliminar Colaborador?</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Tem a certeza que deseja remover este registo de funcionário da rede? Esta ação é irreversível.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsDeletingId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteEmployee(isDeletingId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  Confirmar Eliminação
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;
