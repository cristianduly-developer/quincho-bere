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

  const { org_id } = req.body || {}
  if (!org_id) return res.status(400).json({ ok: false, error: 'org_id requerido' })

  try {
    const central = createClient(process.env.CENTRAL_URL, process.env.CENTRAL_SERVICE_KEY)
    const { data: org } = await central.from('organizaciones').select('email_contacto').eq('id', org_id).single()
    if (!org) return res.status(404).json({ ok: false, error: 'org no encontrada' })

    const supa = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // H-05: buscar user_id desde user_orgs por org_id (O(1) en vez de iterar todos los auth users)
    const { data: userOrg } = await supa
      .from('user_orgs')
      .select('user_id')
      .eq('org_id', org_id)
      .maybeSingle()

    const uid = userOrg?.user_id

    // H-04: usar RPC transaccional si existe, sino borrar en orden de FK
    const { error: rpcErr } = await supa.rpc('eliminar_datos_org', { p_org_id: org_id })

    if (rpcErr) {
      // Fallback: borrar secuencialmente en orden de dependencia (hijos antes que padres)
      await supa.from('extras_reserva').delete().eq('org_id', org_id)
      await supa.from('pagos').delete().eq('org_id', org_id)
      await supa.from('recordatorios').delete().eq('org_id', org_id)
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
      await supa.from('config').delete().eq('org_id', org_id)
      await supa.from('tenant_access').delete().eq('tenant_id', org_id)
      if (uid) await supa.from('user_orgs').delete().eq('user_id', uid)
    }

    if (uid) {
      await supa.auth.admin.deleteUser(uid)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[eliminar-org]', err)
    return res.status(500).json({ ok: false, error: 'internal' })
  }
}
