

/**
 * POLÍTICA DE LAYOUT IMUTÁVEL - NÃO ALTERAR NADA VISUAL
 * 1. Sidebar: #1e3a8a
 * 2. Menu: Numerado 1 a 12 (Agora 1 a 13)
 * 3. Fonte: Inter / Sans
 * 4. Header: Botão 'Selecionar Cliente' arredondado (pills)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    BarChart3, TrendingUp, DollarSign,
    FileText, Briefcase, Calculator, LineChart, Layers,
    UploadCloud, Settings, ChevronRight, Activity, LogOut, FileCheck, AlertCircle, CheckCircle2, Loader2, Users, MapPin, Building, UserPlus, Trash2, Search, Sliders, Calendar, Lock, Key, X,
    ChevronLeft, Menu, MessageSquare, Edit2, Plus, Save, RotateCcw, Scale, BrainCircuit, Landmark, ArrowRightLeft, TrendingDown, LayoutGrid, Target, Check
} from 'lucide-react';
import { extractFinancialData } from './services/geminiService';
import { saveFinancialData, fetchClientData, fetchClients, createClient, deleteClient, updateTransactionCategory, fetchGlobalCategories, createGlobalCategory, deleteGlobalCategory } from './services/dbService';
import { uploadStatement } from './services/storageService';
import { parseFileContent } from './services/fileParser';
import { supabase } from './services/supabaseClient';
import { AppState, INITIAL_STATE, TransactionCategory, CategoryGroup, Client, CategoryItem, Transaction } from './types';
import { PatrimonyChart, AllocationChart, ExpensesBarChart, ScenarioChart } from './components/FinancialCharts';
import { Auth } from './components/Auth';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// Declaração global para checagem de debug


// --- TYPES FOR MULTI-UPLOAD ---
type FileStatus = 'queued' | 'uploading' | 'extracting' | 'processing_ai' | 'saving' | 'completed' | 'error';

interface QueueItem {
    id: string;
    file: File;
    status: FileStatus;
    progress: number; // 0-100
    error?: string;
    resultMessage?: string;
}

// Helper: Safe ID Generator (Avoids crypto.randomUUID crash on insecure contexts)
const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Helper to determine group from category (Legacy Helper + Fallback)
const getCategoryGroup = (cat: string): CategoryGroup => {
    const lowerCat = cat.toLowerCase();

    // 0. Pagamento de Cartão (Deve ser neutro para não duplicar gastos no Orçamento)
    if (lowerCat === 'cartão de crédito' || lowerCat.includes('pagamento fatura') || lowerCat.includes('liquidação cartão')) return 'Pagamentos' as any;

    // Receitas (Prioridade alta para evitar conflito com Aluguel despesa)
    if (lowerCat.includes('salário') || lowerCat.includes('receita') || lowerCat.includes('dividendo') || lowerCat.includes('aluguéis') || lowerCat.includes('entradas') || lowerCat.includes('restituição')) return 'Receitas';

    // Transporte
    if (lowerCat.includes('transporte') || lowerCat.includes('carro') || lowerCat.includes('uber') || lowerCat.includes('taxi') || lowerCat.includes('99') || lowerCat.includes('combustível') || lowerCat.includes('ipva') || lowerCat.includes('estacionamento') || lowerCat.includes('multa')) return 'Transporte';

    // Social
    if (lowerCat.includes('restaurante') || lowerCat.includes('viagem') || lowerCat.includes('lazer') || lowerCat.includes('social') || lowerCat.includes('netflix') || lowerCat.includes('spotify') || lowerCat.includes('cinema') || lowerCat.includes('teatro') || lowerCat.includes('assinatura') || lowerCat.includes('roupa') || lowerCat.includes('calçado')) return 'Social';

    // Saúde
    if (lowerCat.includes('saúde') || lowerCat.includes('médico') || lowerCat.includes('hospital') || lowerCat.includes('dentista') || lowerCat.includes('farmácia') || lowerCat.includes('drogaria') || lowerCat.includes('academia') || lowerCat.includes('vacina') || lowerCat.includes('lente') || lowerCat.includes('óculos')) return 'Saúde';

    // Presentes
    if (lowerCat.includes('presente') || lowerCat.includes('festa')) return 'Presentes';

    // Financeiro (Removido 'cartão' daqui para evitar duplicidade no grupo financeiro)
    if (lowerCat.includes('seguro') || lowerCat.includes('juros') || lowerCat.includes('doaç') || lowerCat.includes('planejador') || lowerCat.includes('iof') || lowerCat.includes('taxa')) return 'Financeiro';

    // Extra
    if (lowerCat.includes('consultora') || lowerCat.includes('arrumação') || lowerCat.includes('costureira')) return 'Extra';

    // Profissional
    if (lowerCat.includes('entidade') || lowerCat.includes('oab') || lowerCat.includes('crm')) return 'Profissional';

    // Diversos / Outros
    if (lowerCat.includes('diversos') || lowerCat.includes('outros')) return 'Outros';

    // Essencial (Fallback amplo)
    return 'Essencial';
};

// Helper: Gera lista padrão baseada no Enum original
const generateDefaultCategories = (): CategoryItem[] => {
    return Object.values(TransactionCategory).map(cat => ({
        id: generateId(), // IDs locais temporários para defaults
        name: cat,
        group: getCategoryGroup(cat),
        isCustom: false
    }));
};

// Componente Modal de Troca de Senha
const ForcePasswordChangeModal = ({ onClose, isForced = true }: { onClose: () => void, isForced?: boolean }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        try {
            // 1. Atualiza a senha
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            // 2. Remove a flag de troca obrigatória
            const { error: metaError } = await supabase.auth.updateUser({
                data: { force_password_change: false }
            });
            if (metaError) throw metaError;

            alert('Senha alterada com sucesso!');
            onClose(); // Fecha o modal e recarrega a sessão
        } catch (err: any) {
            setError(err.message || 'Erro ao alterar senha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-200">
                <div className="flex flex-col items-center mb-6 relative">
                    {!isForced && (
                        <button
                            onClick={onClose}
                            className="absolute -top-4 -right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                        <Key className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {isForced ? 'Troca de Senha Obrigatória' : 'Alterar Senha'}
                    </h2>
                    <p className="text-center text-gray-500 mt-2 text-sm">
                        {isForced
                            ? 'Por segurança, você precisa redefinir sua senha provisória antes de continuar.'
                            : 'Digite sua nova senha abaixo para atualizar seu acesso.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                        <input
                            type="password"
                            required
                            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Mínimo 6 caracteres"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                        <input
                            type="password"
                            required
                            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Repita a senha"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (isForced ? 'Atualizar Senha e Entrar' : 'Salvar Nova Senha')}
                    </button>
                </form>
            </div>
        </div>
    );
};

const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
);

export default function App() {
    const [session, setSession] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [activeTab, setActiveTab] = useState(11);

    // INICIALIZAÇÃO DE ESTADO ROBUSTA: Começa com categorias padrão
    const [data, setData] = useState<AppState>(() => {
        return {
            ...INITIAL_STATE,
            categories: generateDefaultCategories() // Inicia com padrão, DB carrega depois
        };
    });

    // Sidebar State
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

    // Processing States
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    const [processingLog, setProcessingLog] = useState<string[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Multi-File Upload State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileQueue, setFileQueue] = useState<QueueItem[]>([]);

    // Custom Context State
    const [customContext, setCustomContext] = useState("");

    // Success Alert State
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [alertType, setAlertType] = useState<'success' | 'error'>('success');

    // New Client Creation State
    const [newClientName, setNewClientName] = useState("");

    // Date Filter State for Page 3
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Force Password Change State
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    // Estado para edição de categorias (Página 10)
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryGroup, setNewCategoryGroup] = useState<CategoryGroup>("Essencial");

    // Estado para a Calculadora de Decumulação (Página 8)
    const [decumulationConfig, setDecumulationConfig] = useState({
        capital: 0,
        withdrawal: 10000,
        interestRate: 0.06
    });

    // --- ESTADO PARA EDIÇÃO MANUAL NO FLUXO (PÁGINA 13) ---
    const [cashFlowEditMode, setCashFlowEditMode] = useState(false);
    const [manualIncomes, setManualIncomes] = useState<Record<string, number>>({});
    const [groupBudgets, setGroupBudgets] = useState<Record<string, number>>({});
    const [isSavingCashFlow, setIsSavingCashFlow] = useState(false);
    const [isAddingManualGroup, setIsAddingManualGroup] = useState(false);
    const [newManualGroupName, setNewManualGroupName] = useState("");

    // --- ESTADO PARA EDIÇÃO DE RECEITAS (PÁGINA 1) ---
    const [isEditingIncome, setIsEditingIncome] = useState(false);
    const [incomeEdits, setIncomeEdits] = useState<{
        grossAmount: number;
        inss: number;
        irrf: number;
        thirteenthSalary: number;
        rentIncome: number;
        medicalExpenses: number;
        educationExpenses: number;
        dependentsCount: number;
    } | null>(null);

    // Estados de edição das seções 1.1, 1.2, 1.3
    const [isEditingPersonal, setIsEditingPersonal] = useState(false);
    const [personalForm, setPersonalForm] = useState<any>(null);

    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [addressForm, setAddressForm] = useState<any>(null);

    const [isEditingProfessional, setIsEditingProfessional] = useState(false);
    const [professionalForm, setProfessionalForm] = useState<any>(null);

    // --- ESTADO PARA EDIÇÃO DE ATIVOS (BALANÇO PATRIMONIAL) ---
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);
    const [assetFormData, setAssetFormData] = useState<{
        ticker: string;
        type: 'Ação' | 'FII' | 'Renda Fixa' | 'Exterior' | 'Cripto' | 'Previdência' | 'Imóvel' | 'Veículo' | 'Dívida' | 'A Receber';
        quantity: number;
        currentPrice: number;
        totalValue: number;
        institution: string;
    }>({
        ticker: '',
        type: 'Renda Fixa',
        quantity: 0,
        currentPrice: 0,
        totalValue: 0,
        institution: ''
    });

    // Sync capital de decumulação com o patrimônio do cliente carregado
    useEffect(() => {
        const liabilities = data.assets.filter(a => a.type === 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
        const totalAssets = data.assets.filter(a => a.type !== 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
        const netWorth = totalAssets - liabilities;

        if (netWorth > 0 && decumulationConfig.capital === 0) {
            setDecumulationConfig(prev => ({ ...prev, capital: netWorth }));
        }
    }, [data.assets]);

    // Função para carregar categorias globais e mesclar com as padrão
    const refreshCategories = async () => {
        const globalCats = await fetchGlobalCategories();
        const defaultCats = generateDefaultCategories();
        // Mescla: Padrão + Globais do BD
        setData(prev => ({
            ...prev,
            categories: [...defaultCats, ...globalCats]
        }));
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoadingSession(false);

            if (session?.user) {
                // Carrega categorias GLOBAIS do banco de dados
                refreshCategories();

                // TENTA RESTAURAR CLIENTE SELECIONADO ANTERIORMENTE
                const savedClientId = localStorage.getItem('finplanner_selected_client_id');
                if (savedClientId) {
                    handleSelectClient(savedClientId); // Carrega os dos deste cliente
                }

                if (session.user.user_metadata?.force_password_change) {
                    setMustChangePassword(true);
                } else {
                    loadClients(session.user.id);
                }
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                // No login, carrega do DB global
                refreshCategories();

                if (session.user.user_metadata?.force_password_change) {
                    setMustChangePassword(true);
                } else {
                    setMustChangePassword(false);
                    loadClients(session.user.id);
                }
            } else {
                // No logout, volta para padrão
                setData(prev => ({ ...INITIAL_STATE, categories: generateDefaultCategories() }));
                localStorage.removeItem('finplanner_selected_client_id'); // Limpa cliente no logout
                setMustChangePassword(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const loadClients = async (consultantId: string) => {
        setIsLoadingData(true);
        const clients = await fetchClients(consultantId);
        setData(prev => ({ ...prev, clients }));
        setIsLoadingData(false);
    };

    const handleSelectClient = async (clientId: string) => {
        if (!clientId) return;
        setIsLoadingData(true);
        localStorage.setItem('finplanner_selected_client_id', clientId); // Persiste seleção

        const clientData = await fetchClientData(clientId);
        if (clientData) {
            setData(prev => ({
                ...prev,
                ...clientData,
                selectedClientId: clientId,
                personalData: { ...prev.personalData, ...clientData.personalData },
                lastUpdated: new Date().toISOString()
            }));
            // Reseta edições manuais ao trocar de cliente
            setManualIncomes({});
            setCashFlowEditMode(false);

            // Carregar budgets salvos do cliente (simulado por enquanto no localStorage ou via metadata futuro)
            const savedBudgets = localStorage.getItem(`budgets_${clientId}`);
            if (savedBudgets) setGroupBudgets(JSON.parse(savedBudgets));
            else setGroupBudgets({});
        }
        setIsLoadingData(false);
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName.trim() || !session?.user) return;

        const newClient = await createClient(session.user.id, newClientName);
        if (newClient) {
            setData(prev => ({ ...prev, clients: [...prev.clients, newClient] }));
            setNewClientName("");
            setSuccessMessage(`Cliente ${newClient.name} cadastrado com sucesso!`);
            setAlertType('success');
            setShowSuccessAlert(true);
        }
    };

    const handleDeleteClient = async (id: string, name: string) => {
        if (confirm(`Tem certeza que deseja excluir ${name} e todos os seus dados?`)) {
            await deleteClient(id);
            setData(prev => ({
                ...prev,
                clients: prev.clients.filter(c => c.id !== id),
                selectedClientId: prev.selectedClientId === id ? null : prev.selectedClientId
            }));
            if (data.selectedClientId === id) {
                localStorage.removeItem('finplanner_selected_client_id');
            }
        }
    };

    const handleCategoryChange = async (transactionId: string, newCategory: string) => {
        // Procura a categoria na lista dinâmica para pegar o grupo correto
        const matchedCat = data.categories.find(c => c.name === newCategory);
        const newType = matchedCat ? matchedCat.group : getCategoryGroup(newCategory);

        // Otimistic Update
        setData(prev => ({
            ...prev,
            transactions: prev.transactions.map(t =>
                t.id === transactionId ? { ...t, category: newCategory as TransactionCategory, type: newType } : t
            )
        }));

        try {
            await updateTransactionCategory(transactionId, newCategory, newType);
        } catch (error) {
            alert("Erro ao atualizar categoria no banco de dados.");
        }
    };

    // --- CATEGORY MANAGEMENT HANDLERS (GLOBAL DB) ---

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        const cleanName = newCategoryName.trim();

        // Validação de Duplicidade (Case Insensitive) no Front
        if (data.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
            setSuccessMessage(`A categoria "${cleanName}" já existe!`);
            setAlertType('error');
            setShowSuccessAlert(true);
            return;
        }

        try {
            // Cria no banco global
            await createGlobalCategory(cleanName, newCategoryGroup);

            // Recarrega todas as categorias para sincronizar
            await refreshCategories();

            setNewCategoryName("");
            setSuccessMessage("Categoria global criada com sucesso!");
            setAlertType('success');
            setShowSuccessAlert(true);
        } catch (error) {
            setSuccessMessage("Erro ao criar categoria global. Verifique o banco de dados.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        // Confirmação direta, sem setTimeout para evitar bloqueio do navegador
        const confirmed = window.confirm("Tem certeza que deseja remover esta categoria global? Isso afetará todos os usuários.");
        if (!confirmed) return;

        console.log("Iniciando exclusão de categoria:", id);

        // 1. Otimistic Update: Remove da UI imediatamente
        const previousCategories = [...data.categories];
        setData(prev => ({
            ...prev,
            categories: prev.categories.filter(c => c.id !== id)
        }));

        try {
            // 2. Tenta deletar do banco
            await deleteGlobalCategory(id);
            console.log("Categoria excluída com sucesso do DB");
        } catch (error) {
            // 3. Rollback em caso de erro
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir categoria. Verifique se você tem permissão ou conexão com o banco de dados.");
            // Restaura o estado anterior
            setData(prev => ({ ...prev, categories: previousCategories }));
        }
    };

    const handleRestoreCategories = () => {
        // Como o sistema agora é global, "Restaurar" significaria apagar TUDO do banco global? 
        // Isso pode ser perigoso. Vamos apenas recarregar os dados do banco.
        if (confirm("Isso irá recarregar a lista de categorias do servidor. Continuar?")) {
            refreshCategories();
            setSuccessMessage("Categorias sincronizadas com o servidor.");
            setAlertType('success');
            setShowSuccessAlert(true);
        }
    };

    // --- HANDLERS PARA EDIÇÃO DE PERFIL (PÁGINA 1 - RETROFIT FASE 3) ---

    // 1.1 Dados Pessoais
    const handleEditPersonal = () => {
        setPersonalForm({
            name: data.personalData.name,
            birthDate: data.personalData.birthDate,
            nationality: data.personalData.nationality,
            maritalStatus: data.personalData.maritalStatus,
            propertyRegime: data.personalData.propertyRegime
        });
        setIsEditingPersonal(true);
    };

    const handleCancelPersonal = () => {
        setPersonalForm(null);
        setIsEditingPersonal(false);
    };

    const handleSavePersonal = async () => {
        if (!personalForm || !data.selectedClientId || !session?.user) return;
        const updatedData = {
            ...data,
            personalData: { ...data.personalData, ...personalForm }
        };
        setData(updatedData);
        const result = await saveFinancialData(session.user.id, data.selectedClientId, updatedData);

        if (result.success) {
            setSuccessMessage("Dados pessoais atualizados!");
            setAlertType('success');
            setShowSuccessAlert(true);
            setIsEditingPersonal(false);
        } else {
            console.error(result.error);
            setSuccessMessage("Erro ao salvar dados pessoais. Verifique o console.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }
    };

    // 1.2 Endereço
    const handleEditAddress = () => {
        setAddressForm({
            street: data.personalData.address?.street || '',
            neighborhood: data.personalData.address?.neighborhood || '',
            zipCode: data.personalData.address?.zipCode || '',
            email: data.personalData.email || ''
        });
        setIsEditingAddress(true);
    };

    const handleCancelAddress = () => {
        setAddressForm(null);
        setIsEditingAddress(false);
    };

    const handleSaveAddress = async () => {
        if (!addressForm || !data.selectedClientId || !session?.user) return;
        const updatedData = {
            ...data,
            personalData: {
                ...data.personalData,
                email: addressForm.email,
                address: {
                    street: addressForm.street,
                    neighborhood: addressForm.neighborhood,
                    zipCode: addressForm.zipCode
                }
            }
        };
        setData(updatedData);
        const result = await saveFinancialData(session.user.id, data.selectedClientId, updatedData);

        if (result.success) {
            setSuccessMessage("Endereço atualizado!");
            setAlertType('success');
            setShowSuccessAlert(true);
            setIsEditingAddress(false);
        } else {
            console.error(result.error);
            setSuccessMessage("Erro ao salvar endereço. Verifique o console.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }
    };

    // 1.3 Profissional
    const handleEditProfessional = () => {
        setProfessionalForm({
            profession: data.personalData.profession,
            company: data.personalData.company,
            role: data.personalData.role,
            cnpj: data.personalData.cnpj
        });
        setIsEditingProfessional(true);
    };

    const handleCancelProfessional = () => {
        setProfessionalForm(null);
        setIsEditingProfessional(false);
    };

    const handleSaveProfessional = async () => {
        if (!professionalForm || !data.selectedClientId || !session?.user) return;
        const updatedData = {
            ...data,
            personalData: { ...data.personalData, ...professionalForm }
        };
        setData(updatedData);
        const result = await saveFinancialData(session.user.id, data.selectedClientId, updatedData);

        if (result.success) {
            setSuccessMessage("Dados profissionais atualizados!");
            setAlertType('success');
            setShowSuccessAlert(true);
            setIsEditingProfessional(false);
        } else {
            console.error(result.error);
            setSuccessMessage("Erro ao salvar dados profissionais.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }
    };

    // --- HANDLERS PARA ORÇAMENTO (PÁGINA 2 - FASE 4) ---
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [budgetForm, setBudgetForm] = useState<Record<string, number>>({});

    const handleEditBudget = () => {
        setBudgetForm(data.personalData.budgetTargets || {});
        setIsEditingBudget(true);
    };

    const handleCancelBudget = () => {
        setBudgetForm({});
        setIsEditingBudget(false);
    };

    const handleSaveBudget = async () => {
        if (!data.selectedClientId || !session?.user) return;

        const updatedData = {
            ...data,
            personalData: {
                ...data.personalData,
                budgetTargets: budgetForm
            }
        };

        setData(updatedData);
        const result = await saveFinancialData(session.user.id, data.selectedClientId, updatedData);

        if (result.success) {
            setSuccessMessage("Orçamento atualizado!");
            setAlertType('success');
            setShowSuccessAlert(true);
            setIsEditingBudget(false);
        } else {
            console.error(result.error);
            setSuccessMessage("Erro ao salvar orçamento.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }
    };

    // --- HANDLERS PARA EDIÇÃO DE RECEITAS (PÁGINA 1) ---
    const handleStartIncomeEdit = () => {
        setIncomeEdits({
            grossAmount: data.personalData.incomeDetails?.grossAmount || 0,
            inss: data.personalData.incomeDetails?.inss || 0,
            irrf: data.personalData.incomeDetails?.irrf || 0,
            thirteenthSalary: data.personalData.incomeDetails?.thirteenthSalary || 0,
            rentIncome: data.personalData.incomeDetails?.rentIncome || 0,
            medicalExpenses: data.personalData.incomeDetails?.medicalExpenses || 0,
            educationExpenses: data.personalData.incomeDetails?.educationExpenses || 0,
            dependentsCount: data.personalData.dependents?.length || 0
        });
        setIsEditingIncome(true);
    };

    const handleCancelIncomeEdit = () => {
        setIncomeEdits(null);
        setIsEditingIncome(false);
    };

    const handleSaveIncomeDetails = async () => {
        if (!incomeEdits || !session?.user || !data.selectedClientId) return;

        // Criamos um array de dependentes baseado na quantidade
        const newDependents = Array.from({ length: incomeEdits.dependentsCount }, (_, i) => ({
            name: data.personalData.dependents[i]?.name || `Dependente ${i + 1}`,
            birthDate: data.personalData.dependents[i]?.birthDate || '',
            occupation: data.personalData.dependents[i]?.occupation || '',
            schoolOrCompany: data.personalData.dependents[i]?.schoolOrCompany || '',
            nationality: data.personalData.dependents[i]?.nationality || 'Brasileira',
            maritalStatus: data.personalData.dependents[i]?.maritalStatus || ''
        }));

        const updatedData = {
            ...data,
            personalData: {
                ...data.personalData,
                incomeDetails: {
                    ...data.personalData.incomeDetails,
                    grossAmount: incomeEdits.grossAmount,
                    inss: incomeEdits.inss,
                    irrf: incomeEdits.irrf,
                    thirteenthSalary: incomeEdits.thirteenthSalary,
                    rentIncome: incomeEdits.rentIncome,
                    medicalExpenses: incomeEdits.medicalExpenses,
                    educationExpenses: incomeEdits.educationExpenses
                },
                dependents: newDependents
            }
        };

        setData(updatedData);

        const result = await saveFinancialData(session.user.id, data.selectedClientId, updatedData);

        if (result.success) {
            setSuccessMessage("Dados de receita salvos com sucesso!");
            setAlertType('success');
            setShowSuccessAlert(true);
        } else {
            setSuccessMessage("Erro ao salvar dados de receita.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }

        setIsEditingIncome(false);
        setIncomeEdits(null);
    };

    // --- HANDLERS PARA EDIÇÃO DE ATIVOS (BALANÇO PATRIMONIAL) ---
    const handleOpenAssetModal = (index?: number) => {
        if (index !== undefined && data.assets[index]) {
            // Modo edição
            const asset = data.assets[index];
            setEditingAssetIndex(index);
            setAssetFormData({
                ticker: asset.ticker,
                type: asset.type,
                quantity: asset.quantity,
                currentPrice: asset.currentPrice,
                totalValue: asset.totalValue,
                institution: asset.institution
            });
        } else {
            // Modo criação
            setEditingAssetIndex(null);
            setAssetFormData({
                ticker: '',
                type: 'Renda Fixa',
                quantity: 0,
                currentPrice: 0,
                totalValue: 0,
                institution: ''
            });
        }
        setShowAssetModal(true);
    };

    const handleCloseAssetModal = () => {
        setShowAssetModal(false);
        setEditingAssetIndex(null);
        setAssetFormData({
            ticker: '',
            type: 'Renda Fixa',
            quantity: 0,
            currentPrice: 0,
            totalValue: 0,
            institution: ''
        });
    };

    const handleSaveAsset = async () => {
        if (!session?.user || !data.selectedClientId) {
            setSuccessMessage("Selecione um cliente antes de adicionar ativos.");
            setAlertType('error');
            setShowSuccessAlert(true);
            return;
        }

        if (!assetFormData.ticker.trim()) {
            setSuccessMessage("Preencha a descrição do ativo.");
            setAlertType('error');
            setShowSuccessAlert(true);
            return;
        }

        let newAssets: typeof data.assets;

        if (editingAssetIndex !== null) {
            // Edição
            newAssets = data.assets.map((asset, idx) =>
                idx === editingAssetIndex ? { ...assetFormData } : asset
            );
        } else {
            // Criação
            newAssets = [...data.assets, { ...assetFormData }];
        }

        // Atualiza estado local
        setData(prev => ({ ...prev, assets: newAssets }));

        // Salva no banco
        const result = await saveFinancialData(session.user.id, data.selectedClientId, { assets: newAssets });

        if (result.success) {
            setSuccessMessage(editingAssetIndex !== null ? "Ativo atualizado com sucesso!" : "Ativo adicionado com sucesso!");
            setAlertType('success');
            setShowSuccessAlert(true);
            handleCloseAssetModal();
        } else {
            setSuccessMessage("Erro ao salvar ativo. Tente novamente.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }
    };

    const handleDeleteAsset = async (index: number) => {
        if (!session?.user || !data.selectedClientId) return;

        const assetName = data.assets[index]?.ticker || 'este ativo';
        const confirmed = window.confirm(`Tem certeza que deseja excluir "${assetName}"?`);
        if (!confirmed) return;

        const newAssets = data.assets.filter((_, idx) => idx !== index);

        // Atualiza estado local
        setData(prev => ({ ...prev, assets: newAssets }));

        // Salva no banco
        const result = await saveFinancialData(session.user.id, data.selectedClientId, { assets: newAssets });

        if (result.success) {
            setSuccessMessage("Ativo excluído com sucesso!");
            setAlertType('success');
            setShowSuccessAlert(true);
        } else {
            setSuccessMessage("Erro ao excluir ativo. Tente novamente.");
            setAlertType('error');
            setShowSuccessAlert(true);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleTogglePasswordModal = () => {
        setShowPasswordModal(!showPasswordModal);
    };

    const addLog = (msg: string) => setProcessingLog(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev]);

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // --- MULTI-FILE UPLOAD HANDLERS ---

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !session?.user) return;

        const newFiles: QueueItem[] = Array.from(event.target.files).map((file) => ({
            id: Math.random().toString(36).substring(7),
            file: file as File,
            status: 'queued',
            progress: 0
        }));

        setFileQueue(prev => [...prev, ...newFiles]);
        setShowSuccessAlert(false);
    };

    const removeFileFromQueue = (id: string) => {
        setFileQueue(prev => prev.filter(item => item.id !== id));
    };

    const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
        setFileQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const triggerFileInput = () => {
        if (isProcessingQueue) return;
        fileInputRef.current?.click();
    };

    const processQueue = async () => {
        if (!session?.user) return;
        setIsProcessingQueue(true);
        setProcessingLog([]);

        const pendingItems = fileQueue.filter(i => i.status === 'queued' || i.status === 'error');

        if (pendingItems.length === 0) {
            addLog("Nenhum arquivo pendente para processar.");
            setIsProcessingQueue(false);
            return;
        }

        addLog(`Iniciando processamento de ${pendingItems.length} arquivos...`);
        addLog(`Usando ${data.categories.length} categorias para classificação.`);

        for (const item of pendingItems) {
            try {
                updateQueueItem(item.id, { status: 'uploading', progress: 0 });
                addLog(`[${item.file.name}] Iniciando upload...`);

                const uploadResult = await uploadStatement(item.file, session.user.id, (percent) => {
                    updateQueueItem(item.id, { progress: percent });
                });

                if (!uploadResult.success) throw new Error(uploadResult.error || "Falha no upload");

                updateQueueItem(item.id, { status: 'extracting' });
                addLog(`[${item.file.name}] Lendo conteúdo...`);
                const extractedText = await parseFileContent(item.file);

                if (!extractedText || extractedText.trim().length === 0) {
                    throw new Error("Texto ilegível ou arquivo vazio.");
                }

                updateQueueItem(item.id, { status: 'processing_ai' });
                addLog(`[${item.file.name}] Enviando para Inteligência Artificial...`);

                // PASSANDO AS CATEGORIAS ATUAIS PARA O SERVIÇO
                const extractedData = await extractFinancialData(extractedText, customContext, data.categories);

                let targetClientId = data.selectedClientId;
                let targetClientName = extractedData.detectedClientName;

                if (targetClientName) {
                    const currentClients = await fetchClients(session.user.id);
                    const existing = currentClients.find(c => c.name.toLowerCase() === targetClientName?.toLowerCase());

                    if (existing) {
                        targetClientId = existing.id;
                        addLog(`[${item.file.name}] Vinculado ao cliente existente: ${existing.name}`);
                    } else {
                        addLog(`[${item.file.name}] Criando novo cliente: ${targetClientName}`);
                        const newClient = await createClient(session.user.id, targetClientName);
                        if (newClient) {
                            targetClientId = newClient.id;
                            setData(prev => ({ ...prev, clients: [...prev.clients, newClient] }));
                        }
                    }
                }

                if (!targetClientId) {
                    throw new Error("Não foi possível identificar o cliente. Selecione um manualmente antes de processar.");
                }

                updateQueueItem(item.id, { status: 'saving' });
                const saveData = {
                    personalData: { ...data.personalData, ...extractedData.personalData },
                    transactions: extractedData.transactions || [],
                    assets: extractedData.assets || [],
                };

                const saveResult = await saveFinancialData(session.user.id, targetClientId, saveData);

                if (!saveResult.success) throw new Error(saveResult.error?.message || "Erro ao salvar no banco");

                updateQueueItem(item.id, { status: 'completed', resultMessage: `Vinculado a ${targetClientName || 'Cliente Selecionado'}` });
                addLog(`[${item.file.name}] SUCESSO!`);

                if (item.id === pendingItems[pendingItems.length - 1].id) {
                    handleSelectClient(targetClientId);
                    // Não força mudança de aba para não atrapalhar a UX se o usuário estiver vendo outra coisa
                }

            } catch (error: any) {
                console.error(error);
                updateQueueItem(item.id, { status: 'error', error: error.message });
                addLog(`[${item.file.name}] ERRO: ${error.message}`);
            }
        }

        setIsProcessingQueue(false);
        setSuccessMessage("Fila processada! Verifique o status de cada arquivo.");
        setAlertType('success');
        setShowSuccessAlert(true);
    };

    // --- HANDLERS PARA EDIÇÃO MANUAL DO FLUXO ---

    const handleManualIncomeChange = (monthKey: string, newValue: number) => {
        setManualIncomes(prev => ({ ...prev, [monthKey]: newValue }));
    };

    const handleGroupBudgetChange = (group: string, value: number) => {
        const newBudgets = { ...groupBudgets, [group]: value };
        setGroupBudgets(newBudgets);
        if (data.selectedClientId) {
            localStorage.setItem(`budgets_${data.selectedClientId}`, JSON.stringify(newBudgets));
        }
    };

    const handleSaveManualCashFlow = async (monthlyDataMap: Record<string, { income: number; expenses: number }>) => {
        if (!data.selectedClientId || !session?.user) return;

        setIsSavingCashFlow(true);
        const newAdjustmentTransactions: Transaction[] = [];

        try {
            for (const [monthKey, newValue] of Object.entries(manualIncomes)) {
                const currentIncome = monthlyDataMap[monthKey]?.income || 0;
                const adjustment = newValue - currentIncome;

                if (Math.abs(adjustment) < 0.01) continue;

                // Cria uma transação de ajuste para este mês
                newAdjustmentTransactions.push({
                    id: generateId(),
                    date: `${monthKey}-01`, // Primeiro dia do mês
                    description: `Ajuste Manual de Receita - ${monthKey.split('-').reverse().join('/')}`,
                    amount: adjustment,
                    category: TransactionCategory.INCOME_OTHER,
                    type: 'Receitas',
                    institution: 'Ajuste Manual'
                });
            }

            if (newAdjustmentTransactions.length > 0) {
                const saveResult = await saveFinancialData(session.user.id, data.selectedClientId, {
                    transactions: [...data.transactions, ...newAdjustmentTransactions]
                });

                if (saveResult.success) {
                    setSuccessMessage("Entradas atualizadas com sucesso!");
                    setAlertType('success');
                    setShowSuccessAlert(true);
                    // Recarrega os dados do cliente para refletir as novas transações
                    handleSelectClient(data.selectedClientId);
                } else {
                    throw new Error(saveResult.error?.message || "Erro ao salvar ajustes");
                }
            }
        } catch (err: any) {
            setSuccessMessage(err.message || "Falha ao salvar edições manuais.");
            setAlertType('error');
            setShowSuccessAlert(true);
        } finally {
            setIsSavingCashFlow(false);
            setCashFlowEditMode(false);
            setManualIncomes({});
        }
    };

    const handleConfirmManualGroup = () => {
        if (!newManualGroupName.trim()) return;
        const name = newManualGroupName.trim();
        if (!groupBudgets[name]) {
            handleGroupBudgetChange(name, 0);
        }
        setNewManualGroupName("");
        setIsAddingManualGroup(false);
    };

    // --- RENDERERS ---

    const renderClients = () => (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Carteira de Clientes</h3>
                    <p className="text-gray-500 text-sm">Gerencie seus clientes e acesse seus relatórios.</p>
                </div>
                <form onSubmit={handleCreateClient} className="flex gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Nome do Novo Cliente"
                        className="border rounded-lg px-4 py-2 text-sm w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={newClientName}
                        onChange={e => setNewClientName(e.target.value)}
                    />
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold">
                        <UserPlus className="w-4 h-4" /> Adicionar
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.clients.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Nenhum cliente cadastrado.</p>
                        <p className="text-sm">Cadastre manualmente acima ou faça upload de um extrato para criar automaticamente.</p>
                    </div>
                ) : (
                    data.clients.map(client => (
                        <div key={client.id} className={`bg-white p-6 rounded-xl shadow-sm border cursor-pointer transition-all hover:shadow-md ${data.selectedClientId === client.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                                    {client.name.charAt(0)}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { handleSelectClient(client.id); setActiveTab(0); }} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100 font-medium">
                                        Acessar
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id, client.name); }} className="text-gray-400 hover:text-red-500 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h4 className="font-bold text-gray-800">{client.name}</h4>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Activity className="w-3 h-3" /> Status: Ativo
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderSummary = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6 pb-2 border-b">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" /> 1.1 Dados Pessoais
                    </h3>
                    {!isEditingPersonal ? (
                        <button
                            onClick={handleEditPersonal}
                            disabled={!data.selectedClientId}
                            className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            <Edit2 className="w-3 h-3" /> Editar
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={handleCancelPersonal}
                                className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <X className="w-3 h-3" /> Cancelar
                            </button>
                            <button
                                onClick={handleSavePersonal}
                                className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <Save className="w-3 h-3" /> Salvar
                            </button>
                        </div>
                    )}
                </div>

                {isEditingPersonal ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={personalForm.name}
                                    onChange={e => setPersonalForm({ ...personalForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nascimento</label>
                                <input
                                    type="text"
                                    placeholder="DD/MM/AAAA"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={personalForm.birthDate}
                                    onChange={e => setPersonalForm({ ...personalForm, birthDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nacionalidade</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={personalForm.nationality}
                                    onChange={e => setPersonalForm({ ...personalForm, nationality: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado Civil</label>
                                <select
                                    className="w-full border rounded p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={personalForm.maritalStatus}
                                    onChange={e => setPersonalForm({ ...personalForm, maritalStatus: e.target.value })}
                                >
                                    <option value="Solteiro(a)">Solteiro(a)</option>
                                    <option value="Casado(a)">Casado(a)</option>
                                    <option value="União Estável">União Estável</option>
                                    <option value="Divorciado(a)">Divorciado(a)</option>
                                    <option value="Viúvo(a)">Viúvo(a)</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Regime de Bens</label>
                                <select
                                    className="w-full border rounded p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={personalForm.propertyRegime}
                                    onChange={e => setPersonalForm({ ...personalForm, propertyRegime: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Comunhão Parcial">Comunhão Parcial</option>
                                    <option value="Comunhão Universal">Comunhão Universal</option>
                                    <option value="Separação Total">Separação Total</option>
                                    <option value="Separação Obrigatória">Separação Obrigatória</option>
                                    <option value="Participação Final nos Aquestos">Part. Final nos Aquestos</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="space-y-3">
                            <InfoRow label="Nome" value={data.personalData.name} />
                            <InfoRow label="Nascimento" value={data.personalData.birthDate || '--/--/----'} />
                        </div>
                        <div className="space-y-3">
                            <InfoRow label="Nacionalidade" value={data.personalData.nationality} />
                            <InfoRow label="Estado Civil" value={data.personalData.maritalStatus} />
                        </div>
                        <div className="space-y-3">
                            <InfoRow label="Regime de Bens" value={data.personalData.propertyRegime || '-'} />
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-orange-600" /> 1.2 Endereço e Contato
                        </h3>
                        {!isEditingAddress ? (
                            <button
                                onClick={handleEditAddress}
                                disabled={!data.selectedClientId}
                                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                                <Edit2 className="w-3 h-3" /> Editar
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelAddress}
                                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-3 h-3" /> Cancelar
                                </button>
                                <button
                                    onClick={handleSaveAddress}
                                    className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <Save className="w-3 h-3" /> Salvar
                                </button>
                            </div>
                        )}
                    </div>

                    {isEditingAddress ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Logradouro</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={addressForm.street}
                                    onChange={e => setAddressForm({ ...addressForm, street: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bairro/Cidade</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={addressForm.neighborhood}
                                    onChange={e => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CEP</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={addressForm.zipCode}
                                    onChange={e => setAddressForm({ ...addressForm, zipCode: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={addressForm.email}
                                    onChange={e => setAddressForm({ ...addressForm, email: e.target.value })}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <InfoRow label="Logradouro" value={data.personalData.address?.street || '-'} />
                            <InfoRow label="Bairro/Cidade" value={data.personalData.address?.neighborhood || '-'} />
                            <InfoRow label="CEP" value={data.personalData.address?.zipCode || '-'} />
                            <InfoRow label="Email" value={data.personalData.email || '-'} />
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-indigo-600" /> 1.3 Profissional
                        </h3>
                        {!isEditingProfessional ? (
                            <button
                                onClick={handleEditProfessional}
                                disabled={!data.selectedClientId}
                                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                                <Edit2 className="w-3 h-3" /> Editar
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelProfessional}
                                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-3 h-3" /> Cancelar
                                </button>
                                <button
                                    onClick={handleSaveProfessional}
                                    className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <Save className="w-3 h-3" /> Salvar
                                </button>
                            </div>
                        )}
                    </div>

                    {isEditingProfessional ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Profissão</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={professionalForm.profession}
                                    onChange={e => setProfessionalForm({ ...professionalForm, profession: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={professionalForm.company}
                                    onChange={e => setProfessionalForm({ ...professionalForm, company: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={professionalForm.role}
                                    onChange={e => setProfessionalForm({ ...professionalForm, role: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNPJ</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={professionalForm.cnpj}
                                    onChange={e => setProfessionalForm({ ...professionalForm, cnpj: e.target.value })}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <InfoRow label="Profissão" value={data.personalData.profession || '-'} />
                            <InfoRow label="Empresa" value={data.personalData.company || '-'} />
                            <InfoRow label="Cargo" value={data.personalData.role || '-'} />
                            <InfoRow label="CNPJ" value={data.personalData.cnpj || '-'} />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" /> 1.4 Receitas & Impostos
                        </h3>
                        {!isEditingIncome ? (
                            <button
                                onClick={handleStartIncomeEdit}
                                disabled={!data.selectedClientId}
                                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Edit2 className="w-3 h-3" /> Editar
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelIncomeEdit}
                                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-3 h-3" /> Cancelar
                                </button>
                                <button
                                    onClick={handleSaveIncomeDetails}
                                    className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <Save className="w-3 h-3" /> Salvar
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        {isEditingIncome && incomeEdits ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Renda Bruta</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={incomeEdits.grossAmount}
                                            onChange={(e) => setIncomeEdits({ ...incomeEdits, grossAmount: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">INSS</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={incomeEdits.inss}
                                            onChange={(e) => setIncomeEdits({ ...incomeEdits, inss: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">IRRF</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={incomeEdits.irrf}
                                            onChange={(e) => setIncomeEdits({ ...incomeEdits, irrf: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">13º Salário</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={incomeEdits.thirteenthSalary}
                                            onChange={(e) => setIncomeEdits({ ...incomeEdits, thirteenthSalary: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Aluguéis</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={incomeEdits.rentIncome}
                                            onChange={(e) => setIncomeEdits({ ...incomeEdits, rentIncome: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Desp. Médicas</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={incomeEdits.medicalExpenses}
                                            onChange={(e) => setIncomeEdits({ ...incomeEdits, medicalExpenses: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Desp. Educação</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={incomeEdits.educationExpenses}
                                            onChange={(e) => setIncomeEdits({ ...incomeEdits, educationExpenses: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <InfoRow label="Renda Bruta" value={data.personalData.incomeDetails?.grossAmount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'} />
                                <InfoRow label="INSS" value={data.personalData.incomeDetails?.inss?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'} />
                                <InfoRow label="IRRF" value={data.personalData.incomeDetails?.irrf?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'} />
                                <InfoRow label="13º Salário" value={data.personalData.incomeDetails?.thirteenthSalary?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'} />
                                <InfoRow label="Aluguéis" value={data.personalData.incomeDetails?.rentIncome?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'} />
                                <InfoRow label="Desp. Médicas" value={data.personalData.incomeDetails?.medicalExpenses?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'} />
                                <InfoRow label="Desp. Educação" value={data.personalData.incomeDetails?.educationExpenses?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'} />
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" /> 1.5 Dependentes
                    </h3>
                    {isEditingIncome && incomeEdits ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Quantidade de Dependentes</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-20 border border-blue-200 rounded px-2 py-1 text-right text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={incomeEdits.dependentsCount}
                                    onChange={(e) => setIncomeEdits({ ...incomeEdits, dependentsCount: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <p className="text-xs text-gray-400 italic">O número de dependentes é usado para cálculos fiscais na calculadora PGBL.</p>
                        </div>
                    ) : data.personalData.dependents.length > 0 ? (
                        <div className="space-y-2">
                            {data.personalData.dependents.map((dep, idx) => (
                                <div key={idx} className="bg-gray-50 p-3 rounded text-sm space-y-1">
                                    <div className="flex justify-between font-bold">
                                        <span>{dep.name}</span>
                                        <span className="text-gray-500">{dep.birthDate}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 flex justify-between">
                                        <span>{dep.occupation || 'Sem ocupação'}</span>
                                        <span>{dep.schoolOrCompany || '-'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 italic">Nenhum dependente identificado.</p>
                    )}
                </div>
            </div >
        </div >
    );

    const renderBudget = () => {
        const totalTransactions = data.transactions.length;
        const hasBudget = Object.keys(data.personalData.budgetTargets || {}).length > 0;

        // Recupera grupos de categorias customizadas
        const getGroupForChart = (cat: string) => {
            const custom = data.categories.find(c => c.name === cat);
            return custom ? custom.group : getCategoryGroup(cat);
        };

        // Ordem preferencial de exibição
        const preferredOrder = ['Receitas', 'Essencial', 'Saúde', 'Social', 'Transporte', 'Financeiro', 'Extra', 'Presentes', 'Profissional', 'Outros'];

        // Determina quais grupos exibir
        // 1. Grupos com transações existentes
        const transactionGroups = Array.from(new Set(data.transactions.map(t => getGroupForChart(t.category))));
        // 2. Grupos com metas definidas
        const targetGroups = Object.keys(data.personalData.budgetTargets || {});
        // 3. Se estiver editando, inclui todos os padrão para permitir definir meta

        let groupsToShow = new Set([...transactionGroups, ...targetGroups]);

        if (isEditingBudget) {
            preferredOrder.forEach(g => groupsToShow.add(g));
            // Adicionalmente, busca grupos de categorias customizadas criadas
            data.categories.forEach(c => groupsToShow.add(c.group));
        }

        const distinctGroups = Array.from(groupsToShow).filter(g => g !== ('Pagamentos' as any));

        const sortedGroups = distinctGroups.sort((a, b) => {
            const indexA = preferredOrder.indexOf(a as string);
            const indexB = preferredOrder.indexOf(b as string);
            // Se não estiver na lista preferencial, joga pro fim
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });

        // Prepara dados para o gráfico (apenas realizado ou metas?)
        // Vamos manter o gráfico de Realizado por enquanto para consistência, 
        // mas filtrando apenas o que tem valor > 0.
        const chartData = sortedGroups.map(group => {
            const groupTrans = data.transactions.filter(t => getGroupForChart(t.category) === group);
            const isIncomeGroup = group === 'Receitas';
            let total = 0;
            if (isIncomeGroup) {
                total = groupTrans.reduce((acc, t) => acc + t.amount, 0);
            } else {
                total = Math.abs(groupTrans.reduce((acc, t) => acc + t.amount, 0));
            }
            return { name: group, value: total };
        }).filter(item => item.value > 0.01);

        if (totalTransactions === 0 && !isEditingBudget && !hasBudget) {
            return (
                <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center animate-fade-in">
                    <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Sem dados de orçamento</h3>
                    <p className="text-gray-500 mt-2 mb-6">Faça o upload de extratos na página 11 ou defina metas manualmente.</p>
                    <button
                        onClick={handleEditBudget}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Definir Orçamento Manual
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header e Controles */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Visão Geral do Orçamento</h3>
                        <p className="text-sm text-gray-500">Acompanhe seus gastos e defina metas mensais.</p>
                    </div>
                    <div className="flex gap-2">
                        {!isEditingBudget ? (
                            <button
                                onClick={handleEditBudget}
                                disabled={!data.selectedClientId}
                                className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                            >
                                <Target className="w-4 h-4" /> Definir Metas
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleCancelBudget}
                                    className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                                >
                                    <X className="w-4 h-4" /> Cancelar
                                </button>
                                <button
                                    onClick={handleSaveBudget}
                                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                                >
                                    <Save className="w-4 h-4" /> Salvar Metas
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Gráfico de Distribuição (Apenas se tiver dados reais) */}
                {totalTransactions > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-4">Distribuição de Gastos Realizados</h4>
                        <div className="h-64">
                            <ExpensesBarChart data={chartData} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-wider">* Pagamento de cartão ignorado no gráfico para evitar duplicidade de gastos.</p>
                    </div>
                )}

                {/* Grid de Grupos com Comparativo */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 p-6 border-b">
                        {isEditingBudget ? 'Definir Metas Mensais por Grupo' : 'Detalhamento: Realizado vs Meta'}
                    </h3>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sortedGroups.map(group => {
                            const groupTrans = data.transactions.filter(t => getGroupForChart(t.category) === group);

                            const isIncomeGroup = group === 'Receitas';

                            // Cálculo Realizado
                            let totalRealized = 0;
                            if (isIncomeGroup) {
                                totalRealized = groupTrans.reduce((acc, t) => acc + t.amount, 0);
                            } else {
                                totalRealized = Math.abs(groupTrans.reduce((acc, t) => acc + t.amount, 0));
                            }

                            // Valor Meta
                            const targetValue = isEditingBudget
                                ? (budgetForm[group as string] ?? 0)
                                : (data.personalData.budgetTargets?.[group as string] ?? 0);

                            // Se não tem gasto nem meta nem está editando, esconde
                            if (!isEditingBudget && totalRealized < 0.01 && targetValue < 0.01) return null;

                            // Cálculo Progresso
                            const progress = targetValue > 0 ? (totalRealized / targetValue) * 100 : 0;
                            let progressColor = 'bg-blue-500';
                            if (totalRealized > targetValue && targetValue > 0) progressColor = 'bg-red-500';
                            else if (totalRealized > targetValue * 0.9 && targetValue > 0) progressColor = 'bg-yellow-500'; // Alerta perto do teto
                            else progressColor = 'bg-green-500';

                            // Inverte lógica para Receitas (Mais é melhor)
                            if (isIncomeGroup) {
                                if (totalRealized >= targetValue) progressColor = 'bg-green-500';
                                else progressColor = 'bg-yellow-500';
                            }

                            return (
                                <div key={group as string} className={`border rounded-lg p-4 ${isEditingBudget ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className={`font-bold text-lg ${isIncomeGroup ? 'text-green-700' : 'text-gray-800'}`}>{group}</h4>

                                        {isEditingBudget ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 font-bold">META:</span>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-gray-500 text-sm">R$</span>
                                                    <input
                                                        type="number"
                                                        className="w-28 pl-8 pr-2 py-1 border rounded text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={budgetForm[group as string] || ''}
                                                        onChange={e => setBudgetForm({ ...budgetForm, [group as string]: parseFloat(e.target.value) })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-right">
                                                <span className="block text-xs text-gray-400 font-bold uppercase">Realizado</span>
                                                <span className={`font-bold text-lg ${isIncomeGroup ? 'text-green-700' : 'text-gray-900'}`}>
                                                    {totalRealized.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Barra de Progresso e Meta (Apenas Modo Visualização) */}
                                    {!isEditingBudget && targetValue > 0 && (
                                        <div className="mb-4">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Meta: <strong>{targetValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                                                <span className={`font-bold ${totalRealized > targetValue ? 'text-red-600' : 'text-green-600'}`}>
                                                    {progress.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                <div className={`h-2.5 rounded-full ${progressColor}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Detalhes das Categorias (Expandir/Retrair ou sempre visível?) Sempre visivel para detalhe */}
                                    {!isEditingBudget && totalRealized > 0 && (
                                        <div className="space-y-1 mt-3 pt-3 border-t border-gray-100">
                                            {Array.from(new Set(groupTrans.map(t => t.category))).sort().map(cat => {
                                                const catTrans = groupTrans.filter(t => t.category === cat);
                                                let catTotal = isIncomeGroup
                                                    ? catTrans.reduce((acc, t) => acc + t.amount, 0)
                                                    : Math.abs(catTrans.reduce((acc, t) => acc + t.amount, 0));

                                                if (catTotal < 0.01) return null;

                                                return (
                                                    <div key={cat} className="flex justify-between text-xs text-gray-600">
                                                        <span>{cat}</span>
                                                        <span>{catTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderRealized = () => {
        // Se nenhum cliente estiver selecionado, avisa o usuário
        if (!data.selectedClientId) {
            return (
                <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Nenhum cliente selecionado</h3>
                    <p className="text-gray-500 mt-2">Selecione um cliente na aba 'Clientes' para visualizar as movimentações.</p>
                </div>
            );
        }

        // Garante que SEMPRE existam categorias para exibir
        const currentCategories = data.categories.length > 0 ? data.categories : generateDefaultCategories();
        const sortedCategories = [...currentCategories].sort((a, b) => a.name.localeCompare(b.name));

        // Lógica do filtro de data: Compara strings ISO e ordena cronologicamente
        const filteredTransactions = data.transactions.filter(t => {
            if (!t.date) return true;
            const tDate = t.date.substring(0, 10); // Garante YYYY-MM-DD
            if (dateRange.start && tDate < dateRange.start) return false;
            if (dateRange.end && tDate > dateRange.end) return false;
            return true;
        }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        return (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-800">Movimentações</h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {filteredTransactions.length} registros
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-2 py-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                className="bg-transparent text-xs text-gray-700 outline-none"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                title="Data Início"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                className="bg-transparent text-xs text-gray-700 outline-none"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                title="Data Fim"
                            />
                        </div>
                        {(dateRange.start || dateRange.end) && (
                            <button
                                onClick={() => setDateRange({ start: '', end: '' })}
                                className="text-xs text-blue-600 hover:text-blue-800"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-b font-medium text-gray-600 grid grid-cols-12 gap-2">
                    <div className="col-span-2">Data</div>
                    <div className="col-span-4">Descrição</div>
                    <div className="col-span-4">Categoria</div>
                    <div className="col-span-2 text-right">Valor</div>
                </div>
                <div className="divide-y max-h-[600px] overflow-y-auto">
                    {filteredTransactions.map(t => (
                        <div key={t.id} className="p-4 grid grid-cols-12 gap-2 hover:bg-gray-50 text-sm items-center group">
                            <div className="col-span-2 text-gray-600">
                                {t.date ? t.date.split('-').reverse().join('/') : '-'}
                            </div>
                            <div className="col-span-4 truncate pr-2 font-medium text-gray-700" title={t.description}>
                                {t.description}
                            </div>
                            <div className="col-span-4">
                                <select
                                    value={t.category}
                                    onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                                    className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 cursor-pointer hover:border-blue-300 transition-colors"
                                >
                                    {/* Fallback option if current category is not in the list */}
                                    {t.category && !sortedCategories.some(c => c.name === t.category) && (
                                        <option value={t.category}>{t.category}</option>
                                    )}

                                    {sortedCategories.map((cat) => (
                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={`col-span-2 text-right font-bold ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // PAGINA 4: BALANÇO PATRIMONIAL
    const renderBalanceSheet = () => {
        const liabilities = data.assets.filter(a => a.type === 'Dívida');
        const assets = data.assets.filter(a => a.type !== 'Dívida');

        const totalLiabilities = liabilities.reduce((acc, curr) => acc + curr.totalValue, 0);
        const totalAssets = assets.reduce((acc, curr) => acc + curr.totalValue, 0);
        const netWorth = totalAssets - totalLiabilities;

        // Lista de tipos de ativos disponíveis
        const assetTypes: Array<typeof assetFormData.type> = [
            'Ação', 'FII', 'Renda Fixa', 'Exterior', 'Cripto', 'Previdência', 'Imóvel', 'Veículo', 'A Receber'
        ];

        // Helper para encontrar índice original no array data.assets
        const getOriginalIndex = (item: typeof data.assets[0]): number => {
            return data.assets.findIndex(a =>
                a.ticker === item.ticker &&
                a.type === item.type &&
                a.totalValue === item.totalValue &&
                a.institution === item.institution
            );
        };

        return (
            <div className="space-y-6">
                {/* Modal de Edição/Criação de Ativo */}
                {showAssetModal && (
                    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingAssetIndex !== null ? 'Editar Item' : 'Adicionar Item'}
                                </h2>
                                <button
                                    onClick={handleCloseAssetModal}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Ticker *</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Ex: PETR4, Casa na Praia, Financiamento..."
                                        value={assetFormData.ticker}
                                        onChange={e => setAssetFormData(prev => ({ ...prev, ticker: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                    <select
                                        className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={assetFormData.type}
                                        onChange={e => setAssetFormData(prev => ({ ...prev, type: e.target.value as typeof assetFormData.type }))}
                                    >
                                        {assetTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                        <option value="Dívida">Dívida (Passivo)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="0"
                                            value={assetFormData.quantity || ''}
                                            onChange={e => {
                                                const qty = parseFloat(e.target.value) || 0;
                                                setAssetFormData(prev => ({
                                                    ...prev,
                                                    quantity: qty,
                                                    totalValue: qty * prev.currentPrice
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unitário</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="R$ 0,00"
                                            value={assetFormData.currentPrice || ''}
                                            onChange={e => {
                                                const price = parseFloat(e.target.value) || 0;
                                                setAssetFormData(prev => ({
                                                    ...prev,
                                                    currentPrice: price,
                                                    totalValue: prev.quantity * price
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                        placeholder="R$ 0,00"
                                        value={assetFormData.totalValue || ''}
                                        onChange={e => setAssetFormData(prev => ({ ...prev, totalValue: parseFloat(e.target.value) || 0 }))}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Preencha diretamente ou deixe calcular automaticamente (Qtd × Preço)</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Instituição</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Ex: XP, BTG, Itaú, Banco do Brasil..."
                                        value={assetFormData.institution}
                                        onChange={e => setAssetFormData(prev => ({ ...prev, institution: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleCloseAssetModal}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveAsset}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {editingAssetIndex !== null ? 'Atualizar' : 'Adicionar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">Ativo Total</p>
                        <p className="text-2xl font-bold text-blue-600">{totalAssets.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">Passivo Total</p>
                        <p className="text-2xl font-bold text-red-600">{totalLiabilities.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">Patrimônio Líquido</p>
                        <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netWorth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="p-6 border-b flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            Bens e Direitos
                        </h3>
                        <button
                            onClick={() => {
                                setAssetFormData(prev => ({ ...prev, type: 'Renda Fixa' }));
                                handleOpenAssetModal();
                            }}
                            disabled={!data.selectedClientId}
                            className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            Adicionar Ativo
                        </button>
                    </div>
                    {assets.length === 0 ? (
                        <div className="p-12 text-center">
                            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-sm">Nenhum ativo cadastrado.</p>
                            <p className="text-gray-400 text-xs mt-1">Clique em "Adicionar Ativo" para começar.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="p-4">Descrição/Ticker</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Instituição</th>
                                        <th className="p-4 text-right">Valor</th>
                                        <th className="p-4 text-center w-28">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {assets.map((item, idx) => {
                                        const originalIndex = getOriginalIndex(item);
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50 group">
                                                <td className="p-4 font-medium text-gray-900">{item.ticker}</td>
                                                <td className="p-4 text-gray-500">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.type === 'A Receber' ? 'bg-amber-100 text-amber-700' :
                                                        item.type === 'Imóvel' ? 'bg-purple-100 text-purple-700' :
                                                            item.type === 'Veículo' ? 'bg-slate-100 text-slate-700' :
                                                                'bg-blue-50 text-blue-700'
                                                        }`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-500">{item.institution || '-'}</td>
                                                <td className="p-4 text-right font-bold text-gray-800">{item.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleOpenAssetModal(originalIndex)}
                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAsset(originalIndex)}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="p-6 border-b flex items-center justify-between">
                        <h3 className="font-bold text-red-600 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            Dívidas e Obrigações
                        </h3>
                        <button
                            onClick={() => {
                                setAssetFormData(prev => ({ ...prev, type: 'Dívida' }));
                                handleOpenAssetModal();
                            }}
                            disabled={!data.selectedClientId}
                            className="flex items-center gap-2 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            Adicionar Passivo
                        </button>
                    </div>
                    {liabilities.length === 0 ? (
                        <div className="p-12 text-center">
                            <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-sm">Nenhuma dívida cadastrada.</p>
                            <p className="text-green-600 text-xs mt-1 font-medium">Parabéns! O cliente está livre de dívidas.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="p-4">Descrição</th>
                                        <th className="p-4">Instituição</th>
                                        <th className="p-4 text-right">Saldo Devedor</th>
                                        <th className="p-4 text-center w-28">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {liabilities.map((item, idx) => {
                                        const originalIndex = getOriginalIndex(item);
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50 group">
                                                <td className="p-4 font-medium text-gray-900">{item.ticker}</td>
                                                <td className="p-4 text-gray-500">{item.institution || '-'}</td>
                                                <td className="p-4 text-right font-bold text-red-600">{item.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleOpenAssetModal(originalIndex)}
                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAsset(originalIndex)}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // PAGINA 5: INVESTIMENTOS
    const renderInvestments = () => {
        // Filtra Dívidas e Veículos (uso pessoal, não investimento)
        const investmentAssets = data.assets.filter(a => a.type !== 'Dívida' && a.type !== 'Veículo');

        if (investmentAssets.length === 0) {
            return (
                <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
                    <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Sem investimentos cadastrados</h3>
                    <p className="text-gray-500 mt-2">Adicione ativos via upload de extratos.</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Alocação de Ativos</h3>
                    <div className="h-64">
                        <AllocationChart assets={investmentAssets} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Carteira Detalhada</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="pb-3">Ativo</th>
                                    <th className="pb-3">Tipo</th>
                                    <th className="pb-3 text-right">Qtd</th>
                                    <th className="pb-3 text-right">Preço Atual</th>
                                    <th className="pb-3 text-right">Valor Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {investmentAssets.map((asset, i) => (
                                    <tr key={i} className="group hover:bg-gray-50">
                                        <td className="py-3 font-medium">{asset.ticker}</td>
                                        <td className="py-3 text-gray-500">{asset.type}</td>
                                        <td className="py-3 text-right text-gray-600">{asset.quantity > 0 ? asset.quantity : '-'}</td>
                                        <td className="py-3 text-right text-gray-600">{asset.currentPrice > 0 ? asset.currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                        <td className="py-3 text-right font-bold text-gray-900">{asset.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // PAGINA 10: CATEGORIAS (CUSTOMIZÁVEL)
    const renderCategories = () => {
        // 1. (Removido) Filtragem por Busca
        // 2. Ordenação Alfabética
        const sortedCategories = [...data.categories].sort((a, b) => a.name.localeCompare(b.name));

        // 3. Agrupamento
        const groupedCategories = sortedCategories.reduce((acc, cat) => {
            const groupKey = cat.group || 'Outros';
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(cat);
            return acc;
        }, {} as Record<string, CategoryItem[]>);

        // 4. Definição da Ordem dos Grupos (Dinâmica)
        // Pega a lista padrão, mas adiciona qualquer grupo extra que esteja nos dados atuais
        const defaultGroupOrder: string[] = ['Receitas', 'Essencial', 'Saúde', 'Social', 'Transporte', 'Financeiro', 'Extra', 'Presentes', 'Profissional', 'Outros'];
        const currentGroups = Object.keys(groupedCategories);
        const finalGroupOrder = Array.from(new Set([...defaultGroupOrder, ...currentGroups]));

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div className="w-full">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-gray-500" /> Gerenciamento de Categorias Globais
                            </h3>
                            <p className="text-gray-500 text-sm mb-4">Adicione categorias personalizadas disponíveis para TODOS os usuários e clientes.</p>

                            {/* ADICIONAR NOVA CATEGORIA */}
                            <div className="flex gap-2 items-end mb-4 md:mb-0">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 block mb-1">Nova Categoria</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Natação, Curso de Python..."
                                        className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                    />
                                </div>
                                <div className="w-40">
                                    <label className="text-xs font-bold text-gray-500 block mb-1">Grupo</label>
                                    <select
                                        className="w-full border p-2 rounded-lg text-sm bg-white"
                                        value={newCategoryGroup}
                                        onChange={(e) => setNewCategoryGroup(e.target.value as CategoryGroup)}
                                    >
                                        {finalGroupOrder.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <button
                                    onClick={handleAddCategory}
                                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg h-[38px] w-[38px] flex items-center justify-center transition-colors"
                                    title="Adicionar"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full md:w-auto items-end">
                            <button
                                onClick={handleRestoreCategories}
                                className="text-xs text-blue-500 hover:text-blue-700 flex items-center justify-center gap-1 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors w-full md:w-auto"
                            >
                                <RotateCcw className="w-3 h-3" /> Sincronizar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {finalGroupOrder.map(group => {
                        const cats = groupedCategories[group] || [];
                        if (cats.length === 0) return null;

                        return (
                            <div key={group} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                                <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                                    <h4 className="font-bold text-gray-700 text-sm">{group}</h4>
                                    <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded border">{cats.length}</span>
                                </div>
                                <div className="p-4 flex flex-wrap gap-2">
                                    {cats.map(cat => (
                                        <div key={cat.id} className={`group flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 ${cat.isCustom ? 'border-blue-200 bg-blue-50' : ''} hover:border-blue-300 transition-colors`}>
                                            <span>{cat.name}</span>
                                            {cat.isCustom && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation(); // Importante para não fechar acordeons ou disparar pais
                                                        handleDeleteCategory(cat.id);
                                                    }}
                                                    className="ml-1 z-10 relative cursor-pointer text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors p-2 flex items-center justify-center"
                                                    title="Remover (Global)"
                                                >
                                                    <X className="w-4 h-4 pointer-events-none" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    };

    // RENDER SIMULATION (ANTIGO RENDER SIMULATION SUMMARY)
    const renderSimulation = () => {
        // Calcula patrimônio ATIVO (bens e direitos) para a simulação, ignorando dívidas no montante inicial se desejar, 
        // mas geralmente simula-se o PL. Vamos usar PL.
        const liabilities = data.assets.filter(a => a.type === 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
        const totalAssets = data.assets.filter(a => a.type !== 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
        const netWorth = totalAssets - liabilities;

        const estimatedMonthlySave = Math.max(0, data.personalData.netIncomeAnnual / 12 * 0.2);

        const simConfig = {
            ...data.simulation,
            initialPatrimony: data.simulation.initialPatrimony || netWorth, // Usa o PL como base
            monthlyContribution: data.simulation.monthlyContribution || estimatedMonthlySave
        };

        const projection = [];
        let currentBalance = simConfig.initialPatrimony;
        let totalInvested = simConfig.initialPatrimony;
        const monthlyRate = Math.pow(1 + simConfig.interestRateReal, 1 / 12) - 1;

        for (let year = 0; year <= simConfig.years; year++) {
            projection.push({
                year: new Date().getFullYear() + year,
                value: Math.round(currentBalance),
                invested: Math.round(totalInvested)
            });
            for (let m = 0; m < 12; m++) {
                currentBalance = currentBalance * (1 + monthlyRate) + simConfig.monthlyContribution;
                totalInvested += simConfig.monthlyContribution;
            }
        }

        const finalValue = projection[projection.length - 1].value;
        const finalInvested = projection[projection.length - 1].invested;

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
                <div className="flex justify-between items-end border-b pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Resumo da Simulação</h3>
                        <p className="text-gray-500">Evolução patrimonial projetada para {simConfig.years} anos.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Patrimônio Final Projetado</p>
                        <p className="text-3xl font-bold text-green-600">{finalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>

                <PatrimonyChart data={projection} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium">Total Aportado</p>
                        <p className="text-xl font-bold text-blue-900">{finalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">Juros Compostos</p>
                        <p className="text-xl font-bold text-green-900">{(finalValue - finalInvested).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-700 font-medium">Multiplicador</p>
                        <p className="text-xl font-bold text-purple-900">{(finalValue / (finalInvested || 1)).toFixed(2)}x</p>
                        <p className="text-xs text-purple-600">seu dinheiro investido</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderDetailedSimulation = () => {
        const handleChange = (field: keyof typeof data.simulation, value: string) => {
            setData(prev => ({
                ...prev,
                simulation: { ...prev.simulation, [field]: parseFloat(value) || 0 }
            }));
        };

        const monthlyRate = Math.pow(1 + data.simulation.interestRateReal, 1 / 12) - 1;
        let currentBalance = data.simulation.initialPatrimony;
        const rows = [];

        for (let m = 1; m <= 60; m++) {
            const interest = currentBalance * monthlyRate;
            const contribution = data.simulation.monthlyContribution;
            const prevBalance = currentBalance;
            currentBalance = prevBalance + interest + contribution;

            rows.push({ month: m, prevBalance, interest, contribution, currentBalance });
        }

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sliders className="w-5 h-5" /> Parâmetros da Simulação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Aporte Mensal (R$)</label>
                            <input type="number" className="w-full border p-2 rounded" value={data.simulation.monthlyContribution} onChange={e => handleChange('monthlyContribution', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Patrimônio Inicial (R$)</label>
                            <input type="number" className="w-full border p-2 rounded" value={data.simulation.initialPatrimony} onChange={e => handleChange('initialPatrimony', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Taxa Real Anual (%)</label>
                            <input type="number" step="0.01" className="w-full border p-2 rounded" value={(data.simulation.interestRateReal * 100).toFixed(2)} onChange={e => handleChange('interestRateReal', (parseFloat(e.target.value) / 100).toString())} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Anos</label>
                            <input type="number" className="w-full border p-2 rounded" value={data.simulation.years} onChange={e => handleChange('years', e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b font-bold bg-gray-50">Fluxo Mensal (Primeiros 5 Anos)</div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600">
                                    <th className="p-3 text-center">Mês</th>
                                    <th className="p-3">Saldo Inicial</th>
                                    <th className="p-3 text-green-600">Juros (+)</th>
                                    <th className="p-3 text-blue-600">Aporte (+)</th>
                                    <th className="p-3 font-bold">Saldo Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rows.map(r => (
                                    <tr key={r.month} className="hover:bg-gray-50">
                                        <td className="p-3 text-center">{r.month}</td>
                                        <td className="p-3 text-gray-500">{r.prevBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-3 text-green-600">+{r.interest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-3 text-blue-600">+{r.contribution.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-3 font-bold">{r.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    const renderDecumulation = () => {
        // Calculadora simples de Perpetuidade / Decumulação
        // Usa estado local do App (decumulationConfig)

        // Cálculo de Perpetuidade: V = R / i
        const perpetuityCapital = (decumulationConfig.withdrawal * 12) / decumulationConfig.interestRate;

        // Cálculo de Duração (NPER)
        // PMT = withdrawal, PV = capital, i = monthly rate
        const monthlyRate = Math.pow(1 + decumulationConfig.interestRate, 1 / 12) - 1;
        const monthlyWithdrawal = decumulationConfig.withdrawal;
        const currentCapital = decumulationConfig.capital;

        let yearsLasting = Infinity;

        // Se a retirada mensal for maior que o rendimento mensal, o capital decresce
        if (monthlyWithdrawal > currentCapital * monthlyRate) {
            // n = -ln(1 - (PV * i) / PMT) / ln(1 + i)
            // (PV * i) / PMT
            const incomeRatio = (currentCapital * monthlyRate) / monthlyWithdrawal;
            if (incomeRatio < 1) {
                const nMonths = -Math.log(1 - incomeRatio) / Math.log(1 + monthlyRate);
                yearsLasting = nMonths / 12;
            }
        }

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-purple-600" /> Planejamento de Independência Financeira
                    </h3>
                    <p className="text-gray-500 text-sm mb-6">Simule quanto tempo seu patrimônio dura dado um padrão de vida (retirada mensal), ou quanto você precisa acumular para viver de renda passiva (perpetuidade).</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Capital Acumulado (R$)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-400 text-sm">R$</span>
                                <input
                                    type="number"
                                    className="w-full border p-2 pl-8 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    value={decumulationConfig.capital}
                                    onChange={e => setDecumulationConfig({ ...decumulationConfig, capital: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Retirada Mensal Desejada (R$)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-400 text-sm">R$</span>
                                <input
                                    type="number"
                                    className="w-full border p-2 pl-8 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    value={decumulationConfig.withdrawal}
                                    onChange={e => setDecumulationConfig({ ...decumulationConfig, withdrawal: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Rentabilidade Real Anual (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full border p-2 pr-8 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    value={(decumulationConfig.interestRate * 100).toFixed(1)}
                                    onChange={e => setDecumulationConfig({ ...decumulationConfig, interestRate: Number(e.target.value) / 100 })}
                                />
                                <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                        <p className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-2">Para Viver de Renda (Perpetuidade)</p>
                        <p className="text-gray-400 text-xs mb-4">Capital necessário para sacar {decumulationConfig.withdrawal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês sem reduzir o principal.</p>
                        <p className="text-4xl font-bold text-blue-600 mb-2">{perpetuityCapital.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>

                        <div className="mt-4 text-sm bg-blue-50 text-blue-700 py-1 px-3 rounded-full">
                            Meta FIRE
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${yearsLasting === Infinity ? 'from-green-400 to-emerald-500' : 'from-orange-400 to-red-500'}`}></div>
                        <p className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-2">Cenário Atual</p>
                        <p className="text-gray-400 text-xs mb-4">Com o capital de {decumulationConfig.capital.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, quanto tempo dura?</p>

                        <p className={`text-4xl font-bold mb-2 ${yearsLasting === Infinity ? 'text-green-600' : yearsLasting < 10 ? 'text-red-500' : 'text-orange-500'}`}>
                            {yearsLasting === Infinity ? 'Infinito' : `${yearsLasting.toFixed(1)} Anos`}
                        </p>

                        <div className={`mt-4 text-sm py-1 px-3 rounded-full ${yearsLasting === Infinity ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                            {yearsLasting === Infinity
                                ? 'Independência Financeira Atingida! 🚀'
                                : 'Fase de Decumulação (Consumo) 📉'}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderProjectionScenarios = () => {
        // Cálculo do Patrimônio Líquido Real (Fallback)
        const liabilities = data.assets.filter(a => a.type === 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
        const totalAssets = data.assets.filter(a => a.type !== 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
        const netWorth = totalAssets - liabilities;

        // Estimativa de Aporte (Fallback - 20% da renda mensal)
        const estimatedMonthlySave = data.personalData.netIncomeAnnual ? (data.personalData.netIncomeAnnual / 12 * 0.2) : 0;

        const years = data.simulation.years || 30;

        // Usa o valor da simulação manual OU o cálculo real como fallback
        const initial = data.simulation.initialPatrimony || netWorth;
        const monthlyContribution = data.simulation.monthlyContribution || estimatedMonthlySave;

        if (initial <= 0 && monthlyContribution <= 0) {
            return (
                <div className="bg-white p-12 rounded-xl border border-dashed text-center">
                    <LineChart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Sem dados para projeção</h3>
                    <p className="text-gray-500 mt-2">Cadastre ativos ou aportes na simulação para ver os cenários.</p>
                </div>
            )
        }

        const dataPoints = [];
        let p = initial; // Pessimista (4%)
        let r = initial; // Realista (6%)
        let o = initial; // Otimista (10%)
        const contrib = monthlyContribution * 12; // Anualiza o aporte

        for (let y = 0; y <= years; y++) {
            dataPoints.push({
                year: new Date().getFullYear() + y,
                pessimista: Math.round(p),
                realista: Math.round(r),
                otimista: Math.round(o)
            });
            p = (p + contrib) * 1.04;
            r = (r + contrib) * 1.06;
            o = (o + contrib) * 1.10;
        }

        const finalData = dataPoints[dataPoints.length - 1] || dataPoints[0];

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
                <h3 className="text-xl font-bold text-gray-800">Comparativo de Cenários</h3>
                <p className="text-gray-500 mb-4">Como a taxa de juros impacta seu patrimônio no longo prazo.</p>

                <ScenarioChart data={dataPoints} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-6">
                    <div className="p-4 border-t-4 border-orange-400 bg-orange-50">
                        <p className="font-bold text-orange-900">Pessimista (4% a.a.)</p>
                        <p className="text-lg">{finalData.pessimista.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="p-4 border-t-4 border-teal-400 bg-teal-50">
                        <p className="font-bold text-teal-900">Realista (6% a.a.)</p>
                        <p className="text-lg font-bold">{finalData.realista.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="p-4 border-t-4 border-blue-400 bg-blue-50">
                        <p className="font-bold text-blue-900">Otimista (10% a.a.)</p>
                        <p className="text-lg">{finalData.otimista.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderCashFlow = () => {
        if (data.transactions.length === 0) {
            return (
                <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
                    <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Sem dados de fluxo financeiro</h3>
                    <p className="text-gray-500 mt-2">O fluxo financeiro é gerado a partir das transações importadas na aba 11.</p>
                </div>
            );
        }

        // Processamento de dados mensais consolidados e por grupo
        const monthlyDataMap: Record<string, { income: number; expenses: number }> = {};
        const monthlyCategoryMatrix: Record<string, Record<string, number>> = {};
        const categoryGroupsSet = new Set<string>(Object.keys(groupBudgets)); // Começa com grupos que já têm orçamento planejado

        data.transactions.forEach(t => {
            if (!t.date) return;
            const monthKey = t.date.substring(0, 7); // YYYY-MM
            if (!monthlyDataMap[monthKey]) {
                monthlyDataMap[monthKey] = { income: 0, expenses: 0 };
            }
            if (!monthlyCategoryMatrix[monthKey]) {
                monthlyCategoryMatrix[monthKey] = {};
            }

            const group = data.categories.find(c => c.name === t.category)?.group || getCategoryGroup(t.category);

            if (group === 'Receitas') {
                monthlyDataMap[monthKey].income += t.amount;
            } else if (group !== ('Pagamentos' as any)) {
                monthlyDataMap[monthKey].expenses += Math.abs(t.amount);

                // Adiciona ao detalhamento por grupo
                const groupName = group as string;
                categoryGroupsSet.add(groupName);
                monthlyCategoryMatrix[monthKey][groupName] = (monthlyCategoryMatrix[monthKey][groupName] || 0) + Math.abs(t.amount);
            }
        });

        // Ordenação dos meses
        const sortedMonths = Object.keys(monthlyDataMap).sort();
        const sortedCategoryGroups = Array.from(categoryGroupsSet).sort();

        const chartData = sortedMonths.map((month) => {
            const values = monthlyDataMap[month];
            const incomeValue = manualIncomes[month] !== undefined ? manualIncomes[month] : values.income;

            return {
                id: month,
                name: month.split('-').reverse().join('/'),
                entradas: incomeValue,
                saidas: values.expenses,
                resultado: incomeValue - values.expenses,
                isEdited: manualIncomes[month] !== undefined
            };
        });

        const totalIncome = chartData.reduce((acc, curr) => acc + curr.entradas, 0);
        const totalExpenses = chartData.reduce((acc, curr) => acc + curr.saidas, 0);
        const averageMargin = chartData.length > 0 ? (totalIncome - totalExpenses) / (totalIncome || 1) * 100 : 0;

        return (
            <div className="space-y-8 animate-fade-in-up pb-20">
                {/* CARDS DE RESUMO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Entradas</p>
                            <p className="text-xl font-bold text-green-600">{totalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                            <TrendingDown className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Saídas</p>
                            <p className="text-xl font-bold text-red-600">{totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <Scale className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Margem Média</p>
                            <p className="text-xl font-bold text-blue-600">{averageMargin.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                {/* GRÁFICO DE LINHAS E BARRAS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" /> Fluxo Mensal Consolidado
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                                <Legend />
                                <Bar dataKey="entradas" name="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} barSize={35} />
                                <Bar dataKey="saidas" name="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={35} />
                                <Line type="monotone" dataKey="resultado" name="Resultado Líquido" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* TABELA CONSOLIDADA COM EDIÇÃO MANUAL */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                            <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Fluxo de Caixa Mensal
                        </h4>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    if (cashFlowEditMode) setManualIncomes({});
                                    setCashFlowEditMode(!cashFlowEditMode);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${cashFlowEditMode ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {cashFlowEditMode ? <X className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                                {cashFlowEditMode ? 'Cancelar Edição' : 'Habilitar Edição de Entradas'}
                            </button>

                            {cashFlowEditMode && Object.keys(manualIncomes).length > 0 && (
                                <button
                                    onClick={() => handleSaveManualCashFlow(monthlyDataMap)}
                                    disabled={isSavingCashFlow}
                                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50"
                                >
                                    {isSavingCashFlow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    Salvar Entradas
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-widest">
                                <tr>
                                    <th className="p-4">Período</th>
                                    <th className="p-4 text-right">Entradas (R$)</th>
                                    <th className="p-4 text-right">Saídas (R$)</th>
                                    <th className="p-4 text-right">Resultado (R$)</th>
                                    <th className="p-4 text-right">Margem (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {[...chartData].reverse().map((row, idx) => {
                                    const margin = (row.entradas > 0) ? (row.resultado / row.entradas * 100) : 0;
                                    return (
                                        <tr key={idx} className={`hover:bg-gray-50 transition-colors ${row.isEdited ? 'bg-blue-50/30' : ''}`}>
                                            <td className="p-4 font-medium text-gray-700 flex items-center gap-2">
                                                {row.name}
                                                {row.isEdited && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">Manual</span>}
                                            </td>
                                            <td className="p-4 text-right">
                                                {cashFlowEditMode ? (
                                                    <div className="flex justify-end items-center gap-1">
                                                        <span className="text-gray-400 text-xs">R$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-32 border border-blue-200 rounded px-2 py-1 text-right focus:ring-2 focus:ring-blue-500 outline-none font-bold text-green-600"
                                                            value={manualIncomes[row.id] !== undefined ? manualIncomes[row.id] : row.entradas}
                                                            onChange={(e) => handleManualIncomeChange(row.id, parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-green-600 font-medium">{row.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right text-red-500 font-medium">{row.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td className={`p-4 text-right font-bold ${row.resultado >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{row.resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td className={`p-4 text-right font-bold ${margin >= 20 ? 'text-green-600' : margin >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                                {margin.toFixed(1)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SEÇÃO: DETALHAMENTO MENSAL POR CATEGORIA COM COLUNA ORÇADO */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4 text-indigo-600" /> Detalhamento de Saídas por Grupo
                            </h4>

                            {/* BOTÃO PARA ADICIONAR GRUPO MANUALMENTE */}
                            {isAddingManualGroup ? (
                                <div className="flex items-center gap-1 animate-fade-in">
                                    <input
                                        autoFocus
                                        type="text"
                                        className="border rounded px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Nome do grupo..."
                                        value={newManualGroupName}
                                        onChange={(e) => setNewManualGroupName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmManualGroup()}
                                    />
                                    <button onClick={handleConfirmManualGroup} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setIsAddingManualGroup(false)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingManualGroup(true)}
                                    className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-100 transition-colors font-bold uppercase tracking-wider"
                                >
                                    <Plus className="w-3 h-3" /> Adicionar Grupo
                                </button>
                            )}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest flex items-center gap-1">
                            <Target className="w-3 h-3" /> Metas do Consultor
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] tracking-widest">
                                <tr>
                                    <th className="p-4 sticky left-0 bg-gray-50 z-10 border-r min-w-[150px]">Grupo</th>
                                    <th className="p-4 bg-indigo-50/50 text-indigo-700 min-w-[140px] text-center border-r">Orçado (Mensal)</th>
                                    {sortedMonths.map(month => (
                                        <th key={month} className="p-4 text-right whitespace-nowrap">{month.split('-').reverse().join('/')}</th>
                                    ))}
                                    <th className="p-4 text-right border-l font-black bg-gray-100">Média Real</th>
                                    <th className="p-4 text-right border-l font-black bg-gray-100">Desvio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {sortedCategoryGroups.map(group => {
                                    let totalRow = 0;
                                    sortedMonths.forEach(m => totalRow += (monthlyCategoryMatrix[m][group] || 0));
                                    const avgReal = totalRow / (sortedMonths.length || 1);
                                    const budgeted = groupBudgets[group] || 0;
                                    const variance = budgeted > 0 ? (avgReal - budgeted) : 0;

                                    return (
                                        <tr key={group} className="hover:bg-gray-50 transition-colors group/row">
                                            <td className="p-4 font-bold text-gray-700 sticky left-0 bg-white border-r group-hover/row:bg-gray-50">{group}</td>
                                            <td className="p-2 bg-indigo-50/20 border-r">
                                                <div className="flex items-center gap-1 px-2">
                                                    <span className="text-[10px] text-indigo-400">R$</span>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-transparent border-b border-indigo-100 focus:border-indigo-500 outline-none text-right font-bold text-indigo-700 p-1"
                                                        placeholder="0,00"
                                                        value={budgeted || ''}
                                                        onChange={(e) => handleGroupBudgetChange(group, parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </td>
                                            {sortedMonths.map(month => {
                                                const val = monthlyCategoryMatrix[month][group] || 0;
                                                return (
                                                    <td key={`${month}-${group}`} className="p-4 text-right text-gray-500">
                                                        {val > 0 ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-4 text-right border-l font-bold bg-gray-50 text-gray-900">
                                                {avgReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className={`p-4 text-right border-l font-black bg-gray-50 ${variance > 0 ? 'text-red-500' : variance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                {budgeted > 0 ? (
                                                    <div className="flex flex-col items-end">
                                                        <span>{variance > 0 ? '+' : ''}{variance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        <span className="text-[9px] opacity-70">({((variance / budgeted) * 100).toFixed(1)}%)</span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-100 font-black">
                                <tr>
                                    <td className="p-4 sticky left-0 bg-gray-100 border-r">TOTAL MENSAL</td>
                                    <td className="p-4 bg-indigo-100/50 text-indigo-800 text-right border-r">
                                        {Object.values(groupBudgets).reduce((a, b) => a + b, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    {sortedMonths.map(month => {
                                        const totalMonth = sortedCategoryGroups.reduce((acc, g) => acc + (monthlyCategoryMatrix[month][g] || 0), 0);
                                        return (
                                            <td key={`foot-${month}`} className="p-4 text-right text-red-600">
                                                {totalMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        );
                                    })}
                                    <td className="p-4 text-right border-l text-red-700">
                                        {(totalExpenses / (sortedMonths.length || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 border-l bg-gray-200"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div className="bg-gray-50 p-3 text-[10px] text-gray-400 italic flex justify-center border-t border-dashed gap-4">
                        <span>* <strong>Orçado:</strong> Valor mensal planejado pelo consultor.</span>
                        <span>* <strong>Desvio:</strong> Diferença entre a média real dos meses e o orçado.</span>
                    </div>
                </div>
            </div>
        );
    };

    // PAGINA ESPECIAL: CALCULADORA PGBL
    const renderPGBL = () => {
        const details = data.personalData.incomeDetails;
        const dependents = data.personalData.dependents;

        // 1. DADOS DE ENTRADA
        const grossIncome = details?.grossAmount || 0;
        const officialINSS = details?.inss || 0;
        const medicalExp = details?.medicalExpenses || 0;
        const educationExp = details?.educationExpenses || 0;
        const numDependents = dependents?.length || 0;

        // 2. PARÂMETROS FISCAIS (Anual 2025 - Estimado)
        const DEDUCTION_PER_DEPENDENT = 2275.08;
        const DISCOUNT_SIMPLIFIED_LIMIT = 16754.34; // 20% limitado a este valor
        const EDUCATION_LIMIT_PER_PERSON = 3561.50; // Limite individual

        // 3. CÁLCULOS INTERMEDIÁRIOS
        const deductionDependents = numDependents * DEDUCTION_PER_DEPENDENT;
        // Assumindo que a despesa de educação é bem distribuída ou única, aplicamos uma trava simples global baseada no nº de pessoas (titular + deps)
        // O ideal seria input por pessoa, mas vamos simplificar:
        const educationDeductible = Math.min(educationExp, (numDependents + 1) * EDUCATION_LIMIT_PER_PERSON);

        const totalDeductionsNoPGBL = officialINSS + deductionDependents + medicalExp + educationDeductible;

        // Limite PGBL (12% da Bruta)
        const pgblLimit = grossIncome * 0.12;

        // 4. CENÁRIOS DE BASE DE CÁLCULO

        // A) Simplificado
        const simplifiedDiscount = Math.min(grossIncome * 0.20, DISCOUNT_SIMPLIFIED_LIMIT);
        const baseSimplified = Math.max(0, grossIncome - simplifiedDiscount);

        // B) Completo Sem PGBL
        const baseCompleteNoPGBL = Math.max(0, grossIncome - totalDeductionsNoPGBL);

        // C) Completo Com PGBL Máximo
        const baseCompleteWithPGBL = Math.max(0, grossIncome - totalDeductionsNoPGBL - pgblLimit);

        // FUNÇÃO DE CÁLCULO DE IR (Tabela Progressiva Anual 2025)
        const calculateIR = (base: number) => {
            let tax = 0;
            // Faixas anualizadas aproximadas
            if (base <= 27110.40) {
                tax = 0;
            } else if (base <= 33919.80) {
                tax = (base * 0.075) - 2033.28;
            } else if (base <= 45012.60) {
                tax = (base * 0.15) - 4577.28;
            } else if (base <= 55976.16) {
                tax = (base * 0.225) - 7953.24;
            } else {
                tax = (base * 0.275) - 10752.00;
            }
            return Math.max(0, tax);
        };

        const taxSimplified = calculateIR(baseSimplified);
        const taxCompleteNoPGBL = calculateIR(baseCompleteNoPGBL);
        const taxCompleteWithPGBL = calculateIR(baseCompleteWithPGBL);

        // ECONOMIA
        const taxSavings = taxCompleteNoPGBL - taxCompleteWithPGBL;
        const benefitVsSimplified = taxSimplified - taxCompleteWithPGBL;

        // Melhor estratégia atual (sem aporte extra)
        const currentBestStrategy = taxSimplified < taxCompleteNoPGBL ? 'Simplificado' : 'Completo';

        return (
            <div className="space-y-8 animate-fade-in pb-20">
                {/* CABEÇALHO */}
                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Calculadora PGBL & Benefício Fiscal</h2>
                            <p className="text-blue-200">
                                Descubra o potencial de restituição de IR investindo em Previdência Privada.
                            </p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center min-w-[200px]">
                            <p className="text-sm text-blue-200 mb-1">Potencial Máximo de Aporte</p>
                            <p className="text-3xl font-bold text-green-400">{pgblLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p className="text-[10px] text-blue-300">12% da Renda Bruta</p>
                        </div>
                    </div>
                </div>

                {/* DADOS UTILIZADOS */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            Dados Considerados (Anual)
                        </h3>
                        <button onClick={() => setActiveTab(0)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Edit2 className="w-3 h-3" /> Editar na Aba 1
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Renda Bruta</p>
                            <p className="font-bold text-gray-900 text-lg">{grossIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">INSS Oficial</p>
                            <p className="font-bold text-gray-900 text-lg">{officialINSS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Dependentes</p>
                            <p className="font-bold text-gray-900 text-lg">{numDependents} <span className="text-xs font-normal text-gray-400">({(deductionDependents).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span></p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Saúde + Educação</p>
                            <p className="font-bold text-gray-900 text-lg">{(medicalExp + educationExp).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p className="text-[10px] text-gray-400">Dedutível Edu: {educationDeductible.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                </div>

                {/* COMPARAÇÃO DE CENÁRIOS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* CENÁRIO 1: SIMPLIFICADO */}
                    <div className={`p-6 rounded-xl border-2 transition-all ${currentBestStrategy === 'Simplificado' && baseCompleteWithPGBL > baseSimplified ? 'border-green-500 bg-green-50 shadow-lg scale-105' : 'border-gray-100 bg-white'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="font-bold text-gray-700">Modelo Simplificado</h4>
                            {currentBestStrategy === 'Simplificado' && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">ATUAL MELHOR</span>}
                        </div>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Base de Cálculo</span>
                                <span className="font-medium">{baseSimplified.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Desconto Padrão (20%)</span>
                                <span className="text-red-500">-{simplifiedDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                        <div className="pt-4 border-t">
                            <p className="text-xs text-gray-500 text-center uppercase">Imposto Devido Estimado</p>
                            <p className={`text-2xl font-bold text-center mt-1 ${currentBestStrategy === 'Simplificado' ? 'text-green-700' : 'text-gray-700'}`}>
                                {taxSimplified.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>

                    {/* CENÁRIO 2: COMPLETO ATUAL */}
                    <div className={`p-6 rounded-xl border-2 transition-all ${currentBestStrategy === 'Completo' ? 'border-green-500 bg-green-50 shadow-lg scale-105' : 'border-gray-100 bg-white'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="font-bold text-gray-700">Completo (Sem Aporte)</h4>
                            {currentBestStrategy === 'Completo' && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">ATUAL MELHOR</span>}
                        </div>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Base de Cálculo</span>
                                <span className="font-medium">{baseCompleteNoPGBL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Total Deduções</span>
                                <span className="text-red-500">-{totalDeductionsNoPGBL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                        <div className="pt-4 border-t">
                            <p className="text-xs text-gray-500 text-center uppercase">Imposto Devido Estimado</p>
                            <p className={`text-2xl font-bold text-center mt-1 ${currentBestStrategy === 'Completo' ? 'text-green-700' : 'text-gray-700'}`}>
                                {taxCompleteNoPGBL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>

                    {/* CENÁRIO 3: ESTRATÉGIA PGBL */}
                    <div className="p-6 rounded-xl border-2 border-indigo-500 bg-indigo-50 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                            RECOMENDADO
                        </div>
                        <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Com Aporte PGBL (12%)
                        </h4>

                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-indigo-700/70">Base de Cálculo Otimizada</span>
                                <span className="font-medium text-indigo-900">{baseCompleteWithPGBL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                                <span className="text-indigo-700">Aporte Necessário</span>
                                <span className="text-indigo-700">{pgblLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-indigo-200">
                            <p className="text-xs text-indigo-600 text-center uppercase">Imposto Devido Otimizado</p>
                            <p className="text-3xl font-bold text-center mt-1 text-indigo-700">
                                {taxCompleteWithPGBL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <div className="mt-3 bg-white/60 rounded-lg p-2 text-center">
                                <p className="text-xs text-gray-600">Economia Fiscal Gerada:</p>
                                <p className="font-bold text-green-600 text-lg">
                                    {Math.max(taxSimplified, taxCompleteNoPGBL) - taxCompleteWithPGBL > 0
                                        ? (Math.max(taxSimplified, taxCompleteNoPGBL) - taxCompleteWithPGBL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                        : 'R$ 0,00'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CONCLUSÃO */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-blue-500 border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-2">Análise do Consultor</h3>
                    {taxCompleteWithPGBL < Math.min(taxSimplified, taxCompleteNoPGBL) ? (
                        <p className="text-gray-600 text-sm leading-relaxed">
                            Ao realizar um aporte de <strong>{pgblLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> em um plano PGBL, o cliente reduz sua base tributável e economiza
                            aprox. <strong>{(Math.min(taxSimplified, taxCompleteNoPGBL) - taxCompleteWithPGBL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> em Imposto de Renda.
                            Este valor que seria pago ao governo agora compõe o patrimônio do cliente, rendendo juros compostos.
                        </p>
                    ) : (
                        <p className="text-gray-600 text-sm">
                            Neste cenário, mesmo com o aporte máximo em PGBL, o modelo Simplificado ainda pode ser vantajoso ou a diferença é irrelevante.
                            Verifique se todas as despesas dedutíveis (Médicas, Educação) foram lançadas corretamente na Aba 1.
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const renderUpload = () => {
        const isApiConfigured = !!import.meta.env.VITE_API_KEY && import.meta.env.VITE_API_KEY.length > 0;

        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">11. Upload Inteligente de Arquivos</h2>
                    <p className="text-gray-500">Carregue múltiplos extratos bancários (PDF, CSV) para processamento em fila.</p>

                    <div className="mt-2 flex justify-center gap-2">
                        {!data.selectedClientId && (
                            <div className="text-amber-600 text-xs bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-200">
                                ⚠️ Nenhum cliente selecionado (Será detectado automaticamente)
                            </div>
                        )}

                        <div className={`text-xs px-3 py-1 rounded-full border ${isApiConfigured ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                            {isApiConfigured ? 'API Key: Configurada ✅' : 'API Key: Ausente ❌ (Verifique Vercel)'}
                        </div>
                    </div>
                </div>

                {/* --- CUSTOM CONTEXT INPUT --- */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase">
                        <MessageSquare className="w-4 h-4 text-blue-500" /> Contexto Adicional (Opcional)
                    </h3>
                    <textarea
                        className="w-full border p-3 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        rows={3}
                        placeholder="Ex: 'Considere todas as compras na Amazon como Presentes', 'Este extrato é da conta conjunta, divida tudo por 2', 'Ignore transações da empresa X'..."
                        value={customContext}
                        onChange={e => setCustomContext(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-2 text-right">Estas instruções serão enviadas para a IA antes do processamento.</p>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.csv,.ofx,.txt" multiple />

                <div onClick={triggerFileInput} className={`bg-white p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors ${isProcessingQueue ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
                    <p className="font-bold text-gray-700">Clique para adicionar arquivos à fila</p>
                    <p className="text-sm text-gray-500">Suporta múltiplos PDFs e CSVs</p>
                </div>

                {/* FILE QUEUE LIST */}
                {fileQueue.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Fila de Processamento ({fileQueue.length})</h3>
                            {isProcessingQueue ? (
                                <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processando...</span>
                            ) : (
                                <button onClick={() => setFileQueue([])} className="text-xs text-red-500 hover:text-red-700">Limpar tudo</button>
                            )}
                        </div>
                        <div className="divide-y">
                            {fileQueue.map((item) => (
                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-2 rounded-lg ${item.status === 'error' ? 'bg-red-100 text-red-600' : item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {formatFileSize(item.file.size)} •
                                                <span className={`ml-1 ${item.status === 'error' ? 'text-red-500' : 'text-blue-600'}`}>
                                                    {item.status === 'queued' && 'Aguardando'}
                                                    {item.status === 'uploading' && `Enviando (${item.progress}%)`}
                                                    {item.status === 'extracting' && 'Lendo texto...'}
                                                    {item.status === 'processing_ai' && 'Analisando com IA...'}
                                                    {item.status === 'saving' && 'Salvando...'}
                                                    {item.status === 'completed' && 'Concluído'}
                                                    {item.status === 'error' && 'Falha'}
                                                </span>
                                            </p>
                                            {item.resultMessage && <p className="text-xs text-green-600 italic">{item.resultMessage}</p>}
                                            {item.error && <p className="text-xs text-red-500 italic truncate max-w-xs" title={item.error}>{item.error}</p>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {item.status === 'queued' && (
                                            <button onClick={() => removeFileFromQueue(item.id)} className="p-1 text-gray-400 hover:text-red-500">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        {(item.status === 'uploading' || item.status === 'extracting' || item.status === 'processing_ai' || item.status === 'saving') && (
                                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                        )}
                                        {item.status === 'completed' && (
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        )}
                                        {item.status === 'error' && (
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <button
                                onClick={processQueue}
                                disabled={isProcessingQueue || fileQueue.every(i => i.status === 'completed')}
                                className={`px-6 py-2 rounded-lg font-bold text-white flex items-center gap-2 ${isProcessingQueue || fileQueue.every(i => i.status === 'completed') ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isProcessingQueue ? <Loader2 className="animate-spin w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                {isProcessingQueue ? 'Processando Fila...' : 'Processar Todos'}
                            </button>
                        </div>
                    </div>
                )}

                {processingLog.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Log de Atividades</h4>
                        <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs h-40 overflow-y-auto">
                            {processingLog.map((log, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">{log}</div>)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const TABS = [
        { id: 0, title: '1. Resumo Pessoal', icon: Activity, render: renderSummary },
        { id: 1, title: '2. Orçamento', icon: Calculator, render: renderBudget },
        { id: 2, title: '3. Movimentações', icon: FileText, render: renderRealized },
        { id: 3, title: '4. Balanço Patrimonial', icon: Layers, render: renderBalanceSheet },
        { id: 4, title: '5. Calculadora PGBL', icon: Landmark, render: renderPGBL },
        { id: 5, title: '6. Investimentos', icon: TrendingUp, render: renderInvestments },
        { id: 6, title: '7. Resumo Sim.', icon: BarChart3, render: renderSimulation },
        { id: 7, title: '8. Sim. Detalhada', icon: DollarSign, render: renderDetailedSimulation },
        { id: 8, title: '9. S/ Perpetuidade', icon: Briefcase, render: renderDecumulation },
        { id: 9, title: '10. Projeção', icon: LineChart, render: renderProjectionScenarios },
        { id: 10, title: '11. Categorias', icon: Settings, render: renderCategories },
        { id: 11, title: '12. Upload / IA', icon: UploadCloud, render: renderUpload },
        { id: 12, title: '13. Clientes', icon: Users, render: renderClients },
        { id: 13, title: '14. Fluxo Financeiro', icon: ArrowRightLeft, render: renderCashFlow },
    ];

    if (loadingSession) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" /></div>;
    if (!session) return <Auth />;

    return (
        <div className="flex min-h-screen bg-gray-50 text-gray-900 relative">
            {/* PASSWORD CHANGE MODAL (FORCE OR VOLUNTARY) */}
            {(mustChangePassword || showPasswordModal) && (
                <ForcePasswordChangeModal
                    isForced={mustChangePassword}
                    onClose={() => {
                        setMustChangePassword(false);
                        setShowPasswordModal(false);
                    }}
                />
            )}

            <aside className={`${isSidebarExpanded ? 'w-64' : 'w-20'} bg-blue-900 text-white flex flex-col fixed h-full z-10 transition-all duration-300 overflow-y-auto custom-scrollbar`}>
                <div className={`p-6 border-b border-blue-800 flex items-center ${isSidebarExpanded ? 'justify-start gap-3' : 'justify-center'}`}>
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/50">
                        <BrainCircuit className="w-6 h-6 text-white" />
                    </div>
                    {isSidebarExpanded && (
                        <div>
                            <h1 className="text-xl font-bold text-white leading-none">FinPlanner</h1>
                            <p className="text-[10px] text-blue-200 mt-1 uppercase tracking-wider">Consultoria AI</p>
                        </div>
                    )}
                    <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="ml-auto text-blue-200 hover:text-white p-1 rounded hover:bg-blue-800 transition-colors">
                        {isSidebarExpanded ? <ChevronLeft className="w-5 h-5" /> : null}
                    </button>
                </div>
                {!isSidebarExpanded && (
                    <div className="flex justify-center py-2 border-b border-blue-800">
                        <button onClick={() => setIsSidebarExpanded(true)} className="text-blue-200 hover:text-white">
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>
                )}

                <nav className="flex-1 p-4 space-y-1">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center ${isSidebarExpanded ? 'justify-start px-4' : 'justify-center px-0'} py-3 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-blue-800 text-white shadow-md' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}
                                title={!isSidebarExpanded ? tab.title : ''}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {isSidebarExpanded && <span className="ml-3 truncate">{tab.title}</span>}
                            </button>
                        )
                    })}
                </nav>
                <div className="p-4 border-t border-blue-800 space-y-2">
                    <button onClick={handleTogglePasswordModal} className={`flex items-center ${isSidebarExpanded ? 'justify-start px-0' : 'justify-center'} gap-2 text-blue-200 hover:text-white transition-colors text-sm w-full`}>
                        <Key className="w-4 h-4 flex-shrink-0" /> {isSidebarExpanded && 'Trocar Senha'}
                    </button>
                    <button onClick={handleLogout} className={`flex items-center ${isSidebarExpanded ? 'justify-start px-0' : 'justify-center'} gap-2 text-blue-200 hover:text-white transition-colors text-sm w-full`}>
                        <LogOut className="w-4 h-4 flex-shrink-0" /> {isSidebarExpanded && 'Sair'}
                    </button>
                </div>
            </aside>

            <main className={`flex-1 ${isSidebarExpanded ? 'ml-64' : 'ml-20'} p-8 relative transition-all duration-300`}>
                {isLoadingData && (
                    <div className="absolute inset-0 bg-white/70 z-50 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    </div>
                )}
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{TABS[activeTab].title}</h2>
                        {/* Ocultar subtítulo apenas na página 3 (ID 2) */}
                        <p className="text-sm text-gray-500 mt-1">
                            {data.selectedClientId
                                ? `Cliente Selecionado: ${data.personalData.name}`
                                : 'Selecione um cliente na aba 12 ou faça upload.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* CLIENT SELECTOR HEADER */}
                        <div className="relative group">
                            <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm text-sm font-medium hover:bg-gray-50">
                                <Users className="w-4 h-4 text-blue-600" />
                                {data.selectedClientId
                                    ? data.clients.find(c => c.id === data.selectedClientId)?.name
                                    : 'Selecionar Cliente'}
                                <ChevronRight className="w-4 h-4 rotate-90" />
                            </button>
                            <div className="absolute right-0 top-full pt-2 w-56 hidden group-hover:block z-50">
                                <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-2 max-h-64 overflow-y-auto">
                                    {data.clients.length === 0 && <p className="text-xs text-gray-400 p-2">Sem clientes</p>}
                                    {data.clients.map(c => (
                                        <button key={c.id} onClick={() => handleSelectClient(c.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-lg flex items-center justify-between group/item">
                                            {c.name}
                                            {data.selectedClientId === c.id && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm">
                            {session.user.email?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <div className="animate-fade-in-up">{TABS[activeTab].render()}</div>
            </main>

            {/* SUCCESS TOAST */}
            {showSuccessAlert && (
                <div className={`fixed bottom-6 right-6 z-50 animate-bounce-in max-w-sm w-full bg-white rounded-xl shadow-2xl border-l-8 ${alertType === 'error' ? 'border-red-500' : 'border-green-500'} p-5 flex items-start gap-4`}>
                    {alertType === 'error' ? <AlertCircle className="w-6 h-6 text-red-600 mt-1" /> : <CheckCircle2 className="w-6 h-6 text-green-600 mt-1" />}
                    <div>
                        <h4 className="font-bold text-gray-900">{alertType === 'error' ? 'Atenção' : 'Sucesso!'}</h4>
                        <p className="text-gray-600 text-sm">{successMessage}</p>
                        <button onClick={() => setShowSuccessAlert(false)} className="text-sm text-gray-400 hover:text-gray-600 mt-2">Fechar</button>
                    </div>
                </div>
            )}
        </div>
    );
}
