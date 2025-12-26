
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { AppState, Client, CategoryItem } from '../types';

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

// --- PERSISTÊNCIA GLOBAL DE CATEGORIAS (TODO O SISTEMA) ---

export const fetchGlobalCategories = async (): Promise<CategoryItem[]> => {
    if (!isSupabaseConfigured()) return [];

    // Busca categorias personalizadas criadas por qualquer usuário na tabela GLOBAL
    const { data, error } = await supabase
        .from('global_categories')
        .select('*')
        .order('name');

    if (error) {
        console.error("Erro ao buscar categorias globais:", error);
        return [];
    }

    // Mapeia para o formato CategoryItem
    return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        group: item.category_group, // Mapeia da coluna do banco (snake_case) para o tipo (camelCase) se necessário
        isCustom: true
    }));
};

export const createGlobalCategory = async (name: string, group: string): Promise<CategoryItem | null> => {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('global_categories')
        .insert({ name: name, category_group: group })
        .select()
        .single();

    if (error) {
        console.error("Erro ao criar categoria global:", error);
        throw error;
    }

    return {
        id: data.id,
        name: data.name,
        group: data.category_group,
        isCustom: true
    };
};

export const deleteGlobalCategory = async (id: string) => {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
        .from('global_categories')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Erro ao excluir categoria global:", error);
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
                net_income_annual: data.personalData.netIncomeAnnual,
                // Income Details for PGBL Calculator
                // Income Details for PGBL Calculator
                gross_amount: data.personalData.incomeDetails?.grossAmount ?? 0,
                inss: data.personalData.incomeDetails?.inss ?? 0,
                irrf: data.personalData.incomeDetails?.irrf ?? 0,
                thirteenth_salary: data.personalData.incomeDetails?.thirteenthSalary ?? 0,
                rent_income: data.personalData.incomeDetails?.rentIncome ?? 0,
                dependents_count: data.personalData.dependents?.length ?? 0,
                // Novos campos - Fase 2 & 3
                medical_expenses: data.personalData.incomeDetails?.medicalExpenses ?? 0,
                education_expenses: data.personalData.incomeDetails?.educationExpenses ?? 0,
                birth_date: data.personalData.birthDate ?? null,
                nationality: data.personalData.nationality ?? null,
                marital_status: data.personalData.maritalStatus ?? null,
                property_regime: data.personalData.propertyRegime ?? null,
                address_street: data.personalData.address?.street ?? null,
                address_neighborhood: data.personalData.address?.neighborhood ?? null,
                address_zip_code: data.personalData.address?.zipCode ?? null,
                role: data.personalData.role ?? null,
                cnpj: data.personalData.cnpj ?? null,
                budget_targets: data.personalData.budgetTargets || {}
            };

            // Log detalhado para debug
            console.log('Tentando salvar profileData (Verificar campos novos):', JSON.stringify(profileData, null, 2));

            if (existingProfile) {
                const { error: updateError } = await supabase.from('profiles').update(profileData).eq('client_id', clientId);
                if (updateError) {
                    console.error('Erro ao atualizar profile:', updateError);
                    throw updateError;
                }
            } else {
                // Se não existe, cria um novo registro com ID gerado
                const insertData = {
                    ...profileData,
                    id: crypto.randomUUID()
                };
                const { error: insertError } = await supabase.from('profiles').insert(insertData);
                if (insertError) {
                    console.error('Erro ao inserir profile:', insertError);
                    throw insertError;
                }
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
        // 1. Buscar Cliente (Fonte da verdade para o Nome se o profile falhar)
        const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', clientId)
            .single();

        // 2. Buscar Dados do Perfil (Dados enriquecidos pela IA)
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('client_id', clientId)
            .single();

        // 3. Buscar Transações
        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('client_id', clientId)
            .order('date', { ascending: false });

        // 4. Buscar Ativos
        const { data: assets } = await supabase
            .from('assets')
            .select('*')
            .eq('client_id', clientId);

        // Prioridade do Nome: Profile (IA) -> Client (Cadastro) -> Fallback
        const displayName = profile?.name || client?.name || 'Cliente Selecionado';

        return {
            personalData: {
                name: displayName,
                email: profile?.email || '',
                birthDate: profile?.birth_date || '',
                nationality: profile?.nationality || 'Brasileira',
                maritalStatus: profile?.marital_status || '',
                propertyRegime: profile?.property_regime || '',
                address: {
                    street: profile?.address_street || '',
                    neighborhood: profile?.address_neighborhood || '',
                    zipCode: profile?.address_zip_code || ''
                },
                profession: profile?.profession || '',
                company: profile?.company || '',
                cnpj: profile?.cnpj || '',
                role: profile?.role || '',
                budgetTargets: profile?.budget_targets || {},
                netIncomeAnnual: profile?.net_income_annual || 0,
                incomeDetails: {
                    sourceName: profile?.source_name || '',
                    grossAmount: profile?.gross_amount || 0,
                    inss: profile?.inss || 0,
                    irrf: profile?.irrf || 0,
                    thirteenthSalary: profile?.thirteenth_salary || 0,
                    thirteenthIrrf: 0,
                    rentIncome: profile?.rent_income || 0,
                    carneLeao: 0,
                    medicalExpenses: profile?.medical_expenses || 0,
                    educationExpenses: profile?.education_expenses || 0
                },
                insuranceTotal: 0,
                // Reconstruir dependentes baseado no dependents_count salvo
                dependents: Array.from({ length: profile?.dependents_count || 0 }, (_, i) => ({
                    name: `Dependente ${i + 1}`,
                    birthDate: '',
                    occupation: '',
                    schoolOrCompany: '',
                    nationality: 'Brasileira',
                    maritalStatus: ''
                }))
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
