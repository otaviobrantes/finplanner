
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

async function inspectSchema() {
    console.log('Inspecting schema...');

    // Try to get tables by querying information_schema if possible (might require more permissions)
    // Alternatively, try to query known tables or use rpc if defined.
    // Since we don't know if rpc is there, let's try a generic approach or just check common names.

    // We can try to run a raw SQL query via RPC if the user has a ‘exec_sql’ or similar.
    // But since we don't know, let's try to query 'profiles' column names to be absolutely sure.

    const { data: profilesCols, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (pError) {
        console.error('Error querying profiles:', pError);
    } else {
        console.log('Columns in profiles:', Object.keys(profilesCols[0] || {}));
    }

    const { data: clientsCols, error: cError } = await supabase
        .from('clients')
        .select('*')
        .limit(1);

    if (cError) {
        console.error('Error querying clients:', cError);
    } else {
        console.log('Columns in clients:', Object.keys(clientsCols[0] || {}));
    }

    process.exit(0);
}

inspectSchema();
