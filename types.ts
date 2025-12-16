
export enum TransactionCategory {
  // 2.2 SAÍDAS - POR CATEGORIA
  
  // Cartão Crédito
  CREDIT_CARD_PAYMENT = 'Cartão de Crédito',

  // Essencial
  RENT = 'Aluguel',
  HOME_MAINTENANCE = 'Casa - DDT/Manutenção',
  CONDO_FEE = 'Condomínio',
  ACCOUNTANT = 'Contador',
  COURSES = 'Cursos diversos',
  EDUCATION = 'Escola/faculdade',
  E_SOCIAL = 'E-social',
  SPORTS = 'Esportes',
  PHARMACY = 'Farmácia',
  GROCERY_MARKET = 'Feira',
  HOUSEKEEPER_WEEKEND = 'Folguista',
  FIRE_TAX = 'Funesbom (Taxa de incêndio)',
  ENGLISH_COURSE = 'Inglês',
  TAX_INSS = 'INSS',
  TAX_IPTU = 'IPTU',
  TAX_IPVA = 'IPVA',
  GARDENER_POOL = 'Jardineiro / piscina',
  CAR_WASH = 'Lavagem carro',
  LAUNDRY = 'Lavanderia',
  NANNY = 'Mensalista - babá',
  HOUSEKEEPER = 'Mensalista - Cozinha/casa',
  ESSENTIAL_OTHERS = 'Essencial - Outros',
  BAKERY = 'Padaria',
  PETS = 'PET (ração, vet, banho)',
  MORTGAGE = 'Prestação da casa',
  CAR_LOAN = 'Prestação do carro',
  SUPERMARKET = 'Supermercado',
  THERAPY = 'Terapias',
  SCHOOL_TRANSPORT = 'Transporte escolar',
  STAFF_TRANSPORT = 'Transporte funcionários',
  PHONE_CHANGE = 'Troca telefone',
  STAFF_UNIFORM = 'Uniforme funcionários',

  // Extra
  IMAGE_CONSULTANT = 'Consultora de imagem',
  CLOSET_ORGANIZER = 'Arrumação de armários',
  SEAMSTRESS = 'Costureira',

  // Financeiro
  INSURANCE_HOME = 'Seguro da casa',
  INSURANCE_CAR = 'Seguro do carro',
  DONATIONS = 'Doações',
  BANK_FEES_INTEREST = 'Juros e IOF',
  FINANCIAL_PLANNER = 'Planejador financeiro',
  INSURANCE_LIFE = 'Seguro de vida',

  // Presentes
  GIFT_FAMILY = 'Presentes Família',
  GIFT_KIDS_PARTY = 'Festas infantis',
  GIFT_XMAS_BONUS = 'Gratificações Natal',
  GIFT_FRIENDS = 'Presentes amigos',
  GIFT_TEACHERS = 'Presentes professores',

  // Profissional
  PROFESSIONAL_DUES = 'Entidade de classe (OAB, CRM...)',

  // Saúde
  GYM = 'Academia',
  STEM_CELLS = 'Anuidade células tronco',
  DENTIST = 'Dentista',
  HOSPITAL = 'Hospital',
  CONTACT_LENSES = 'Lente contato',
  DOCTOR_ADULT = 'Médico adultos',
  DOCTOR_KIDS = 'Médico crianças',
  GLASSES = 'Óculos',
  MASSAGE_OSTEO = 'Osteopata/massagem',
  HEALTH_INSURANCE = 'Plano de saúde',
  HEALTH_THERAPIES = 'Saúde - Terapias',
  VACCINES = 'Vacinas',

  // Social
  IMPULSE_BUY = 'Compras por impulso',
  APPS_SUBSCRIPTION = 'Assinaturas aplicativos',
  MAGAZINES_SUBSCRIPTION = 'Assinaturas jornais e revistas',
  BEAUTY_SALON = 'Cabeleireiro/Manicure',
  COFFEE_SNACKS = 'Café / Lanches',
  SHOES_ADULT = 'Calçados adultos',
  SHOES_KIDS = 'Calçados crianças',
  MOVIES_THEATER = 'Cinema/teatro',
  SUBSCRIPTION_CLUB = 'Clube de assinatura',
  CABLE_INTERNET = 'Combo NET/Internet',
  GUESTS_HOSTING = 'Convidados em casa',
  COURSES_RETREATS = 'Cursos / retiros',
  BEAUTY_TREATMENTS = 'Esteticista / dermatologista',
  BIRTHDAY_PARTIES = 'Festas de aniversário',
  HOME_FLOWERS = 'Flores de casa',
  BOOKSTORE = 'Livraria / jornais',
  STREAMING = 'Mensalidade TV- Netflix/Spotify',
  SOCIAL_OTHERS = 'Social - Outros',
  RESTAURANTS = 'Restaurantes/bares',
  CLOTHES_ADULT = 'Roupas adultos',
  CLOTHES_KIDS = 'Roupas crianças',
  TRAVEL_SHORT = 'Viagens curtas',
  TRAVEL_LONG = 'Viagens longas',

