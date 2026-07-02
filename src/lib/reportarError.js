const SAAS_URL = 'https://saas.solucionesmdp.com.ar'
const APP_ID   = 'quincho'
const APP_KEY  = import.meta.env.VITE_ERROR_KEY || ''

export function reportarError(error, contexto = {}) {
  try {
    fetch(`${SAAS_URL}/api/reportar-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-id': APP_ID, 'x-app-key': APP_KEY },
      body: JSON.stringify({
        mensaje:    error?.message || String(error),
        stack:      error?.stack   || null,
        pantalla:   contexto.pantalla   || window?.location?.pathname || null,
        accion:     contexto.accion     || null,
        user_email: contexto.user_email || null,
        org_id:     contexto.org_id     || null,
        navegador:  navigator?.userAgent || null,
        dispositivo: /mobile/i.test(navigator?.userAgent || '') ? 'mobile' : 'desktop',
        metadata:   contexto.metadata   || null,
      }),
    }).catch(() => {})
  } catch {}
}
