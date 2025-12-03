
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { AppState, Client } from '../types';

// --- GESTÃO DE CLIENTES (CONSULTOR) ---

export const fetchClients = async (consultantId: string): Promise<Client[]> => {
    if (!isSupabaseConfigured()) return [];
    
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('consultant_id', consultantId)
        .order('name');
        
    if (error) {
        console.error('Erro ao buscar clientes:', error);
        return [];
    }
    return data || [];
};

export const createClient = async (consultantId: string, name: string): Promise<Client | null> => {
    const { data, error } = await supabase
        .from('clients')
        .insert({ consultant_id: consultantId, name })
        .select()
        .single();
        
    if (error) {
        console.error('Erro ao criar cliente:', error);
        return null;
    }
    return data;
};

export const deleteClient = async (clientId: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) throw error;
};

// --- DADOS FINANCEIROS ---

export const updateTransactionCategory = async (transactionId: string, newCategory: string, newType: string) => {
    if (!isSupabaseConfigured()) return;
    
    const { error } = await supabase
        .from('transactions')
        .update({ category: newCategory, type: newType })
        .eq('id', transactionId);

    if (error) {
        console.error('Erro ao atualizar categoria:', error);
        throw error;
    }
};

export const saveFinancialData = async (
  userId: string, // Mantido por compatibilidade, mas idealmente seria consultantId
  clientId: string,
  data: Partial<AppState>
): Promise<{ success: boolean; error?: any }> => {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase não configurado' };
  if (!clientId) return { success: false, error: 'Cliente não selecionado' };

  try {
    // 1. Atualizar Perfil Completo na tabela 'profiles' vinculada ao cliente
    if (data.personalData) {
        // Verifica se perfil já existe para esse cliente
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('client_id', clientId)
            .single();

        const profileData = {
            client_id: clientId,
            name: data.personalData.name,
            email: data.personalData.email,
            profession: data.personalData.profession,
            company: data.personalData.company,
            net_income_annual: data.personalData.netIncomeAnnual
        };

        if (existingProfile) {
            await supabase.from('profiles').update(profileData).eq('client_id', clientId);
        } else {
            // Se não existe, cria um novo ID pois profiles.id é PK
            await supabase.from('profiles').insert(profileData);
        }
    }

    // 2. Transações
    if (data.transactions && data.transactions.length > 0) {
        // Lógica de Deduplicação por Cliente
        const { data: existingTransactions } = await supabase
            .from('transactions')
            .select('date, amount, description')
            .eq('client_id', clientId);
            
        const existingSet = new Set(existingTransactions?.map(t => `${t.date}|${t.amount}|${t.description}`));
        
        const transactionsToInsert = data.transactions
            .filter(t => !existingSet.has(`${t.date}|${t.amount}|${t.description}`))
            .map(t => ({
                user_id: userId, // Log de quem inseriu (consultor)
                client_id: clientId,
                date: t.date,
                description: t.description,
                amount: t.amount,
                category: t.category,
                type: t.type,
                institution: t.institution
            }));
        
        if (transactionsToInsert.length > 0) {
            const { error: transError } = await supabase.from('transactions').insert(transactionsToInsert);
            if (transError) throw transError;
        }
    }

    // 3. Ativos (Snapshot - deleta anteriores deste cliente e insere novos)
    if (data.assets && data.assets.length > 0) {
        await supabase.from('assets').delete().eq('client_id', clientId);

        const assetsToInsert = data.assets.map(a => ({
            user_id: userId, // consultor
            client_id: clientId,
            ticker: a.ticker,
            type: a.type,
            quantity: a.quantity,
            current_price: a.currentPrice,
            total_value: a.totalValue,
            institution: a.institution
        }));

        const { error: assetError } = await supabase.from('assets').insert(assetsToInsert);
        if (assetError) throw assetError;
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar no Supabase:', error);
    return { success: false, error };
  }
};

export const fetchClientData = async (clientId: string): Promise<Partial<AppState> | null> => {
    if (!isSupabaseConfigured() || !clientId) return null;

    try {
        // Buscar Dados do Perfil
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('client_id', clientId)
            .single();

        // Buscar Transações
        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('client_id', clientId)
            .order('date', { ascending: false });

        // Buscar Ativos
        const { data: assets } = await supabase
            .from('assets')
            .select('*')
            .eq('client_id', clientId);

        return {
            personalData: {
                name: profile?.name || 'Cliente Selecionado',
                email: profile?.email || '',
                birthDate: '', 
                nationality: 'Brasileira',
                maritalStatus: '',
                propertyRegime: '',
                address: { street: '', neighborhood: '', zipCode: '' },
                profession: profile?.profession || '',
                company: profile?.company || '',
                cnpj: '',
                role: '',
                netIncomeAnnual: profile?.net_income_annual || 0,
                incomeDetails: {
                    sourceName: '', grossAmount: 0, inss: 0, irrf: 0, 
                    thirteenthSalary: 0, thirteenthIrrf: 0, rentIncome: 0, carneLeao: 0
                },
                insuranceTotal: 0,
                dependents: []
            },
            transactions: transactions?.map((t: any) => ({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: t.amount,
                category: t.category,
                type: t.type,
                institution: t.institution
            })) || [],
            assets: assets?.map((a: any) => ({
                ticker: a.ticker,
                type: a.type,
                quantity: a.quantity,
                currentPrice: a.current_price,
                totalValue: a.total_value,
                institution: a.institution
            })) || []
        };

    } catch (error) {
        console.error('Erro ao buscar dados do cliente:', error);
        return null;
    }
}
