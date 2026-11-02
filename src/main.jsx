import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/great-vibes/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './styles.css';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui';
import { configured } from './lib/supabase';
import ErrorBoundary from './components/ErrorBoundary';

const tree = (
  <ErrorBoundary>
  <BrowserRouter>
    <ToastProvider>
      {configured ? <AuthProvider><App /></AuthProvider> : <App />}
    </ToastProvider>
  </BrowserRouter>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode>{tree}</React.StrictMode>);
