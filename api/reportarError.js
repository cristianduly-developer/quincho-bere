const APP_ID = 'quincho'
const SAAS_URL = process.env.SAAS_ADMIN_URL || 'https://saas.solucionesmdp.com.ar'

export function reportarError({ mensaje, stack, pantalla, accion, user_email, org_id, metadata } = {}) {
  fetch(`${SAAS_URL}/api/reportar-error`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': APP_ID,
      'x-app-key': process.env.ERROR_REPORT_KEY || '',
    },
    body: JSON.stringify({ mensaje, stack, pantalla, accion, user_email, org_id, metadata }),
  }).catch(() => {})
}
