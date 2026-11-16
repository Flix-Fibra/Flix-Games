import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos/games.css';

// Barra de rolagem aparece só enquanto a página rola e some 0,8 s depois
let parou: number | undefined;
window.addEventListener('scroll', () => {
  document.documentElement.classList.add('rolando');
  window.clearTimeout(parou);
  parou = window.setTimeout(() => document.documentElement.classList.remove('rolando'), 800);
}, { passive: true });

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado no index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
