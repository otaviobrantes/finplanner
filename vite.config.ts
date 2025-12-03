import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Removido o bloco 'define' para evitar conflitos. 
  // O Vite expõe automaticamente variáveis iniciadas com VITE_ via import.meta.env
});