import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Só na máquina local: o servidor de desenvolvimento não fica visível na rede.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    // Celulares simples (Q14): JS compatível com navegadores mais antigos.
    target: 'es2019',
    sourcemap: false,
  },
});
