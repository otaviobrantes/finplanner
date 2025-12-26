
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

async function listTables() {
    console.log('Listing tables...');

    // In Supabase, you usually can't query information_schema directly from the client.
    // However, we can try to query 'clients' and check for 'consultant_id' data.
    // Or we can try to query common table names.

    const tablesToTry = ['profiles', 'users', 'consultants', 'admins', 'managers'];

    for (const table of tablesToTry) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table '${table}' error: ${error.message}`);
        } else {
            console.log(`Table '${table}' exists. Columns:`, Object.keys(data[0] || {}));
        }
    }

    process.exit(0);
}

listTables();
