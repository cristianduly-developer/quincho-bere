import { createClient } from '@supabase/supabase-js'

const SAAS_URL = process.env.SAAS_ADMIN_URL || 'https://saas.solucionesmdp.com.ar'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  const supabaseApp = createClient(process.env.VITE_SUPA_URL, process.env.VITE_SUPA_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error } = await supabaseApp.auth.getUser()
  if (error || !user?.email) return res.status(401).json({ error: 'No autorizado' })

  const { plan } = req.body || {}
  if (!plan) return res.status(400).json({ error: 'plan requerido' })

  const central = createClient(process.env.CENTRAL_URL, process.env.CENTRAL_SERVICE_KEY)
  const { data: emp } = await central
    .from('empleados_organizacion')
    .select('org_id')
    .eq('email', user.email.toLowerCase())
    .limit(1)
    .maybeSingle()

  if (!emp?.org_id) return res.status(404).json({ error: 'No se encontró tu organización.' })

  try {
    const r = await fetch(`${SAAS_URL}/api/mp-crear-suscripcion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: emp.org_id, app_id: 'quincho', plan }),
    })
    return res.status(r.status).json(await r.json())
  } catch {
    return res.status(500).json({ error: 'Error al conectar con el servicio de pagos.' })
  }
}
