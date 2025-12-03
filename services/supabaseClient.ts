import { createClient } from '@supabase/supabase-js';

// Credenciais fornecidas
export const SUPABASE_URL: string = 'https://gowmekewqxluqfqcoltj.supabase.co';
export const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvd21la2V3cXhsdXFmcWNvbHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MzM1NzQsImV4cCI6MjA3OTUwOTU3NH0._F6owo6pAMOV4msyjMB8WFBRmdGmYRVIIL9XrVYYoqg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isSupabaseConfigured = () => {
    return SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
}