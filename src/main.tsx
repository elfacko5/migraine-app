import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { showKeyboardBar } from './utils/keyboardBar';
import { runPendingDelete } from './utils/backup';
import { cancelNotification, clearDeliveredReminders } from './utils/notifications';

// Data → Delete all data asked for it and reloaded; runs before any hook
// reads storage, so nothing on this page ever sees the old data.
runPendingDelete(cancelNotification, clearDeliveredReminders);

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
