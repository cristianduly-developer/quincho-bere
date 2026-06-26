import { createClient } from '@supabase/supabase-js'

const DEMO_DIAS = 28
const APP_ID    = 'quincho'
const OWNER_ID  = 'd8eef2e2-7e07-4ec9-9c6e-766addf89cc5'

async function isRateLimited(central, ip) {
  try {
    const { data } = await central.rpc('check_rate_limit', {
      p_key: `registrar-demo:${ip}`,
      p_max: 3,
      p_window_seconds: 3600,
    })
    return data === true
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ ok: false, error: 'no_auth' })

  const central = createClient(process.env.CENTRAL_URL, process.env.CENTRAL_SERVICE_KEY)

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  if (await isRateLimited(central, ip)) return res.status(429).json({ ok: false, error: 'rate_limited' })

  const supabaseApp = createClient(
    process.env.VITE_SUPA_URL,
    process.env.VITE_SUPA_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await supabaseApp.auth.getUser()
  if (userErr || !user?.email) return res.status(401).json({ ok: false, error: 'no_auth' })

  const email = user.email.toLowerCase().trim()
  const nombreGoogle = user.user_metadata?.full_name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const { data: rpcResult, error: rpcErr } = await central.rpc('registrar_demo', {
    p_email:     email,
    p_nombre:    nombreGoogle,
    p_app_id:    APP_ID,
    p_owner_id:  OWNER_ID,
    p_demo_dias: DEMO_DIAS,
  })

  if (rpcErr) { console.error('[registrar-demo] RPC:', rpcErr); return res.status(500).json({ ok: false, error: 'error_central' }) }
  if (rpcResult?.ya_existe) return res.status(200).json({ ok: true, ya_existe: true })

  const orgId = rpcResult?.org_id

  central.from('notificaciones_admin').insert({
    tipo: 'nueva_org',
    mensaje: `Nueva cuenta demo en App Eventos — ${nombreGoogle} (${email})`,
    org_id: orgId,
    app_id: APP_ID,
  }).then(() => {})

  try {
    const nombreGoogle = user.user_metadata?.full_name || email.split('@')[0]
    const fechaAlta = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
    // Email al admin
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'onboarding@resend.dev',
        to: 'cristianduly@gmail.com',
        subject: `🆕 Nueva cuenta demo — ${nombreGoogle}`,
        html: `<h2>🆕 Nueva cuenta demo en App-Eventos</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:8px;font-weight:bold;">Nombre</td><td style="padding:8px;">${nombreGoogle}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">App</td><td style="padding:8px;">App-Eventos</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Plan</td><td style="padding:8px;">Profesional (demo)</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Días de prueba</td><td style="padding:8px;">${DEMO_DIAS} días</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Fecha de alta</td><td style="padding:8px;">${fechaAlta}</td></tr>
          </table>`,
      }),
    })
    // Email de bienvenida al usuario
    const primerNombre = nombreGoogle.split(' ')[0]
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'onboarding@resend.dev',
        to: email,
        subject: `¡Bienvenido/a a App-Eventos! Tu período de prueba ya está activo 🎉`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
            <div style="background:#4f46e5;padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:-0.5px;">App-Eventos</h1>
              <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px;">Gestión de reservas y eventos</p>
            </div>
            <div style="background:#fff;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <h2 style="margin:0 0 16px;font-size:20px;">¡Hola, ${primerNombre}! 👋</h2>
              <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
                Tu cuenta de prueba en <strong>App-Eventos</strong> ya está activa. Tenés <strong>${DEMO_DIAS} días</strong> para explorar todas las funcionalidades del plan Profesional sin ningún compromiso.
              </p>
              <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
                Con App-Eventos podés gestionar reservas, turnos y eventos de forma simple y profesional, todo desde un solo lugar.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="https://eventos.solucionesmdp.com.ar/" style="background:#4f46e5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
                  Ir a la app →
                </a>
              </div>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
              <p style="color:#9ca3af;font-size:13px;margin:0;text-align:center;">
                ¿Tenés dudas? <a href="https://wa.me/5492235767784" style="color:#6b7280;">Escribinos por WhatsApp</a><br/>
                <strong style="color:#6b7280;">El equipo de Soluciones MDP</strong>
              </p>
            </div>
          </div>`,
      }),
    })
  } catch (mailErr) {
    console.error('[registrar-demo] Error Resend:', mailErr?.message || mailErr)
  }

  console.log(`[registrar-demo] Demo creado para ${email}`)
  return res.status(200).json({ ok: true })
}
