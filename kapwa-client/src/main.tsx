import React from 'react';
import ReactDOM from 'react-dom/client';
import { MainRoutes } from './routes';
import './index.css';
import './i18n';
import { getInitialLang, localeLangTag } from './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MainRoutes />
  </React.StrictMode>
);

document.documentElement.lang = localeLangTag(getInitialLang());

window.addEventListener('beforeprint', () => {
  document.documentElement.style.setProperty('--print-date', new Date().toLocaleDateString());
});
