import { createClient } from '@supabase/supabase-js'

const DEMO_DIAS = 28
const APP_ID    = 'quincho'
const OWNER_ID  = 'd8eef2e2-7e07-4ec9-9c6e-766addf89cc5'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ ok: false, error: 'no_auth' })

  const supabaseApp = createClient(
    process.env.VITE_SUPA_URL,
    process.env.VITE_SUPA_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await supabaseApp.auth.getUser()
  if (userErr || !user?.email) return res.status(401).json({ ok: false, error: 'no_auth' })

  const email = user.email.toLowerCase().trim()
  const central = createClient(process.env.CENTRAL_URL, process.env.CENTRAL_SERVICE_KEY)

  const { data: orgsExistentes } = await central
    .from('organizaciones').select('id').eq('email_contacto', email).limit(1)

  let orgId
  if (orgsExistentes?.length > 0) {
    orgId = orgsExistentes[0].id
    const { data: subExistente } = await central
      .from('suscripciones_apps').select('id')
      .eq('org_id', orgId).eq('app_id', APP_ID).limit(1).maybeSingle()
    if (subExistente) return res.status(200).json({ ok: true, ya_existe: true })
  } else {
    const nombre = user.user_metadata?.full_name ||
      email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const { data: org, error: orgErr } = await central
      .from('organizaciones').insert({ nombre, email_contacto: email, owner_id: OWNER_ID })
      .select('id').single()
    if (orgErr || !org) { console.error('[registrar-demo] org:', orgErr); return res.status(500).json({ ok: false, error: 'error_central' }) }
    orgId = org.id
  }

  await central.from('empleados_organizacion')
    .upsert({ org_id: orgId, email }, { onConflict: 'org_id,email', ignoreDuplicates: true })

  const hoy = new Date().toISOString().slice(0, 10)
  const vencimiento = new Date(Date.now() + DEMO_DIAS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { error: subErr } = await central.from('suscripciones_apps').insert({
    org_id: orgId, app_id: APP_ID, plan: 'profesional', estado: 'demo',
    fecha_inicio_demo: hoy, limite_demo_dias: DEMO_DIAS, fecha_vencimiento: vencimiento,
  })
  if (subErr) { console.error('[registrar-demo] sub:', subErr); return res.status(500).json({ ok: false, error: 'error_central' }) }

  try {
    await central.from('notificaciones_admin').insert({ org_id: orgId, tipo: 'nueva_org', app_id: APP_ID })
    const nombreGoogle = user.user_metadata?.full_name || email.split('@')[0]
    const fechaAlta = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'cristianduly@gmail.com',
        subject: `🆕 Nueva cuenta demo — ${nombreGoogle}`,
        html: `<h2>🆕 Nueva cuenta demo en App Quincho</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:8px;font-weight:bold;">Nombre</td><td style="padding:8px;">${nombreGoogle}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">App</td><td style="padding:8px;">Quincho / Eventos</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Plan</td><td style="padding:8px;">Profesional (demo)</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Días de prueba</td><td style="padding:8px;">${DEMO_DIAS} días</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Fecha de alta</td><td style="padding:8px;">${fechaAlta}</td></tr>
          </table>`,
      }),
    })
  } catch (mailErr) {
    console.error('[registrar-demo] Error Resend:', mailErr?.message || mailErr)
  }

  console.log(`[registrar-demo] Demo creado para ${email}`)
  return res.status(200).json({ ok: true })
}
