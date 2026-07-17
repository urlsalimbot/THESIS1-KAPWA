import React from 'react';
import ReactDOM from 'react-dom/client';
import { MainRoutes } from './routes';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MainRoutes />
  </React.StrictMode>
);

window.addEventListener('beforeprint', () => {
  document.documentElement.style.setProperty('--print-date', new Date().toLocaleDateString());
});
