import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ✅ Apply tenant primary_color before first render — prevents faded buttons
(function applyStoredTenantColor() {
  try {
    const tenant =
      JSON.parse(sessionStorage.getItem('tenant') || 'null') ??
      JSON.parse(localStorage.getItem('tenant')   || 'null');

    const hex = tenant?.primary_color;
    if (!hex || !hex.startsWith('#')) return;

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    document.documentElement.style.setProperty(
      '--color-primary',
      `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
    );
  } catch { /* silent fail */ }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);