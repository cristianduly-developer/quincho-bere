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

  const supa = createClient(process.env.VITE_SUPABASE_URL || process.env.VITE_SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // ── evento-cleanup: limpia eventos compartidos expirados (+10 días) ──
  if (req.query.action === 'evento-cleanup') {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 10)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const { data: expired, error: fetchErr } = await supa
      .from('reservas')
      .select('id, share_token')
      .not('share_token', 'is', null)
      .lt('fecha', cutoffStr)

    if (fetchErr) return res.status(500).json({ error: fetchErr.message })
    if (!expired?.length) return res.status(200).json({ cleaned: 0 })

    let cleaned = 0
    for (const r of expired) {
      const { data: fotos } = await supa.from('evento_fotos').select('id, url').eq('reserva_id', r.id)
      if (fotos?.length) {
        const paths = fotos.map(f => f.url?.match(/evento-fotos\/(.+)$/)?.[1]).filter(Boolean)
        if (paths.length) await supa.storage.from('evento-fotos').remove(paths)
        await supa.from('evento_fotos').delete().eq('reserva_id', r.id)
      }
      await supa.from('evento_rsvp').delete().eq('reserva_id', r.id)
      await supa.from('reservas').update({ share_token: null, share_sections: null, share_message: null, share_hero_url: null }).eq('id', r.id)
      cleaned++
    }
    console.log(`[evento-cleanup] Cleaned ${cleaned} expired events`)
    return res.status(200).json({ cleaned, cutoff: cutoffStr })
  }

  // ── set-access: actualiza tenant_access ──
  const { org_id, valid_until, plan } = req.body || {}
  if (!org_id || !valid_until) {
    return res.status(400).json({ ok: false, error: 'org_id y valid_until requeridos' })
  }

  const row = { tenant_id: org_id, valid_until }
  if (plan) row.plan = plan

  const { error } = await supa.from('tenant_access').upsert(row, { onConflict: 'tenant_id' })
  if (error) return res.status(500).json({ ok: false, error: error.message })

  return res.status(200).json({ ok: true })
}
