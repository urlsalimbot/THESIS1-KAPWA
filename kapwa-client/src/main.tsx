import React from 'react';
import ReactDOM from 'react-dom/client';
import { MainRoutes } from './routes';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});

window.addEventListener('beforeprint', () => {
  document.documentElement.style.setProperty('--print-date', new Date().toLocaleDateString());
});

  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MainRoutes />
  </React.StrictMode>
);
