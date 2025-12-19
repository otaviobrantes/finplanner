
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign,  
  FileText, Briefcase, Calculator, LineChart, Layers, 
  UploadCloud, Settings, ChevronRight, Activity, LogOut, FileCheck, AlertCircle, CheckCircle2, Loader2, Users, MapPin, Building, UserPlus, Trash2, Search, Sliders, Calendar, Lock, Key, X,
  ChevronLeft, Menu, MessageSquare, Edit2, Plus, Save, RotateCcw, Scale, BrainCircuit
} from 'lucide-react';
import { extractFinancialData } from './services/geminiService';
import { saveFinancialData, fetchClientData, fetchClients, createClient, deleteClient, updateTransactionCategory, fetchGlobalCategories, createGlobalCategory, deleteGlobalCategory } from './services/dbService';
import { uploadStatement } from './services/storageService';
import { parseFileContent } from './services/fileParser';
import { supabase } from './services/supabaseClient';
import { AppState, INITIAL_STATE, TransactionCategory, CategoryGroup, Client, CategoryItem } from './types';
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

// Helper: Safe ID Generator (Avoids crypto.randomUUID crash on insecure contexts)
const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Helper to determine group from category (Legacy Helper + Fallback)
const getCategoryGroup = (cat: string): CategoryGroup => {
  const lowerCat = cat.toLowerCase();

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
  
  // Financeiro
  if (lowerCat.includes('seguro') || lowerCat.includes('juros') || lowerCat.includes('doaç') || lowerCat.includes('planejador') || lowerCat.includes('cartão') || lowerCat.includes('iof') || lowerCat.includes('taxa')) return 'Financeiro';
  
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
const ForcePasswordChangeModal = ({ onClose }: { onClose: () => void }) => {
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
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <Key className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Troca de Senha Obrigatória</h2>
          <p className="text-center text-gray-500 mt-2 text-sm">
            Por segurança, você precisa redefinir sua senha provisória antes de continuar.
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
            {loading ? <Loader2 className="animate-spin" /> : 'Atualizar Senha e Entrar'}
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

  // Estado para edição de categorias (Página 10)
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState<CategoryGroup>("Essencial");

  // Estado para a Calculadora de Decumulação (Página 8)
  const [decumulationConfig, setDecumulationConfig] = useState({
    capital: 0,
    withdrawal: 10000,
    interestRate: 0.06
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
             handleSelectClient(savedClientId); // Carrega os dados deste cliente
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
          // Não muda a aba automaticamente no refresh, apenas no clique manual
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-2 border-b">
           <Users className="w-5 h-5 text-blue-600" /> 1.1 Dados Pessoais
        </h3>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <MapPin className="w-5 h-5 text-orange-600" /> 1.2 Endereço e Contato
             </h3>
             <div className="space-y-2">
                 <InfoRow label="Logradouro" value={data.personalData.address?.street || '-'} />
                 <InfoRow label="Bairro/Cidade" value={data.personalData.address?.neighborhood || '-'} />
                 <InfoRow label="CEP" value={data.personalData.address?.zipCode || '-'} />
                 <InfoRow label="Email" value={data.personalData.email || '-'} />
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Briefcase className="w-5 h-5 text-indigo-600" /> 1.3 Profissional
             </h3>
             <div className="space-y-2">
                 <InfoRow label="Profissão" value={data.personalData.profession || '-'} />
                 <InfoRow label="Empresa" value={data.personalData.company || '-'} />
                 <InfoRow label="Cargo" value={data.personalData.role || '-'} />
                 <InfoRow label="CNPJ" value={data.personalData.cnpj || '-'} />
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <DollarSign className="w-5 h-5 text-green-600" /> 1.4 Receitas & Impostos
             </h3>
             <div className="space-y-2">
                 <InfoRow label="Renda Bruta" value={data.personalData.incomeDetails?.grossAmount?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) || 'R$ 0,00'} />
                 <InfoRow label="INSS" value={data.personalData.incomeDetails?.inss?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) || 'R$ 0,00'} />
                 <InfoRow label="IRRF" value={data.personalData.incomeDetails?.irrf?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) || 'R$ 0,00'} />
                 <InfoRow label="13º Salário" value={data.personalData.incomeDetails?.thirteenthSalary?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) || 'R$ 0,00'} />
                 <InfoRow label="Aluguéis" value={data.personalData.incomeDetails?.rentIncome?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) || 'R$ 0,00'} />
             </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5 text-purple-600" /> 1.5 Dependentes
             </h3>
             {data.personalData.dependents.length > 0 ? (
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
      </div>
    </div>
  );

  const renderBudget = () => {
    const totalTransactions = data.transactions.length;
    
    if (totalTransactions === 0) {
        return (
            <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
                <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Sem dados de orçamento</h3>
                <p className="text-gray-500 mt-2">Faça o upload de extratos na página 11 para visualizar a análise.</p>
            </div>
        );
    }

    // Usa 'getCategoryGroup' mas agora considera as categorias customizadas
    const getGroupForChart = (cat: string) => {
        const custom = data.categories.find(c => c.name === cat);
        return custom ? custom.group : getCategoryGroup(cat);
    };

    const distinctGroups = Array.from(new Set(data.transactions.map(t => getGroupForChart(t.category))));
    
    const preferredOrder = ['Receitas', 'Essencial', 'Saúde', 'Social', 'Transporte', 'Financeiro', 'Extra', 'Presentes', 'Profissional', 'Outros'];
    
    const sortedGroups = distinctGroups.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a as string);
        const indexB = preferredOrder.indexOf(b as string);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    const chartData = sortedGroups.map(group => {
         const groupTrans = data.transactions.filter(t => getGroupForChart(t.category) === group);
         
         const isIncomeGroup = group === 'Receitas';
         let total = 0;
         
         if (isIncomeGroup) {
              total = groupTrans.reduce((acc, t) => acc + t.amount, 0);
         } else {
              const rawSum = groupTrans.reduce((acc, t) => acc + t.amount, 0);
              total = Math.abs(rawSum);
         }
         
         return { name: group, value: total };
    }).filter(item => item.value > 0.01);

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Visão Geral do Orçamento</h3>
            <div className="h-64">
                <ExpensesBarChart data={chartData} />
            </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 p-6 border-b">Detalhamento por Categoria</h3>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedGroups.map(group => {
                    const groupTrans = data.transactions.filter(t => getGroupForChart(t.category) === group);
                    if (groupTrans.length === 0) return null;
                    
                    const isIncomeGroup = group === 'Receitas'; 
                    let total = 0;
                    if (isIncomeGroup) {
                         total = groupTrans.reduce((acc, t) => acc + t.amount, 0);
                    } else {
                         const rawSum = groupTrans.reduce((acc, t) => acc + t.amount, 0);
                         total = Math.abs(rawSum);
                    }

                    if (total < 0.01) return null;

                    return (
                        <div key={group as string} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className={`font-bold ${isIncomeGroup ? 'text-green-700' : 'text-gray-700'}`}>{group}</h4>
                                <span className={`font-bold ${isIncomeGroup ? 'text-green-700' : 'text-gray-900'}`}>{total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                            </div>
                            <div className="space-y-1">
                                {Array.from(new Set(groupTrans.map(t => t.category))).sort().map(cat => {
                                    const catTrans = groupTrans.filter(t => t.category === cat);
                                    let catTotal = 0;
                                    if (isIncomeGroup) {
                                        catTotal = catTrans.reduce((acc, t) => acc + t.amount, 0);
                                    } else {
                                        const rawCatSum = catTrans.reduce((acc, t) => acc + t.amount, 0);
                                        catTotal = Math.abs(rawCatSum);
                                    }

                                    if (catTotal < 0.01) return null;

                                    return (
                                        <div key={cat} className="flex justify-between text-xs text-gray-500">
                                            <span>{cat}</span>
                                            <span>{catTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
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

    const filteredTransactions = data.transactions.filter(t => {
      if (dateRange.start && t.date < dateRange.start) return false;
      if (dateRange.end && t.date > dateRange.end) return false;
      return true;
    });

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
                        onClick={() => setDateRange({start: '', end: ''})}
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
                    <div className="col-span-2 text-gray-600">{t.date}</div>
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
                        {t.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
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

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <p className="text-sm text-gray-500 font-medium">Ativo Total</p>
                     <p className="text-2xl font-bold text-blue-600">{totalAssets.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <p className="text-sm text-gray-500 font-medium">Passivo Total</p>
                     <p className="text-2xl font-bold text-red-600">{totalLiabilities.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <p className="text-sm text-gray-500 font-medium">Patrimônio Líquido</p>
                     <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netWorth.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <h3 className="font-bold text-gray-800 p-6 border-b">Bens e Direitos</h3>
                 {assets.length === 0 ? <p className="p-6 text-gray-500 text-sm">Nenhum ativo cadastrado.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                             <thead className="bg-gray-50 text-gray-600 font-medium">
                                 <tr>
                                     <th className="p-4">Descrição/Ticker</th>
                                     <th className="p-4">Tipo</th>
                                     <th className="p-4">Instituição</th>
                                     <th className="p-4 text-right">Valor</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y">
                                 {assets.map((item, idx) => (
                                     <tr key={idx} className="hover:bg-gray-50">
                                         <td className="p-4 font-medium text-gray-900">{item.ticker}</td>
                                         <td className="p-4 text-gray-500">{item.type}</td>
                                         <td className="p-4 text-gray-500">{item.institution}</td>
                                         <td className="p-4 text-right font-bold text-gray-800">{item.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                                     </tr>
                                 ))}
                             </tbody>
                        </table>
                    </div>
                 )}
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <h3 className="font-bold text-gray-800 p-6 border-b flex items-center gap-2 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    Dívidas e Obrigações
                </h3>
                 {liabilities.length === 0 ? <p className="p-6 text-gray-500 text-sm">Nenhuma dívida cadastrada.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                             <thead className="bg-gray-50 text-gray-600 font-medium">
                                 <tr>
                                     <th className="p-4">Descrição</th>
                                     <th className="p-4">Instituição</th>
                                     <th className="p-4 text-right">Saldo Devedor</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y">
                                 {liabilities.map((item, idx) => (
                                     <tr key={idx} className="hover:bg-gray-50">
                                         <td className="p-4 font-medium text-gray-900">{item.ticker}</td>
                                         <td className="p-4 text-gray-500">{item.institution}</td>
                                         <td className="p-4 text-right font-bold text-red-600">{item.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                                     </tr>
                                 ))}
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
                                    <td className="py-3 text-right text-gray-600">{asset.currentPrice > 0 ? asset.currentPrice.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td>
                                    <td className="py-3 text-right font-bold text-gray-900">{asset.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
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
                        <Settings className="w-5 h-5 text-gray-500"/> Gerenciamento de Categorias Globais
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
                                {defaultGroupOrder.map(g => <option key={g} value={g}>{g}</option>)}
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
    const monthlyRate = Math.pow(1 + simConfig.interestRateReal, 1/12) - 1;

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
                  <p className="text-3xl font-bold text-green-600">{finalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
              </div>
          </div>
          
          <PatrimonyChart data={projection} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">Total Aportado</p>
                  <p className="text-xl font-bold text-blue-900">{finalInvested.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">Juros Compostos</p>
                  <p className="text-xl font-bold text-green-900">{(finalValue - finalInvested).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
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

     const monthlyRate = Math.pow(1 + data.simulation.interestRateReal, 1/12) - 1;
     let currentBalance = data.simulation.initialPatrimony;
     const rows = [];
     
     for(let m=1; m <= 60; m++) {
         const interest = currentBalance * monthlyRate;
         const contribution = data.simulation.monthlyContribution;
         const prevBalance = currentBalance;
         currentBalance = prevBalance + interest + contribution;
         
         rows.push({ month: m, prevBalance, interest, contribution, currentBalance });
     }

     return (
         <div className="space-y-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                 <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sliders className="w-5 h-5"/> Parâmetros da Simulação</h3>
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
                         <input type="number" step="0.01" className="w-full border p-2 rounded" value={(data.simulation.interestRateReal * 100).toFixed(2)} onChange={e => handleChange('interestRateReal', (parseFloat(e.target.value)/100).toString())} />
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
                                     <td className="p-3 text-gray-500">{r.prevBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                     <td className="p-3 text-green-600">+{r.interest.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                     <td className="p-3 text-blue-600">+{r.contribution.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                     <td className="p-3 font-bold">{r.currentBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
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
    const monthlyRate = Math.pow(1 + decumulationConfig.interestRate, 1/12) - 1;
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
                    <Briefcase className="w-5 h-5 text-purple-600"/> Planejamento de Independência Financeira
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
                                onChange={e => setDecumulationConfig({...decumulationConfig, capital: Number(e.target.value)})} 
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
                                onChange={e => setDecumulationConfig({...decumulationConfig, withdrawal: Number(e.target.value)})} 
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
                                onChange={e => setDecumulationConfig({...decumulationConfig, interestRate: Number(e.target.value)/100})} 
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
                    <p className="text-gray-400 text-xs mb-4">Capital necessário para sacar {decumulationConfig.withdrawal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}/mês sem reduzir o principal.</p>
                    <p className="text-4xl font-bold text-blue-600 mb-2">{perpetuityCapital.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0})}</p>
                    
                    <div className="mt-4 text-sm bg-blue-50 text-blue-700 py-1 px-3 rounded-full">
                        Meta FIRE
                    </div>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${yearsLasting === Infinity ? 'from-green-400 to-emerald-500' : 'from-orange-400 to-red-500'}`}></div>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-2">Cenário Atual</p>
                    <p className="text-gray-400 text-xs mb-4">Com o capital de {decumulationConfig.capital.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}, quanto tempo dura?</p>
                    
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

    for(let y=0; y<=years; y++) {
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
                    <p className="text-lg">{finalData.pessimista.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0})}</p>
                </div>
                <div className="p-4 border-t-4 border-teal-400 bg-teal-50">
                    <p className="font-bold text-teal-900">Realista (6% a.a.)</p>
                    <p className="text-lg font-bold">{finalData.realista.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0})}</p>
                </div>
                <div className="p-4 border-t-4 border-blue-400 bg-blue-50">
                    <p className="font-bold text-blue-900">Otimista (10% a.a.)</p>
                    <p className="text-lg">{finalData.otimista.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0})}</p>
                </div>
            </div>
        </div>
    );
  };
  
  const renderUpload = () => {
    const isApiConfigured = typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__ && __GEMINI_API_KEY__.length > 0;
    
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
                        <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Processando...</span>
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
    { id: 3, title: '4. Balanço Patrimonial', icon: Layers, render: renderBalanceSheet }, // Nova função
    { id: 4, title: '5. Investimentos', icon: TrendingUp, render: renderInvestments },
    { id: 5, title: '6. Resumo Sim.', icon: BarChart3, render: renderSimulation },
    { id: 6, title: '7. Sim. Detalhada', icon: DollarSign, render: renderDetailedSimulation },
    { id: 7, title: '8. S/ Perpetuidade', icon: Briefcase, render: renderDecumulation },
    { id: 8, title: '9. Projeção', icon: LineChart, render: renderProjectionScenarios },
    { id: 9, title: '10. Categorias', icon: Settings, render: renderCategories },
    { id: 10, title: '11. Upload / IA', icon: UploadCloud, render: renderUpload },
    { id: 11, title: '12. Clientes', icon: Users, render: renderClients },
  ];

  if (loadingSession) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!session) return <Auth />;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 relative">
      {/* FORCE PASSWORD CHANGE MODAL */}
      {mustChangePassword && <ForcePasswordChangeModal onClose={() => window.location.reload()} />}

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
        <div className="p-4 border-t border-blue-800">
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
