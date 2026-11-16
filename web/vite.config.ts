import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Só na máquina local: o servidor de desenvolvimento não fica visível na rede.
  // /api vai para a API local (docker compose). Mesma origem: o cookie de sessão funciona sem CORS.
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    // Celulares simples (Q14): JS compatível com navegadores mais antigos.
    target: 'es2019',
    sourcemap: false,
  },
});