  // Transporte
  SUBWAY = 'Metrô',
  CAR_MAINTENANCE = 'Carro - manutenção eventual',
  CAR_REVISION = 'Carro - revisão',
  FUEL = 'Combustível carro',
  PARKING = 'Estacionamento',
  TRAFFIC_TICKETS = 'Multas',
  BUS = 'Ônibus',
  TOLL_TAG = 'Sem parar',
  CAR_EXCHANGE = 'Troca carro',
  RIDE_APP = 'Uber/Taxi',

  // Outros / Receitas
  OTHERS = 'Diversos',
  INCOME_SALARY = 'Salário Líquido',
  INCOME_RENT = 'Aluguéis',
  INCOME_DIVIDENDS = 'Dividendos',
  INCOME_OTHER = 'Outras Entradas',
  INCOME_TAX_REFUND = 'Restituição IR'
}

export type CategoryGroup = 'Essencial' | 'Extra' | 'Financeiro' | 'Presentes' | 'Profissional' | 'Saúde' | 'Social' | 'Transporte' | 'Receitas' | 'Outros';

export interface Client {
  id: string;
  name: string;
  email?: string;
  cpf?: string;
  notes?: string;
}

export interface Dependent {
  name: string;
  birthDate: string;
  occupation: string;
  schoolOrCompany: string;
  nationality: string;
  maritalStatus: string;
}

export interface IncomeDetails {
  sourceName: string;
  grossAmount: number;
  inss: number;
  irrf: number;
  thirteenthSalary: number;
  thirteenthIrrf: number;
  rentIncome: number;
  carneLeao: number;
}

export interface Address {
  street: string;
  neighborhood: string; // Bairro/Cidade
  zipCode: string;
}

export interface DetailedPersonalData {
  // 1.1 Dados Pessoais
  name: string;
  birthDate: string;
  nationality: string;
  maritalStatus: string;
  propertyRegime: string; // Regime de bens

  // 1.2 Endereço
  address: Address;
  email: string;

  // 1.3 Profissional
  profession: string;
  company: string;
  cnpj: string;
  role: string; // Cargo

  // 1.4 Receitas
  incomeDetails: IncomeDetails;
  netIncomeAnnual: number;
  insuranceTotal: number; // Seguros

  // 1.5 Dependentes
  dependents: Dependent[];
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: TransactionCategory | string; // Permitir string para categorias customizadas
  type: CategoryGroup; // "Essencial", "Saúde", etc.
  institution: string;
}

export interface Asset {
  ticker: string;
  type: 'Ação' | 'FII' | 'Renda Fixa' | 'Exterior' | 'Cripto' | 'Previdência' | 'Imóvel' | 'Veículo' | 'Dívida';
  quantity: number;
  currentPrice: number;
  totalValue: number;
  institution: string;
  classification?: string; // e.g., "Bolsa", "Renda Fixa"
}

export interface SimulationConfig {
  initialPatrimony: number;
  monthlyContribution: number;
  interestRateReal: number;
  years: number;
  inflationRate: number;
  retirementAge: number;
  lifeExpectancy: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  group: CategoryGroup;
  isCustom?: boolean;
}

export interface AppState {
  clients: Client[];
  selectedClientId: string | null;
  personalData: DetailedPersonalData;
  transactions: Transaction[];
  assets: Asset[];
  simulation: SimulationConfig;
  categories: CategoryItem[]; // Nova lista dinâmica de categorias
  lastUpdated: string | null;
}

// Initial State Factory
export const INITIAL_STATE: AppState = {
  clients: [],
  selectedClientId: null,
  personalData: {
    name: "Novo Cliente",
    birthDate: "",
    nationality: "Brasileira",
    maritalStatus: "Solteiro(a)",
    propertyRegime: "",
    address: { street: "", neighborhood: "", zipCode: "" },
    email: "",
    profession: "",
    company: "",
    cnpj: "",
    role: "",
    incomeDetails: {
      sourceName: "",
      grossAmount: 0,
      inss: 0,
      irrf: 0,
      thirteenthSalary: 0,
      thirteenthIrrf: 0,
      rentIncome: 0,
      carneLeao: 0
    },
    netIncomeAnnual: 0,
    insuranceTotal: 0,
    dependents: []
  },
  transactions: [],
  assets: [],
  simulation: {
    initialPatrimony: 0,
    monthlyContribution: 0,
    interestRateReal: 0.06,
    inflationRate: 0.045,
    years: 30,
    retirementAge: 65,
    lifeExpectancy: 90
  },
  categories: [], // Será populado no App.tsx
  lastUpdated: null
};
