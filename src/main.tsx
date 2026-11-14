import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installAudioUnlock } from './ui/sound';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

installAudioUnlock();
registerSW({ immediate: true });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
