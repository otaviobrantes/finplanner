import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign,  
  FileText, Briefcase, Calculator, LineChart, Layers, 
  UploadCloud, Settings, ChevronRight, Activity, LogOut, FileCheck, AlertCircle, CheckCircle2, Loader2, Users, MapPin, Building, UserPlus, Trash2, Search, Sliders, Calendar
} from 'lucide-react';
import { extractFinancialData } from './services/geminiService';
import { saveFinancialData, fetchClientData, fetchClients, createClient, deleteClient, updateTransactionCategory } from './services/dbService';
import { uploadStatement } from './services/storageService';
import { parseFileContent } from './services/fileParser';
import { supabase } from './services/supabaseClient';
import { AppState, INITIAL_STATE, TransactionCategory, CategoryGroup, Client } from './types';
import { PatrimonyChart, AllocationChart, ExpensesBarChart, ScenarioChart } from './components/FinancialCharts';
import { Auth } from './components/Auth';

type UploadStatus = 'idle' | 'uploading' | 'extracting' | 'completed' | 'error';

// Helper to determine group from category (Logic duplicated from GeminiService for consistency)
const getCategoryGroup = (cat: string): CategoryGroup => {
  if (cat.includes('Transporte') || cat.includes('Carro') || cat.includes('Uber') || cat.includes('Combustível')) return 'Transporte';
  if (cat.includes('Restaurante') || cat.includes('Viagem') || cat.includes('Lazer') || cat.includes('Social') || cat.includes('Netflix')) return 'Social';
  if (cat.includes('Saúde') || cat.includes('Médico') || cat.includes('Hospital') || cat.includes('Dentista') || cat.includes('Farmácia')) return 'Saúde';
  if (cat.includes('Salário') || cat.includes('Receita') || cat.includes('Dividendo')) return 'Receitas';
  if (cat.includes('Presente')) return 'Presentes';
  if (cat.includes('Seguro') || cat.includes('Juros')) return 'Financeiro';
  if (cat.includes('Consultora') || cat.includes('Arrumação') || cat.includes('Costureira')) return 'Extra';
  if (cat.includes('Entidade')) return 'Profissional';
  return 'Essencial';
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState(11); // Começa na Tela de Clientes (Pag 12)
  const [data, setData] = useState<AppState>(INITIAL_STATE);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<{name: string, size?: string, url?: string} | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  
  // Success Alert State
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // New Client Creation State
  const [newClientName, setNewClientName] = useState("");

  // Date Filter State for Page 3
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session?.user) loadClients(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
          loadClients(session.user.id);
      } else {
          setData(INITIAL_STATE);
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
      const clientData = await fetchClientData(clientId);
      if (clientData) {
          setData(prev => ({
              ...prev,
              ...clientData,
              selectedClientId: clientId,
              personalData: { ...prev.personalData, ...clientData.personalData },
              lastUpdated: new Date().toISOString()
          }));
          setActiveTab(0); // Vai para o Dashboard do cliente
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
      }
  };

  const handleCategoryChange = async (transactionId: string, newCategory: string) => {
      const newType = getCategoryGroup(newCategory);

      // 1. Otimistic Update (Atualiza UI instantaneamente)
      setData(prev => ({
          ...prev,
          transactions: prev.transactions.map(t => 
              t.id === transactionId ? { ...t, category: newCategory as TransactionCategory, type: newType } : t
          )
      }));

      // 2. Atualiza no Banco
      try {
          await updateTransactionCategory(transactionId, newCategory, newType);
      } catch (error) {
          alert("Erro ao atualizar categoria no banco de dados.");
      }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const addLog = (msg: string) => setProcessingLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.user) return;

    const formattedSize = formatFileSize(file.size);
    setUploadedFile({ name: file.name, size: formattedSize });
    setUploadProgress(0);
    setUploadStatus('uploading');
    setProcessingLog([]);
    setShowSuccessAlert(false);
    addLog(`Arquivo selecionado: ${file.name} (${formattedSize})`);

    try {
      addLog("Enviando para Storage Seguro...");
      const result = await uploadStatement(file, session.user.id, (percent) => {
        setUploadProgress(percent);
      });

      if (result.success) {
        addLog("Upload concluído.");
        setUploadedFile(prev => prev ? ({ ...prev, url: result.url }) : null);
        setUploadStatus('extracting');
        
        try {
            await new Promise(r => setTimeout(r, 100));
            const extractedText = await parseFileContent(file);
            if (extractedText && extractedText.trim().length > 0) {
                setInputText(extractedText);
                addLog("Conteúdo lido com sucesso.");
                setUploadStatus('completed');
            } else {
                addLog("AVISO: Texto ilegível. Scan detectado?");
                setUploadStatus('completed');
            }
        } catch (parseError) {
            console.error(parseError);
            addLog("ERRO na leitura do PDF.");
            setUploadStatus('error');
        }

      } else {
        addLog(`ERRO no upload: ${result.error}`);
        setUploadStatus('error');
      }
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
    }
  };

  const triggerFileInput = () => {
    if (uploadStatus === 'uploading' || uploadStatus === 'extracting') return;
    fileInputRef.current?.click();
  };

  const handleProcess = async () => {
    if (!session?.user) return;

    setIsProcessing(true);
    setShowSuccessAlert(false);
    addLog("Iniciando análise com IA (Gemini 2.5)...");
    
    try {
      const extracted = await extractFinancialData(inputText);
      addLog("Dados extraídos e categorizados.");
      
      // AUTO-DETECTION LOGIC
      let targetClientId = data.selectedClientId;
      let targetClientName = extracted.detectedClientName || "Novo Cliente (Extraído)";

      if (extracted.detectedClientName) {
          addLog(`Nome detectado no extrato: ${extracted.detectedClientName}`);
          
          // Verifica se já existe cliente com esse nome (case insensitive)
          const existingClient = data.clients.find(c => c.name.toLowerCase() === extracted.detectedClientName?.toLowerCase());
          
          if (existingClient) {
              addLog(`Cliente identificado na base: ${existingClient.name}`);
              targetClientId = existingClient.id;
          } else {
              addLog(`Cliente novo detectado. Criando cadastro para: ${extracted.detectedClientName}...`);
              const newClient = await createClient(session.user.id, extracted.detectedClientName);
              if (newClient) {
                  setData(prev => ({ ...prev, clients: [...prev.clients, newClient] }));
                  targetClientId = newClient.id;
                  addLog("Cliente criado automaticamente.");
              }
          }
      }

      if (!targetClientId) {
          addLog("AVISO: Nenhum cliente identificado. Selecione um cliente manualmente antes de salvar.");
          setIsProcessing(false);
          return;
      }

      const newData = {
        personalData: { ...data.personalData, ...extracted.personalData },
        transactions: extracted.transactions || [],
        assets: extracted.assets || [],
      };
      
      // Update local state immediately for feedback
      setData(prev => ({
          ...prev,
          selectedClientId: targetClientId,
          personalData: { ...prev.personalData, ...newData.personalData },
          transactions: newData.transactions,
          assets: newData.assets
      }));

      addLog(`Salvando dados para o cliente ID: ${targetClientId}...`);
      const saveResult = await saveFinancialData(session.user.id, targetClientId, newData);
      
      if (saveResult.success) {
          const newTransCount = (extracted.transactions || []).length;
          setSuccessMessage(`Processamento concluído! Dados vinculados a ${targetClientName}.`);
          setShowSuccessAlert(true);
          addLog("SUCESSO: Dados salvos e vinculados.");
          // Se não estava selecionado, seleciona agora e carrega para atualizar IDs
          handleSelectClient(targetClientId);
      } else {
          addLog("ERRO ao salvar no banco: " + saveResult.error?.message);
      }
      
    } catch (err: any) {
      addLog("ERRO FATAL: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- SIMULATION LOGIC ---
  const calculateProjection = () => {
    const { initialPatrimony, monthlyContribution, interestRateReal, years } = data.simulation;
    const projection = [];
    let currentBalance = initialPatrimony;
    let totalInvested = initialPatrimony;
    const monthlyRate = Math.pow(1 + interestRateReal, 1/12) - 1;

    for (let year = 0; year <= years; year++) {
      projection.push({
        year: new Date().getFullYear() + year,
        value: Math.round(currentBalance),
        invested: Math.round(totalInvested)
      });

      // Advance one year (12 months)
      for (let m = 0; m < 12; m++) {
        currentBalance = currentBalance * (1 + monthlyRate) + monthlyContribution;
        totalInvested += monthlyContribution;
      }
    }
    return projection;
  };

  // --- RENDERERS ---

  const renderClients = () => (
      <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
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
                                  <button onClick={() => handleSelectClient(client.id)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100 font-medium">
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
           <Users className="w-5 h-5 text-blue-600" /> 1.1 Dados Pessoais e Profissionais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
                <InfoRow label="Nome" value={data.personalData.name} />
                <InfoRow label="Nascimento" value={data.personalData.birthDate || '--/--/----'} />
                <InfoRow label="Nacionalidade" value={data.personalData.nationality} />
            </div>
            <div className="space-y-3">
                <InfoRow label="Profissão" value={data.personalData.profession} />
                <InfoRow label="Empresa" value={data.personalData.company} />
            </div>
            <div className="space-y-3">
                <InfoRow label="Email" value={data.personalData.email} />
                <InfoRow label="Cidade" value={data.personalData.address?.neighborhood || '-'} />
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
             </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5 text-purple-600" /> 1.5 Dependentes
             </h3>
             {data.personalData.dependents.length > 0 ? (
                 <div className="space-y-2">
                     {data.personalData.dependents.map((dep, idx) => (
                         <div key={idx} className="bg-gray-50 p-2 rounded text-sm flex justify-between">
                             <span className="font-medium">{dep.name}</span>
                             <span className="text-gray-500">{dep.birthDate}</span>
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

  const renderBudget = () => (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Visão Geral do Orçamento</h3>
            <div className="h-64">
                <ExpensesBarChart transactions={data.transactions} />
            </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 p-6 border-b">Detalhamento por Categoria</h3>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {['Essencial', 'Saúde', 'Social', 'Transporte', 'Financeiro', 'Extra'].map(group => {
                    const groupTrans = data.transactions.filter(t => t.type === group);
                    const total = groupTrans.reduce((acc, t) => acc + Math.abs(t.amount), 0);
                    if (total === 0) return null;
                    return (
                        <div key={group} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-gray-700">{group}</h4>
                                <span className="font-bold text-gray-900">{total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                            </div>
                            <div className="space-y-1">
                                {Array.from(new Set(groupTrans.map(t => t.category))).map(cat => {
                                    const catTotal = groupTrans.filter(t => t.category === cat).reduce((acc, t) => acc + Math.abs(t.amount), 0);
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

  const renderRealized = () => {
    // Ordenar categorias alfabeticamente para o dropdown
    const sortedCategories = Object.values(TransactionCategory).sort();

    const filteredTransactions = data.transactions.filter(t => {
      if (dateRange.start && t.date < dateRange.start) return false;
      if (dateRange.end && t.date > dateRange.end) return false;
      return true;
    });

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-gray-800">Transações Realizadas</h3>
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
                            {sortedCategories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
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

  const renderInvestments = () => (
      <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold mb-4">Carteira de Investimentos</h3>
          <div className="h-64 mb-6"><AllocationChart assets={data.assets} /></div>
          <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-left"><th className="p-2">Ativo</th><th className="p-2">Tipo</th><th className="p-2 text-right">Valor</th></tr></thead>
              <tbody>
                  {data.assets.map((a, i) => (
                      <tr key={i} className="border-t">
                          <td className="p-2 font-bold">{a.ticker}</td>
                          <td className="p-2">{a.type}</td>
                          <td className="p-2 text-right">R$ {a.totalValue.toLocaleString('pt-BR')}</td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
  );
  
  // PAGINA 6 - RESUMO SIMULAÇÃO
  const renderSimulationSummary = () => {
    const projection = calculateProjection();
    const finalValue = projection[projection.length - 1].value;
    const finalInvested = projection[projection.length - 1].invested;

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
          <div className="flex justify-between items-end border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Resumo da Simulação</h3>
                <p className="text-gray-500">Evolução patrimonial projetada para {data.simulation.years} anos.</p>
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
                  <p className="text-xl font-bold text-purple-900">{(finalValue / finalInvested).toFixed(2)}x</p>
                  <p className="text-xs text-purple-600">seu dinheiro investido</p>
              </div>
          </div>
      </div>
    );
  };

  // PAGINA 7 - SIMULAÇÃO DETALHADA
  const renderDetailedSimulation = () => {
     // Permite edição simples dos parametros
     const handleChange = (field: keyof typeof data.simulation, value: string) => {
         setData(prev => ({
             ...prev,
             simulation: { ...prev.simulation, [field]: parseFloat(value) || 0 }
         }));
     };

     const monthlyRate = Math.pow(1 + data.simulation.interestRateReal, 1/12) - 1;
     let currentBalance = data.simulation.initialPatrimony;
     const rows = [];
     
     // Gera 60 meses para exibição de exemplo (ou mais se quiser paginar)
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

  // PAGINA 8 - SIMULAÇÃO SEM PERPETUIDADE (Consumo de Capital)
  const renderDecumulation = () => {
    // Cálculo simplificado: Quanto dura o dinheiro se parar de aportar e começar a sacar X?
    const patrimony = data.simulation.initialPatrimony + (data.simulation.monthlyContribution * 12 * 10); // Supor 10 anos de acumulação
    const monthlyWithdrawal = 10000; // Exemplo fixo ou configurável
    const yearsToZero = Math.log(monthlyWithdrawal / (monthlyWithdrawal - patrimony * (data.simulation.interestRateReal/12))) / Math.log(1 + data.simulation.interestRateReal/12) / 12;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-gray-800">Aposentadoria com Consumo de Capital</h3>
            <p className="text-gray-600">Este módulo calcula a fase de "Decumulação": gastar o dinheiro acumulado até que ele acabe em uma data alvo (ex: 90 anos), permitindo retiradas mensais maiores do que viver apenas de renda.</p>
            
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 text-center">
                 <p className="text-lg text-orange-800 mb-2">Conceito: Morrer com Zero</p>
                 <p className="text-sm text-orange-700">Diferente da perpetuidade (onde você nunca toca no principal), aqui calculamos o consumo inteligente do patrimônio para maximizar o padrão de vida na aposentadoria.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                 <div className="border p-6 rounded-xl">
                     <h4 className="font-bold mb-4">Seu Cenário Atual</h4>
                     <p className="text-sm text-gray-500 mb-1">Patrimônio Acumulado (Simulado)</p>
                     <p className="text-2xl font-bold mb-4">{patrimony.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                     
                     <p className="text-sm text-gray-500 mb-1">Retirada Mensal Desejada</p>
                     <p className="text-2xl font-bold mb-4 text-red-600">- R$ {monthlyWithdrawal.toLocaleString('pt-BR')}</p>
                 </div>
                 <div className="border p-6 rounded-xl bg-gray-50 flex flex-col justify-center items-center">
                     <h4 className="font-bold text-gray-600 mb-2">Longevidade do Capital</h4>
                     <p className="text-5xl font-bold text-blue-600">{isNaN(yearsToZero) ? '∞' : Math.floor(yearsToZero)}</p>
                     <p className="text-gray-500">anos de duração</p>
                     <p className="text-xs text-gray-400 mt-2 text-center max-w-xs">Considerando que o dinheiro restante continua rendendo {data.simulation.interestRateReal * 100}% a.a.</p>
                 </div>
            </div>
        </div>
    );
  };

  // PAGINA 9 - PROJEÇÃO E CENÁRIOS
  const renderProjectionScenarios = () => {
    const years = data.simulation.years;
    const dataPoints = [];
    let p = data.simulation.initialPatrimony; // Pessimista (4%)
    let r = data.simulation.initialPatrimony; // Realista (6%)
    let o = data.simulation.initialPatrimony; // Otimista (10%)
    const contrib = data.simulation.monthlyContribution * 12;

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

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-gray-800">Comparativo de Cenários</h3>
            <p className="text-gray-500 mb-4">Como a taxa de juros impacta seu patrimônio no longo prazo.</p>
            
            <ScenarioChart data={dataPoints} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-6">
                <div className="p-4 border-t-4 border-orange-400 bg-orange-50">
                    <p className="font-bold text-orange-900">Pessimista (4% a.a.)</p>
                    <p className="text-lg">{dataPoints[years].pessimista.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0})}</p>
                </div>
                <div className="p-4 border-t-4 border-teal-400 bg-teal-50">
                    <p className="font-bold text-teal-900">Realista (6% a.a.)</p>
                    <p className="text-lg font-bold">{dataPoints[years].realista.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0})}</p>
                </div>
                <div className="p-4 border-t-4 border-blue-400 bg-blue-50">
                    <p className="font-bold text-blue-900">Otimista (10% a.a.)</p>
                    <p className="text-lg">{dataPoints[years].otimista.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0})}</p>
                </div>
            </div>
        </div>
    );
  };
  
  const renderCategories = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold mb-4">Categorias do Sistema</h3>
        <p className="text-gray-500 mb-4">Estas são as categorias utilizadas pela IA para classificar as transações.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.values(TransactionCategory).map(cat => (
                <div key={cat} className="text-xs bg-gray-100 p-2 rounded text-gray-700">{cat}</div>
            ))}
        </div>
    </div>
  );
  
  const renderUpload = () => (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="text-center">
        <h2 className="text-2xl font-bold">11. Upload Inteligente</h2>
        <p className="text-gray-500">Carregue extratos bancários (PDF) ou planilhas para análise automática.</p>
        {!data.selectedClientId && (
            <div className="mt-2 text-amber-600 text-sm bg-amber-50 inline-block px-3 py-1 rounded-full">
                ⚠️ Nenhum cliente selecionado. O sistema tentará identificar o nome no arquivo.
            </div>
        )}
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.csv,.ofx,.txt" />

      <div onClick={triggerFileInput} className={`bg-white p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors ${uploadStatus === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
          {uploadStatus === 'idle' && <><UploadCloud className="w-10 h-10 text-gray-400 mb-2" /><p>Clique para selecionar arquivo</p></>}
          {uploadStatus === 'uploading' && <><Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-2" /><p>Enviando {uploadProgress}%</p></>}
          {uploadStatus === 'extracting' && <><FileText className="w-10 h-10 text-blue-500 animate-pulse mb-2" /><p>Lendo arquivo...</p></>}
          {uploadStatus === 'completed' && <><CheckCircle2 className="w-10 h-10 text-green-500 mb-2" /><p className="font-bold">{uploadedFile?.name}</p><p className="text-sm text-green-600">Pronto para processar</p></>}
          {uploadStatus === 'error' && <><AlertCircle className="w-10 h-10 text-red-500 mb-2" /><p>Erro no upload</p></>}
      </div>

      <div className="bg-white p-4 rounded-xl border">
          <textarea value={inputText} onChange={e => setInputText(e.target.value)} className="w-full h-32 text-xs font-mono bg-gray-50 p-2 rounded resize-none outline-none" placeholder="Conteúdo do arquivo..." />
          <div className="mt-4 flex justify-end">
              <button 
                onClick={handleProcess} 
                disabled={isProcessing || uploadStatus !== 'completed'}
                className={`px-6 py-2 rounded-lg font-bold text-white flex items-center gap-2 ${isProcessing || uploadStatus !== 'completed' ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                  {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <TrendingUp className="w-4 h-4" />} 
                  {isProcessing ? 'Extrair Dados' : 'Extrair Dados'}
              </button>
          </div>
      </div>
      
      {processingLog.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs h-32 overflow-y-auto">
              {processingLog.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
          </div>
      )}
    </div>
  );

  const TABS = [
    { id: 0, title: '1. Resumo Pessoal', icon: Activity, render: renderSummary },
    { id: 1, title: '2. Orçamento', icon: Calculator, render: renderBudget },
    { id: 2, title: '3. Realizado', icon: FileText, render: renderRealized },
    { id: 3, title: '4. Balanço', icon: Layers, render: renderSimulationSummary }, // Reutilizando para exemplo, mas idealmente teria seu proprio
    { id: 4, title: '5. Investimentos', icon: TrendingUp, render: renderInvestments },
    { id: 5, title: '6. Resumo Sim.', icon: BarChart3, render: renderSimulationSummary },
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
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10 overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">FinPlanner</h1>
          <p className="text-xs text-slate-500 mt-1">Consultoria Digital</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon className="w-5 h-5" />
                {tab.title}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-full">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 relative">
        {isLoadingData && (
            <div className="absolute inset-0 bg-white/70 z-50 flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        )}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{TABS[activeTab].title}</h2>
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
                 {/* Utilizando padding-top (pt-2) em vez de margin-top (mt-2) para criar uma ponte invisível para o hover */}
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
          <div className="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-sm w-full bg-white rounded-xl shadow-2xl border-l-8 border-green-500 p-5 flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-1" />
              <div>
                  <h4 className="font-bold text-gray-900">Sucesso!</h4>
                  <p className="text-gray-600 text-sm">{successMessage}</p>
                  <button onClick={() => setShowSuccessAlert(false)} className="text-sm text-gray-400 hover:text-gray-600 mt-2">Fechar</button>
              </div>
          </div>
      )}
    </div>
  );
}

const InfoRow = ({ label, value }: { label: string, value: string | number }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
    <span className="text-gray-500 text-sm">{label}</span>
    <span className="font-medium text-gray-800">{value}</span>
  </div>
);