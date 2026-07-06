import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import ErrorBoundary from './src/components/ErrorBoundary.jsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // Solo captura errores en producción para no saturar la cuota en dev
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // No enviar errores de red (timeouts de Supabase, offline)
    if (event.exception?.values?.[0]?.type === 'TypeError' &&
        event.exception.values[0].value?.includes('fetch')) return null;
    return event;
  },
})

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
