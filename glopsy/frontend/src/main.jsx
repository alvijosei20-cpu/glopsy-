import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

document.addEventListener('contextmenu', (e) => e.preventDefault());

// El manejo de expiración de sesión vive en el interceptor de la instancia `api`
// (src/services/api.js), para no duplicar lógica ni reaccionar a respuestas 403.

// Renderizado único de la aplicación
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('Service Worker registration failed:', err);
    });
  });
}
