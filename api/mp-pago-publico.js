const SAAS_URL = process.env.SAAS_ADMIN_URL || 'https://saas.solucionesmdp.com.ar'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { org_id, plan } = req.body || {}
  if (!org_id || !plan) return res.status(400).json({ error: 'org_id y plan requeridos' })

  try {
    const r = await fetch(`${SAAS_URL}/api/mp-crear-suscripcion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY || '' },
      body: JSON.stringify({ org_id, app_id: 'quincho', plan }),
    })
    return res.status(r.status).json(await r.json())
  } catch {
    return res.status(500).json({ error: 'Error al conectar con el servicio de pagos.' })
  }
}
