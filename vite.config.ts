import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente baseadas no modo (ex: production)
  // O terceiro argumento '' garante que carregue todas, inclusive as do sistema (Vercel)
  // Fix: Cast process to any to avoid TS error: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Injeta a variável VITE_API_KEY como uma string fixa no código final
      // Isso garante que ela exista mesmo que import.meta.env falhe
      '__GEMINI_API_KEY__': JSON.stringify(env.VITE_API_KEY),
    },
  };
});