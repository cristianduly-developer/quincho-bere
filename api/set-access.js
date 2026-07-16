import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = process.env.APP_ORIGIN || 'https://eventos.solucionesmdp.com.ar'
  if (origin === allowed || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-app-key')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false })

  const appKey = req.headers['x-app-key']
  if (!process.env.ERROR_REPORT_KEY || appKey !== process.env.ERROR_REPORT_KEY) {
    return res.status(401).json({ ok: false, error: 'no_auth' })
  }

  const { org_id, valid_until, plan } = req.body || {}
  if (!org_id || !valid_until) {
    return res.status(400).json({ ok: false, error: 'org_id y valid_until requeridos' })
  }

  const supa = createClient(process.env.VITE_SUPABASE_URL || process.env.VITE_SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const row = { tenant_id: org_id, valid_until }
  if (plan) row.plan = plan

  const { error } = await supa.from('tenant_access').upsert(row, { onConflict: 'tenant_id' })
  if (error) return res.status(500).json({ ok: false, error: error.message })

  return res.status(200).json({ ok: true })
}
