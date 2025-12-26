
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key is missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'viviane@arsoconsultoria.com.br';

    console.log(`Checking for user with email: ${email}...`);

    // Check in 'profiles' table
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email);

    if (profileError) {
        console.error('Error checking profiles:', profileError);
    } else if (profile && profile.length > 0) {
        console.log('User found in profiles table:');
        console.log(JSON.stringify(profile, null, 2));
    } else {
        console.log('User NOT found in profiles table.');
    }

    // Check 'clients' table as well
    const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .ilike('name', '%Viviane%');

    if (clientError) {
        console.error('Error checking clients:', clientError);
    } else if (clients && clients.length > 0) {
        console.log('Found clients with name containing "Viviane":');
        console.log(JSON.stringify(clients, null, 2));
    }

    process.exit(0);
}

checkUser();
