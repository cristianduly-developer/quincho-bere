import { createClient } from '@supabase/supabase-js'
import { findUserByEmail } from '@solucionesmdp/core'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-app-key')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false })

  const appKey = req.headers['x-app-key']
  if (!process.env.ERROR_REPORT_KEY || appKey !== process.env.ERROR_REPORT_KEY) {
    return res.status(401).json({ ok: false, error: 'no_auth' })
  }

  const { org_id } = req.body || {}
  if (!org_id) return res.status(400).json({ ok: false, error: 'org_id requerido' })

  try {
    const central = createClient(process.env.CENTRAL_URL, process.env.CENTRAL_SERVICE_KEY)
    const { data: org } = await central.from('organizaciones').select('email_contacto').eq('id', org_id).single()
    if (!org) return res.status(404).json({ ok: false, error: 'org no encontrada' })

    const supa = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const user = await findUserByEmail(supa, org.email_contacto)
    if (!user) return res.status(200).json({ ok: true, msg: 'usuario no encontrado en satellite' })

    const uid = user.id

    // Tablas con org_id
    await supa.from('pagos').delete().eq('org_id', org_id)
    await supa.from('recordatorios').delete().eq('org_id', org_id)
    await supa.from('extras_reserva').delete().eq('org_id', org_id)
    await supa.from('reservas').delete().eq('org_id', org_id)
    await supa.from('bloqueos').delete().eq('org_id', org_id)
    await supa.from('clientes').delete().eq('org_id', org_id)
    await supa.from('gastos').delete().eq('org_id', org_id)
    await supa.from('tareas').delete().eq('org_id', org_id)
    await supa.from('precios_temporada').delete().eq('org_id', org_id)
    await supa.from('temporadas_precio').delete().eq('org_id', org_id)
    await supa.from('servicios_extras').delete().eq('org_id', org_id)
    await supa.from('turnos_recurso').delete().eq('org_id', org_id)
    await supa.from('recursos').delete().eq('org_id', org_id)
    // Tablas con user_id
    await supa.from('config').delete().eq('org_id', org_id)
    await supa.from('user_orgs').delete().eq('user_id', uid)

    await supa.auth.admin.deleteUser(uid)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[eliminar-org]', err)
    return res.status(500).json({ ok: false, error: 'internal' })
  }
}
