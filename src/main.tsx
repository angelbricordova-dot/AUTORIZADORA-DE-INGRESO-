import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/onest';
import '@fontsource-variable/bricolage-grotesque';
import './styles.css';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { installLinkInterceptor, migrateHashRoute } from './router';

migrateHashRoute();
installLinkInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
