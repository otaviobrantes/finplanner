
/**
 * POLÍTICA DE LAYOUT IMUTÁVEL - NÃO ALTERAR NADA VISUAL
 * 1. Sidebar: #1e3a8a
 * 2. Menu: Numerado 1 a 12
 * 3. Fonte: Inter / Sans
 * 4. Header: Botão 'Selecionar Cliente' arredondado (pills)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign,  
  FileText, Briefcase, Calculator, LineChart, Layers, 
  UploadCloud, Settings, ChevronRight, Activity, LogOut, FileCheck, AlertCircle, CheckCircle2, Loader2, Users, MapPin, Building, UserPlus, Trash2, Search, Sliders, Calendar, Lock, Key, X,
  ChevronLeft, Menu, MessageSquare, Edit2, Plus, Save, RotateCcw, Scale, BrainCircuit, ChevronDown, Filter, Table
} from 'lucide-react';
import { extractFinancialData } from './services/geminiService';
import { saveFinancialData, fetchClientData, fetchClients, createClient, deleteClient, updateTransactionCategory, fetchGlobalCategories, createGlobalCategory, deleteGlobalCategory } from './services/dbService';
import { uploadStatement } from './services/storageService';
import { parseFileContent } from './services/fileParser';
import { supabase } from './services/supabaseClient';
import { AppState, INITIAL_STATE, TransactionCategory, CategoryGroup, Client, CategoryItem, Transaction } from './types';
import { PatrimonyChart, AllocationChart, ExpensesBarChart, ScenarioChart } from './components/FinancialCharts';
import { Auth } from './components/Auth';

// Declaração global para checagem de debug
declare const __GEMINI_API_KEY__: string | undefined;

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

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Helper para normalizar data para YYYY-MM-DD
const normalizeToISO = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const clean = dateStr.split('T')[0].replace(/\//g, '-').trim();
    const parts = clean.split('-');
    if (parts.length !== 3) return clean;
    // Se for DD-MM-YYYY
    if (parts[0].length <= 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    // Se for YYYY-MM-DD
    if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return clean;
};

// Helper para exibir data no formato DD/MM/AAAA
const formatDisplayDate = (dateStr: string | null | undefined): string => {
    const iso = normalizeToISO(dateStr);
    if (!iso || iso.length < 10) return '-';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

// Helper para converter string BR (999.999,99) para número JS
const parseBRFloat = (val: string): number => {
    if (!val || val === '-') return 0;
    // Remove pontos de milhar e substitui vírgula decimal por ponto
    const clean = val.replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

// Helper para formatar número JS para string BR
const formatBRNumber = (num: number, useDashForZero: boolean = true): string => {
    if (num === 0 && useDashForZero) return '-';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getCategoryGroup = (cat: string): CategoryGroup => {
  const lowerCat = cat.toLowerCase();
  if (lowerCat === 'cartão de crédito' || lowerCat.includes('pagamento fatura') || lowerCat.includes('liquidação cartão')) return 'Pagamentos' as any;
  if (lowerCat.includes('salário') || lowerCat.includes('receita') || lowerCat.includes('dividendo') || lowerCat.includes('aluguéis') || lowerCat.includes('entradas') || lowerCat.includes('restituição')) return 'Receitas';
  if (lowerCat.includes('transporte') || lowerCat.includes('carro') || lowerCat.includes('uber') || lowerCat.includes('taxi') || lowerCat.includes('99') || lowerCat.includes('combustível') || lowerCat.includes('ipva') || lowerCat.includes('estacionamento') || lowerCat.includes('multa')) return 'Transporte';
  if (lowerCat.includes('restaurante') || lowerCat.includes('viagem') || lowerCat.includes('lazer') || lowerCat.includes('social') || lowerCat.includes('netflix') || lowerCat.includes('spotify') || lowerCat.includes('cinema') || lowerCat.includes('teatro') || lowerCat.includes('assinatura') || lowerCat.includes('roupa') || lowerCat.includes('calçado')) return 'Social';
  if (lowerCat.includes('saúde') || lowerCat.includes('médico') || lowerCat.includes('hospital') || lowerCat.includes('dentista') || lowerCat.includes('farmácia') || lowerCat.includes('drogaria') || lowerCat.includes('academia') || lowerCat.includes('vacina') || lowerCat.includes('lente') || lowerCat.includes('óculos')) return 'Saúde';
  if (lowerCat.includes('presente') || lowerCat.includes('festa')) return 'Presentes';
  if (lowerCat.includes('seguro') || lowerCat.includes('juros') || lowerCat.includes('doaç') || lowerCat.includes('planejador') || lowerCat.includes('iof') || lowerCat.includes('taxa')) return 'Financeiro';
  if (lowerCat.includes('consultora') || lowerCat.includes('arrumação') || lowerCat.includes('costureira')) return 'Extra';
  if (lowerCat.includes('entidade') || lowerCat.includes('oab') || lowerCat.includes('crm')) return 'Profissional';
  return 'Essencial';
};

const generateDefaultCategories = (): CategoryItem[] => {
    return Object.values(TransactionCategory).map(cat => ({
        id: generateId(),
        name: cat,
        group: getCategoryGroup(cat),
        isCustom: false
    }));
};

const ForcePasswordChangeModal = ({ onClose }: { onClose: () => void }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      const { error: metaError } = await supabase.auth.updateUser({ data: { force_password_change: false } });
      if (metaError) throw metaError;
      alert('Senha alterada com sucesso!');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-200">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4"><Key className="w-8 h-8" /></div>
          <h2 className="text-2xl font-bold text-gray-900">Troca de Senha Obrigatória</h2>
          <p className="text-center text-gray-500 mt-2 text-sm">Por segurança, você precisa redefinir sua senha provisória antes de continuar.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label><input type="password" required className="w-full border p-3 rounded-lg outline-none" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)}/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label><input type="password" required className="w-full border p-3 rounded-lg outline-none" placeholder="Repita a senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/></div>
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" /> : 'Atualizar Senha e Entrar'}</button>
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
  const [data, setData] = useState<AppState>(() => ({ ...INITIAL_STATE, categories: generateDefaultCategories() }));
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileQueue, setFileQueue] = useState<QueueItem[]>([]);
  const [customContext, setCustomContext] = useState("");
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  const [newClientName, setNewClientName] = useState("");
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState<CategoryGroup>("Essencial");
  const [decumulationConfig, setDecumulationConfig] = useState({ capital: 0, withdrawal: 10000, interestRate: 0.06 });

  // Estado para a planilha de fluxo financeiro (Aba 13)
  const [flowData, setFlowData] = useState<any>(() => {
    const months = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
    const categoryLabels = [
      { id: 'renda', label: 'Renda', type: 'income' },
      { id: 'aplicacao', label: 'Investimentos: Aplicação', type: 'investment' },
      { id: 'resgate', label: 'Investimentos: Resgate', type: 'redemption' },
      { id: 'saldo', label: 'Saldo', type: 'balance' },
      { id: 'casa', label: 'Casa', group: 'Essencial', budget: 20050 },
      { id: 'joao', label: 'João', group: 'Essencial', budget: 5480 },
      { id: 'pedro', label: 'Pedro', group: 'Essencial', budget: 700 },
      { id: 'saude', label: 'Saúde', group: 'Essencial', budget: 9175 },
      { id: 'cachorros', label: 'Cachorros', group: 'Essencial', budget: 1800 },
      { id: 'cartao', label: 'Cartão Crédito', group: 'Variável', budget: 1500 },
      { id: 'impostos', label: 'Impostos', group: 'Variável', budget: 0 },
      { id: 'financeiro', label: 'Financeiro', group: 'Variável', budget: 776 },
      { id: 'carro', label: 'Carro', group: 'Variável', budget: 1970 },
      { id: 'cuidados', label: 'Cuidados pessoais', group: 'Variável', budget: 1000 },
      { id: 'vestuario', label: 'Vestuário', group: 'Variável', budget: 1000 },
      { id: 'lazer', label: 'Lazer', group: 'Variável', budget: 7050 },
      { id: 'outros', label: 'Outros', group: 'Variável', budget: 0 },
    ];

    const values: any = {};
    categoryLabels.forEach(cat => {
      values[cat.id] = new Array(12).fill(0);
    });

    return { categoryLabels, values, months };
  });

  // --- Lógica de Sincronização Inteligente com a Aba 13 ---
  useEffect(() => {
    if (!data.transactions || data.transactions.length === 0) return;

    setFlowData((prev: any) => {
      const newValues = { ...prev.values };
      const currentYear = new Date().getFullYear();

      // Zera valores antes de repopular para evitar lixo de outros clientes
      Object.keys(newValues).forEach(key => {
        newValues[key] = new Array(12).fill(0);
      });

      data.transactions.forEach(t => {
        const isoDate = normalizeToISO(t.date);
        if (!isoDate) return;
        
        const date = new Date(isoDate);
        const month = date.getMonth() + 1; // 1-12
        
        // Encontra o índice na nossa lista de meses customizada [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]
        const monthIdx = prev.months.indexOf(month);
        if (monthIdx === -1) return;

        const amount = Math.abs(t.amount);
        const group = t.type;
        const category = t.category;

        // Mapeamento de Renda
        if (group === 'Receitas') {
          newValues['renda'][monthIdx] += amount;
        } 
        
        // Mapeamento de Despesas por Agrupamento Visual da Aba 13
        if (group === 'Saúde') {
          newValues['saude'][monthIdx] += amount;
        } else if (group === 'Social') {
          newValues['lazer'][monthIdx] += amount;
        } else if (group === 'Transporte') {
          newValues['carro'][monthIdx] += amount;
        } else if (group === 'Financeiro') {
          newValues['financeiro'][monthIdx] += amount;
        } else if (category === 'Cartão de Crédito') {
          newValues['cartao'][monthIdx] += amount;
        } else if (group === 'Essencial') {
          // Categorias que compõem "Casa"
          const casaCategories = ['Aluguel', 'Condomínio', 'IPTU', 'Casa - DDT/Manutenção', 'Supermercado', 'Feira', 'Combo NET/Internet'];
          if (casaCategories.includes(category)) {
            newValues['casa'][monthIdx] += amount;
          } else {
            // Se não cair em nada específico, vai para outros ou o grupo principal
            newValues['outros'][monthIdx] += amount;
          }
        } else {
            newValues['outros'][monthIdx] += amount;
        }
      });

      // Cálculo do Saldo (Renda - Despesas)
      for (let i = 0; i < 12; i++) {
        let totalExpenses = 0;
        prev.categoryLabels.forEach((cat: any) => {
          if (!cat.type && cat.id !== 'saldo') {
            totalExpenses += newValues[cat.id][i];
          }
        });
        newValues['saldo'][i] = newValues['renda'][i] - totalExpenses;
      }

      return { ...prev, values: newValues };
    });
  }, [data.transactions, data.selectedClientId]);

  const handleFlowValueChange = (catId: string, monthIdx: number, val: string) => {
    const num = parseBRFloat(val);
    setFlowData((prev: any) => {
      const newValues = { ...prev.values };
      newValues[catId][monthIdx] = num;
      return { ...prev, values: newValues };
    });
  };

  useEffect(() => {
    const liabilities = data.assets.filter(a => a.type === 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
    const totalAssets = data.assets.filter(a => a.type !== 'Dívida').reduce((acc, curr) => acc + curr.totalValue, 0);
    const netWorth = totalAssets - liabilities;
    if (netWorth > 0 && decumulationConfig.capital === 0) {
        setDecumulationConfig(prev => ({ ...prev, capital: netWorth }));
    }
  }, [data.assets]);

  const refreshCategories = async () => {
      const globalCats = await fetchGlobalCategories();
      const defaultCats = generateDefaultCategories();
      setData(prev => ({ ...prev, categories: [...defaultCats, ...globalCats] }));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session?.user) {
        refreshCategories();
        const savedClientId = localStorage.getItem('finplanner_selected_client_id');
        if (savedClientId) handleSelectClient(savedClientId);
        if (session.user.user_metadata?.force_password_change) setMustChangePassword(true);
        else loadClients(session.user.id);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
          refreshCategories();
          if (session.user.user_metadata?.force_password_change) setMustChangePassword(true);
          else { setMustChangePassword(false); loadClients(session.user.id); }
      } else {
          setData(prev => ({ ...INITIAL_STATE, categories: generateDefaultCategories() }));
          localStorage.removeItem('finplanner_selected_client_id');
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
      localStorage.setItem('finplanner_selected_client_id', clientId);
      const clientData = await fetchClientData(clientId);
      if (clientData) {
          setData(prev => ({ ...prev, ...clientData, selectedClientId: clientId, lastUpdated: new Date().toISOString() }));
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
          setData(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== id), selectedClientId: prev.selectedClientId === id ? null : prev.selectedClientId }));
          if (data.selectedClientId === id) localStorage.removeItem('finplanner_selected_client_id');
      }
  };

  const handleCategoryChange = async (transactionId: string, newCategory: string) => {
      const matchedCat = data.categories.find(c => c.name === newCategory);
      const newType = matchedCat ? matchedCat.group : getCategoryGroup(newCategory);
      setData(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === transactionId ? { ...t, category: newCategory, type: newType } : t) }));
      try { await updateTransactionCategory(transactionId, newCategory, newType); } catch (error) { alert("Erro ao atualizar categoria."); }
  };

  const handleAddCategory = async () => {
      if (!newCategoryName.trim()) return;
      const cleanName = newCategoryName.trim();
      if (data.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
          setSuccessMessage(`A categoria "${cleanName}" já existe!`);
          setAlertType('error');
          setShowSuccessAlert(true);
          return;
      }
      try {
          await createGlobalCategory(cleanName, newCategoryGroup);
          await refreshCategories();
          setNewCategoryName("");
          setSuccessMessage("Categoria global criada!");
          setAlertType('success');
          setShowSuccessAlert(true);
      } catch (error) {
          setSuccessMessage("Erro ao criar categoria global.");
          setAlertType('error');
          setShowSuccessAlert(true);
      }
  };

  const handleDeleteCategory = async (id: string) => {
      if (!window.confirm("Remover esta categoria global? Isso afetará todos os usuários.")) return;
      const previousCategories = [...data.categories];
      setData(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
      try { await deleteGlobalCategory(id); } catch (error) {
          setData(prev => ({ ...prev, categories: previousCategories }));
          alert("Erro ao excluir categoria.");
      }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };
  const addLog = (msg: string) => setProcessingLog(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !session?.user) return;
    const newFiles: QueueItem[] = Array.from(event.target.files).map((file) => ({ id: Math.random().toString(36).substring(7), file: file as File, status: 'queued', progress: 0 }));
    setFileQueue(prev => [...prev, ...newFiles]);
    setShowSuccessAlert(false);
  };

  const removeFileFromQueue = (id: string) => setFileQueue(prev => prev.filter(item => item.id !== id));
  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => setFileQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  const triggerFileInput = () => { if (!isProcessingQueue) fileInputRef.current?.click(); };

  const processQueue = async () => {
    if (!session?.user) return;
    setIsProcessingQueue(true);
    setProcessingLog([]);
    const pendingItems = fileQueue.filter(i => i.status === 'queued' || i.status === 'error');
    if (pendingItems.length === 0) { addLog("Nenhum arquivo pendente."); setIsProcessingQueue(false); return; }
    for (const item of pendingItems) {
        try {
            updateQueueItem(item.id, { status: 'uploading', progress: 0 });
            const uploadResult = await uploadStatement(item.file, session.user.id, (percent) => updateQueueItem(item.id, { progress: percent }));
            if (!uploadResult.success) throw new Error(uploadResult.error || "Falha no upload");
            updateQueueItem(item.id, { status: 'extracting' });
            const extractedText = await parseFileContent(item.file);
            if (!extractedText || extractedText.trim().length === 0) throw new Error("Arquivo vazio.");
            updateQueueItem(item.id, { status: 'processing_ai' });
            const extractedData = await extractFinancialData(extractedText, customContext, data.categories);
            let targetClientId = data.selectedClientId;
            let targetClientName = extractedData.detectedClientName;
            if (targetClientName) {
                const currentClients = await fetchClients(session.user.id);
                const existing = currentClients.find(c => c.name.toLowerCase() === targetClientName?.toLowerCase());
                if (existing) targetClientId = existing.id;
                else {
                    const newClient = await createClient(session.user.id, targetClientName);
                    if (newClient) { targetClientId = newClient.id; setData(prev => ({ ...prev, clients: [...prev.clients, newClient] })); }
                }
            }
            if (!targetClientId) throw new Error("Cliente não identificado.");
            updateQueueItem(item.id, { status: 'saving' });
            const saveData = { personalData: { ...data.personalData, ...extractedData.personalData }, transactions: extractedData.transactions || [], assets: extractedData.assets || [] };
            const saveResult = await saveFinancialData(session.user.id, targetClientId, saveData);
            if (!saveResult.success) throw new Error(saveResult.error?.message || "Erro ao salvar");
            updateQueueItem(item.id, { status: 'completed', resultMessage: `Vinculado a ${targetClientName || 'Cliente Selecionado'}` });
            if (item.id === pendingItems[pendingItems.length - 1].id) handleSelectClient(targetClientId);
        } catch (error: any) { updateQueueItem(item.id, { status: 'error', error: error.message }); addLog(`ERRO: ${error.message}`); }
    }
    setIsProcessingQueue(false);
    setSuccessMessage("Fila processada!");
    setAlertType('success');
    setShowSuccessAlert(true);
  };

  const renderClients = () => (
      <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-end gap-4">
              <div><h3 className="text-xl font-bold text-gray-800">Carteira de Clientes</h3><p className="text-gray-500 text-sm">Gerencie seus clientes.</p></div>
              <form onSubmit={handleCreateClient} className="flex gap-2 w-full md:w-auto"><input type="text" placeholder="Nome do Novo Cliente" className="border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newClientName} onChange={e => setNewClientName(e.target.value)}/><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold"><UserPlus className="w-4 h-4" /> Adicionar</button></form>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.clients.length === 0 ? <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed"><Users className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum cliente cadastrado.</p></div> : 
                  data.clients.map(client => (
                      <div key={client.id} className={`bg-white p-6 rounded-xl shadow-sm border cursor-pointer transition-all ${data.selectedClientId === client.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'}`}>
                          <div className="flex justify-between items-start mb-4"><div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xl">{client.name.charAt(0)}</div><div className="flex gap-2"><button onClick={() => { handleSelectClient(client.id); setActiveTab(0); }} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">Acessar</button><button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id, client.name); }} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button></div></div>
                          <h4 className="font-bold text-gray-800">{client.name}</h4>
                      </div>
                  ))
              }
          </div>
      </div>
  );

  const renderSummary = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-2 border-b"><Users className="w-5 h-5 text-blue-600" /> 1.1 Dados Pessoais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-3"><InfoRow label="Nome" value={data.personalData.name} /><InfoRow label="Nascimento" value={data.personalData.birthDate || '--/--/----'} /></div>
            <div className="space-y-3"><InfoRow label="Nacionalidade" value={data.personalData.nationality} /><InfoRow label="Estado Civil" value={data.personalData.maritalStatus} /></div>
            <div className="space-y-3"><InfoRow label="Regime de Bens" value={data.personalData.propertyRegime || '-'} /></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-orange-600" /> 1.2 Endereço</h3><div className="space-y-2"><InfoRow label="Logradouro" value={data.personalData.address?.street || '-'} /><InfoRow label="Bairro" value={data.personalData.address?.neighborhood || '-'} /><InfoRow label="CEP" value={data.personalData.address?.zipCode || '-'} /></div></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-indigo-600" /> 1.3 Profissional</h3><div className="space-y-2"><InfoRow label="Profissão" value={data.personalData.profession || '-'} /><InfoRow label="Empresa" value={data.personalData.company || '-'} /><InfoRow label="Cargo" value={data.personalData.role || '-'} /></div></div>
      </div>
    </div>
  );

  const renderBudget = () => {
    if (data.transactions.length === 0) return <div className="bg-white p-12 rounded-xl border border-dashed text-center"><Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">Sem dados</h3></div>;
    const getGroupForChart = (cat: string) => { const custom = data.categories.find(c => c.name === cat); return custom ? custom.group : getCategoryGroup(cat); };
    const distinctGroups = Array.from(new Set(data.transactions.map(t => getGroupForChart(t.category)))).filter(g => g !== ('Pagamentos' as any));
    const sortedGroups = distinctGroups.sort((a, b) => { const pref = ['Receitas', 'Essencial', 'Saúde', 'Social', 'Transporte', 'Financeiro', 'Extra', 'Presentes', 'Profissional', 'Outros']; return pref.indexOf(a as string) - pref.indexOf(b as string); });
    const chartData = sortedGroups.map(group => { const groupTrans = data.transactions.filter(t => getGroupForChart(t.category) === group); const isIncome = group === 'Receitas'; let total = groupTrans.reduce((acc, t) => acc + t.amount, 0); return { name: String(group), value: Math.abs(total) }; }).filter(item => item.value > 0.01);
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 className="text-lg font-bold text-gray-800 mb-2">Orçamento</h3><div className="h-64"><ExpensesBarChart data={chartData} /></div></div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"><h3 className="text-lg font-bold text-gray-800 p-6 border-b">Detalhamento</h3><div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {sortedGroups.map(group => {
                const groupTrans = data.transactions.filter(t => getGroupForChart(t.category) === group);
                const isIncome = group === 'Receitas';
                const total = Math.abs(groupTrans.reduce((acc, t) => acc + t.amount, 0));
                if (total < 0.01) return null;
                return (<div key={String(group)} className="border rounded-lg p-4"><div className="flex justify-between items-center mb-2"><h4 className={`font-bold ${isIncome ? 'text-green-700' : 'text-gray-700'}`}>{String(group)}</h4><span className="font-bold">{total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div><div className="space-y-1">{Array.from(new Set(groupTrans.map(t => t.category))).map(cat => { const catTrans = groupTrans.filter(t => t.category === cat); const catTotal = Math.abs(catTrans.reduce((acc, t) => acc + t.amount, 0)); return <div key={cat} className="flex justify-between text-xs text-gray-500"><span>{cat}</span><span>{catTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div> })}</div></div>)
            })}
        </div></div>
      </div>
    );
  };

  const filteredTransactions = useMemo(() => {
    return data.transactions.filter(t => {
      // 1. Filtro de Data (Normalizado para ISO antes de comparar)
      if (t.date) {
        const tIso = normalizeToISO(t.date);
        const matchesStart = !dateRange.start || tIso >= dateRange.start;
        const matchesEnd = !dateRange.end || tIso <= dateRange.end;
        if (!matchesStart || !matchesEnd) return false;
      } else if (dateRange.start || dateRange.end) {
          return false; // Se tem filtro mas a transação não tem data
      }

      // 2. Filtro de Busca (Texto)
      if (searchTerm.trim()) {
          const lowerSearch = searchTerm.toLowerCase();
          const matchesDesc = t.description.toLowerCase().includes(lowerSearch);
          const matchesCat = t.category.toLowerCase().includes(lowerSearch);
          if (!matchesDesc && !matchesCat) return false;
      }

      // 3. Filtro de Categoria
      if (filterCategory && t.category !== filterCategory) return false;

      return true;
    }).sort((a, b) => normalizeToISO(b.date).localeCompare(normalizeToISO(a.date)));
  }, [data.transactions, dateRange, searchTerm, filterCategory]);

  const clearFilters = () => {
      setDateRange({ start: '', end: '' });
      setSearchTerm("");
      setFilterCategory("");
  };

  const renderRealized = () => {
    if (!data.selectedClientId) return <div className="bg-white p-12 rounded-xl border border-dashed text-center"><Users className="w-12 h-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">Nenhum cliente selecionado</h3></div>;
    const sortedCategories = [...data.categories].sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="p-6 border-b space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-800">Movimentações</h3>
                    <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium">{filteredTransactions.length} registros</span>
                </div>
                {(dateRange.start || dateRange.end || searchTerm || filterCategory) && (
                    <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition-colors">
                        <RotateCcw className="w-3 h-3" /> Limpar Filtros
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-4 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por descrição..." 
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="md:col-span-3 relative">
                    <Filter className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <select 
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="">Todas as Categorias</option>
                        {sortedCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                    </select>
                </div>

                <div className="md:col-span-5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center gap-2 flex-1">
                        <input 
                            type="date" 
                            className="bg-transparent text-xs text-gray-700 outline-none w-full" 
                            value={dateRange.start} 
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-gray-300">até</span>
                        <input 
                            type="date" 
                            className="bg-transparent text-xs text-gray-700 outline-none w-full" 
                            value={dateRange.end} 
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 bg-gray-50 border-b font-bold text-xs text-gray-500 uppercase tracking-wider grid grid-cols-12 gap-2">
            <div className="col-span-2">Data</div>
            <div className="col-span-4">Descrição</div>
            <div className="col-span-4">Categoria</div>
            <div className="col-span-2 text-right">Valor</div>
        </div>

        <div className="divide-y max-h-[500px] overflow-y-auto">
            {filteredTransactions.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>Nenhuma transação encontrada.</p>
                </div>
            ) : (
                filteredTransactions.map(t => (
                    <div key={t.id} className="p-4 grid grid-cols-12 gap-2 hover:bg-blue-50/30 text-sm items-center transition-colors">
                        <div className="col-span-2 text-gray-600 font-medium">
                            {formatDisplayDate(t.date)}
                        </div>
                        <div className="col-span-4 truncate pr-2 font-medium text-gray-700" title={t.description}>{t.description}</div>
                        <div className="col-span-4">
                            <select 
                                value={t.category} 
                                onChange={(e) => handleCategoryChange(t.id, e.target.value)} 
                                className="w-full text-xs bg-white border border-gray-100 rounded px-2 py-1 outline-none hover:border-blue-300 transition-colors"
                            >
                                {sortedCategories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div className={`col-span-2 text-right font-bold ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {t.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    const assets = data.assets.filter(a => a.type !== 'Dívida');
    const totalAssets = assets.reduce((acc, curr) => acc + curr.totalValue, 0);
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-xl border border-gray-100"><p className="text-sm text-gray-500 font-medium">Ativo Total</p><p className="text-2xl font-bold text-blue-600">{totalAssets.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p></div></div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"><h3 className="font-bold text-gray-800 p-6 border-b">Bens e Direitos</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-600 font-medium"><tr><th className="p-4">Ativo</th><th className="p-4">Tipo</th><th className="p-4 text-right">Valor</th></tr></thead><tbody className="divide-y">{assets.map((item, idx) => (<tr key={idx}><td className="p-4 font-medium">{item.ticker}</td><td className="p-4">{item.type}</td><td className="p-4 text-right font-bold">{item.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td></tr>))}</tbody></table></div></div>
        </div>
    );
  };

  const renderInvestments = () => (
    <div className="space-y-6"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 className="text-lg font-bold text-gray-800 mb-4">Alocação</h3><div className="h-64"><AllocationChart assets={data.assets} /></div></div></div>
  );

  const renderSimulation = () => {
    const projection = [];
    let cur = data.simulation.initialPatrimony || 50000;
    for (let y = 0; y <= 30; y++) { projection.push({ year: new Date().getFullYear() + y, value: Math.round(cur), invested: Math.round(cur * 0.8) }); cur *= 1.06; }
    return (<div className="bg-white p-6 rounded-xl shadow-sm"><PatrimonyChart data={projection} /></div>);
  };

  const renderProjectionScenarios = () => {
    const dataPoints = [];
    let p = 50000, r = 50000, o = 50000;
    for(let y=0; y<=30; y++) { dataPoints.push({ year: new Date().getFullYear() + y, pessimista: Math.round(p), realista: Math.round(r), otimista: Math.round(o) }); p *= 1.04; r *= 1.06; o *= 1.10; }
    return (<div className="bg-white p-6 rounded-xl shadow-sm"><ScenarioChart data={dataPoints} /></div>);
  };

  const renderCategories = () => (
      <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Settings className="w-5 h-5"/> Categorias</h3>
              <div className="flex gap-2 items-end mb-6">
                  <div className="flex-1"><label className="text-xs font-bold text-gray-500 block mb-1">Nova Categoria</label><input type="text" className="w-full border p-2 rounded-lg text-sm outline-none" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}/></div>
                  <div className="w-40"><label className="text-xs font-bold text-gray-500 block mb-1">Grupo</label><select className="w-full border p-2 rounded-lg text-sm bg-white" value={newCategoryGroup} onChange={(e) => setNewCategoryGroup(e.target.value as CategoryGroup)}>{['Receitas', 'Essencial', 'Saúde', 'Social', 'Transporte', 'Financeiro', 'Extra', 'Presentes', 'Profissional', 'Outros'].map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                  <button onClick={handleAddCategory} className="bg-blue-600 text-white p-2 rounded-lg h-[38px] w-[38px] flex items-center justify-center"><Plus className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {data.categories.map(cat => <div key={cat.id} className="bg-gray-50 p-2 rounded text-xs flex justify-between items-center group"><span>{cat.name}</span>{cat.isCustom && <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3"/></button>}</div>)}
              </div>
          </div>
      </div>
  );

  const renderUpload = () => (
      <div className="max-w-4xl mx-auto space-y-6"><div className="text-center"><h2 className="text-2xl font-bold">11. Upload IA</h2><p className="text-gray-500">Múltiplos extratos para fila.</p></div>
        <div onClick={triggerFileInput} className={`bg-white p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors ${isProcessingQueue ? 'opacity-50 cursor-not-allowed' : ''}`}><UploadCloud className="w-10 h-10 text-gray-400 mb-2" /><p className="font-bold text-gray-700">Clique para adicionar arquivos</p></div>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.csv,.ofx,.txt" multiple />
        {fileQueue.length > 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"><div className="p-4 bg-gray-50 border-b flex justify-between items-center font-bold">Fila ({fileQueue.length})</div><div className="divide-y">{fileQueue.map((item) => <div key={item.id} className="p-4 flex items-center justify-between"><div className="flex items-center gap-3"><FileText className="w-5 h-5 text-blue-600" /><div><p className="text-sm font-medium">{item.file.name}</p><p className="text-xs text-gray-500">{item.status}</p></div></div>{item.status === 'queued' && <button onClick={() => removeFileFromQueue(item.id)}><X className="w-4 h-4"/></button>}</div>)}</div><div className="p-4 flex justify-end"><button onClick={processQueue} disabled={isProcessingQueue} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">{isProcessingQueue ? 'Processando...' : 'Processar Todos'}</button></div></div>}
      </div>
  );

  const renderFinancialFlow = () => {
    const monthNames = ["Setembro", "Outubro", "Novembro", "Dezembro", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto"];
    
    // Cálculo dos totais de despesa por mês
    const monthlyTotals = flowData.months.map((_, mIdx) => {
      let total = 0;
      flowData.categoryLabels.forEach((cat: any) => {
        if (!cat.type && cat.id !== 'saldo') { // É uma categoria de despesa
          total += flowData.values[cat.id][mIdx];
        }
      });
      return total;
    });

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto min-h-[600px] animate-fade-in">
        <div className="p-4 bg-blue-50 border-b flex justify-between items-center">
            <h4 className="text-blue-800 font-bold flex items-center gap-2"><Activity className="w-4 h-4"/> Dados Sincronizados com Movimentações</h4>
            <span className="text-[10px] text-blue-500 italic">* Valores extraídos automaticamente dos extratos</span>
        </div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            {/* Cabeçalho superior: Ano */}
            <tr className="bg-[#1a3a1a] text-white">
              <th className="p-2 border border-white/20 text-left min-w-[200px]" colSpan={3}>Orçamento {new Date().getFullYear()} / {new Date().getFullYear() + 1}</th>
              {flowData.months.map((m: number, idx: number) => (
                <th key={idx} className="p-2 border border-white/20 text-center min-w-[80px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Linhas de Renda/Investimentos */}
            {flowData.categoryLabels.slice(0, 4).map((row: any) => (
              <tr key={row.id} className={row.id === 'saldo' ? 'font-bold bg-green-50' : 'bg-gray-50/50'}>
                <td className="p-2 border border-gray-100 font-bold" colSpan={row.group ? 1 : 2}>{row.group || row.label}</td>
                {row.group && <td className="p-2 border border-gray-100">{row.label.split(':')[1]?.trim() || row.label}</td>}
                <td className="p-2 border border-gray-100 text-right">
                    {/* Espaço para Orçado inicial se houver */}
                </td>
                {flowData.months.map((_: any, mIdx: number) => (
                  <td key={mIdx} className="p-0 border border-gray-100">
                    <input 
                      type="text" 
                      className={`w-full h-full p-2 bg-transparent text-right outline-none focus:bg-blue-50 transition-colors font-medium ${row.id === 'saldo' ? (flowData.values[row.id][mIdx] >= 0 ? 'text-green-700' : 'text-red-600') : ''}`}
                      value={formatBRNumber(flowData.values[row.id][mIdx])}
                      onChange={(e) => handleFlowValueChange(row.id, mIdx, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Divisor de Meses por Nome */}
            <tr className="bg-[#1a3a1a] text-white font-bold">
              <td className="p-2 border border-white/20" colSpan={1}>Categoria</td>
              <td className="p-2 border border-white/20" colSpan={1}></td>
              <td className="p-2 border border-white/20 text-right">Orçado (R$)</td>
              {monthNames.map((name, idx) => (
                <td key={idx} className="p-2 border border-white/20 text-center">{name}</td>
              ))}
            </tr>

            {/* Categorias de Despesa */}
            {flowData.categoryLabels.slice(4).map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-2 border border-gray-100 font-bold text-gray-500 uppercase text-[9px]">{row.group}</td>
                <td className="p-2 border border-gray-100 font-medium">{row.label}</td>
                <td className="p-2 border border-gray-100 text-right text-gray-400">
                  {row.budget ? formatBRNumber(row.budget, false) : '0,00'}
                </td>
                {flowData.months.map((_: any, mIdx: number) => (
                  <td key={mIdx} className="p-0 border border-gray-100">
                    <input 
                      type="text" 
                      className={`w-full h-full p-2 bg-transparent text-right outline-none focus:bg-blue-50 transition-colors ${flowData.values[row.id][mIdx] > 0 ? 'text-gray-900' : 'text-gray-300'}`}
                      value={formatBRNumber(flowData.values[row.id][mIdx], false)}
                      onChange={(e) => handleFlowValueChange(row.id, mIdx, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Linha de Total Final de Despesas */}
            <tr className="bg-[#1a3a1a] text-white font-bold text-sm">
              <td className="p-3 border border-white/20" colSpan={2}>Total Saídas</td>
              <td className="p-3 border border-white/20 text-right"> - </td>
              {monthlyTotals.map((total, idx) => (
                <td key={idx} className="p-3 border border-white/20 text-right">
                  {formatBRNumber(total, false)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const TABS = [
    { id: 0, title: '1. Resumo Pessoal', icon: Activity, render: renderSummary },
    { id: 1, title: '2. Orçamento', icon: Calculator, render: renderBudget },
    { id: 2, title: '3. Movimentações', icon: FileText, render: renderRealized },
    { id: 3, title: '4. Balanço Patrimonial', icon: Layers, render: renderBalanceSheet },
    { id: 4, title: '5. Investimentos', icon: TrendingUp, render: renderInvestments },
    { id: 5, title: '6. Resumo Sim.', icon: BarChart3, render: renderSimulation },
    { id: 6, title: '7. Sim. Detalhada', icon: DollarSign, render: () => <div className="bg-white p-8">Simulação Detalhada em breve</div> },
    { id: 7, title: '8. S/ Perpetuidade', icon: Briefcase, render: () => <div className="bg-white p-8">S/ Perpetuidade em breve</div> },
    { id: 8, title: '9. Projeção', icon: LineChart, render: renderProjectionScenarios },
    { id: 9, title: '10. Categorias', icon: Settings, render: renderCategories },
    { id: 10, title: '11. Upload / IA', icon: UploadCloud, render: renderUpload },
    { id: 11, title: '12. Clientes', icon: Users, render: renderClients },
    { id: 12, title: '13. Fluxo Financeiro', icon: Table, render: renderFinancialFlow },
  ];

  if (loadingSession) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!session) return <Auth />;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 relative">
      {mustChangePassword && <ForcePasswordChangeModal onClose={() => window.location.reload()} />}
      <aside className={`${isSidebarExpanded ? 'w-64' : 'w-20'} bg-blue-900 text-white flex flex-col fixed h-full z-10 transition-all duration-300`}>
        <div className="p-6 border-b border-blue-800 flex items-center gap-3 flex-shrink-0"><BrainCircuit className="w-8 h-8" />{isSidebarExpanded && <span className="font-bold text-xl">FinPlanner</span>}</div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">{TABS.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center p-3 rounded-lg text-sm transition-all ${activeTab === tab.id ? 'bg-blue-800 text-white shadow-md' : 'text-blue-100 hover:bg-blue-800'}`} title={tab.title}><tab.icon className="w-5 h-5 flex-shrink-0" />{isSidebarExpanded && <span className="ml-3 truncate">{tab.title}</span>}</button>)}</nav>
        <div className="p-4 border-t border-blue-800 flex-shrink-0"><button onClick={handleLogout} className="flex items-center gap-2 text-blue-200 hover:text-white text-sm"><LogOut className="w-4 h-4" />{isSidebarExpanded && 'Sair'}</button></div>
      </aside>
      <main className={`flex-1 ${isSidebarExpanded ? 'ml-64' : 'ml-20'} p-8 transition-all`}>
        <header className="flex justify-between items-center mb-8"><div><h2 className="text-2xl font-bold">{TABS[activeTab].title}</h2><p className="text-sm text-gray-500">{data.personalData.name}</p></div><div className="flex items-center gap-4"><button className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border text-sm font-medium"><Users className="w-4 h-4 text-blue-600" /><span>{data.selectedClientId ? data.clients.find(c => c.id === data.selectedClientId)?.name : 'Selecionar Cliente'}</span><ChevronDown className="w-4 h-4" /></button></div></header>
        {isLoadingData && <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>}
        <div className="animate-fade-in-up">{TABS[activeTab].render()}</div>
      </main>
      {showSuccessAlert && <div className="fixed bottom-6 right-6 z-50 bg-white rounded-xl shadow-2xl border-l-8 border-green-500 p-5 flex items-start gap-4"><div><h4 className="font-bold text-gray-900">Sucesso!</h4><p className="text-gray-600 text-sm">{successMessage}</p><button onClick={() => setShowSuccessAlert(false)} className="text-sm text-gray-400 mt-2">Fechar</button></div></div>}
    </div>
  );
}
