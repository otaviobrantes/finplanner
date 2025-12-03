import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cast process to any to avoid TS error: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Expose API_KEY to process.env.API_KEY as required by the Gemini SDK guidelines
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
      // Garante compatibilidade caso alguma lib legada use process.env
      'process.env': {} 
    }
  };
});