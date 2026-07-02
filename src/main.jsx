import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { reportarError } from './lib/reportarError.js'

window.onerror = (msg, _src, _line, _col, error) => {
  reportarError(error || new Error(String(msg)), { pantalla: window.location.pathname })
}
window.onunhandledrejection = (e) => {
  reportarError(e.reason || new Error('Unhandled rejection'), { pantalla: window.location.pathname })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
