
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ATENÇÃO: Para atualizar metadados e senhas de outros usuários, 
// você precisa da SERVICE_ROLE_KEY (não a anon key).
// Adicione SUPABASE_SERVICE_ROLE_KEY no seu .env se ainda não tiver.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function setupFirstAccess() {
    const email = 'viviane@arsoconsultoria.com.br';
    const tempPassword = 'Trocar123!'; // Senha provisória

    console.log(`Configurando primeiro acesso para: ${email}...`);

    // 1. Buscar o usuário pelo email para pegar o ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Erro ao listar usuários (Certifique-se de usar a SERVICE_ROLE_KEY):', listError.message);
        process.exit(1);
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error(`Usuário ${email} não encontrado no Auth do Supabase.`);
        process.exit(1);
    }

    // 2. Atualizar senha e metadados
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        {
            password: tempPassword,
            user_metadata: { ...user.user_metadata, force_password_change: true }
        }
    );

    if (error) {
        console.error('Erro ao atualizar usuário:', error.message);
    } else {
        console.log('✅ Sucesso!');
        console.log(`Email: ${email}`);
        console.log(`Senha Provisória: ${tempPassword}`);
        console.log('O sistema irá forçar a troca de senha assim que ela fizer o primeiro login.');
    }

    process.exit(0);
}

setupFirstAccess();
