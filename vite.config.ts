import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cast process to any to avoid TS error: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Define explicitamente process.env.API_KEY com o valor das variáveis de ambiente
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
      // IMPORTANTE: Não definimos 'process.env': {} vazio aqui pois isso pode sobrescrever a chave acima em alguns contextos
    }
  };
});