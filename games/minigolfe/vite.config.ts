import { defineConfig } from 'vite';

// base './' faz o build funcionar em qualquer subcaminho (ex.: /games/estoque/).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
