import { Component } from 'react'
import { reportarError } from '../lib/reportarError'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error, info) {
    reportarError(error, { pantalla: window.location.pathname, accion: 'error_boundary', metadata: { componentStack: info?.componentStack } })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: '32px 24px', textAlign: 'center', background: '#0f172a' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Algo salió mal</div>
        <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24, maxWidth: 280 }}>
          Ocurrió un error inesperado. Podés intentar recargar la app.
        </div>
        <button onClick={() => window.location.reload()}
          style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
          Recargar app
        </button>
      </div>
    )
  }
}
