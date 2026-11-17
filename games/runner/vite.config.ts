import { defineConfig } from 'vite';

// base './' faz o build funcionar em qualquer subcaminho (ex.: /games/snake/).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
