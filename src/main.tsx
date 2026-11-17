import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { showKeyboardBar } from './utils/keyboardBar';

showKeyboardBar();

// TEMPORARY phone readout; absent unless built with VITE_VIEWPORT_PROBE=1.
if (import.meta.env.VITE_VIEWPORT_PROBE === '1') {
  import('./utils/viewportProbe').then((m) => m.startViewportProbe());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
