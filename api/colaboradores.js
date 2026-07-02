import { createClient } from '@supabase/supabase-js'

const APP_ID = 'quincho'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || 'https://eventos.solucionesmdp.com.ar')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'no_auth' })

  const supabaseApp = createClient(
    process.env.VITE_SUPA_URL,
    process.env.VITE_SUPA_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await supabaseApp.auth.getUser()
  if (userErr || !user?.email) return res.status(401).json({ error: 'no_auth' })

  const central = createClient(process.env.CENTRAL_URL, process.env.CENTRAL_SERVICE_KEY)

  // GET — listar colaboradores del org
  if (req.method === 'GET') {
    const { orgId } = req.query
    if (!orgId) return res.status(400).json({ error: 'orgId requerido' })
    const { data, error } = await central
      .from('empleados_organizacion')
      .select('*')
      .eq('org_id', orgId)
      .eq('activo', true)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, colaboradores: data || [] })
  }

  // POST — agregar colaborador
  if (req.method === 'POST') {
    const { org_id, email, nombre } = req.body || {}
    if (!org_id || !email) return res.status(400).json({ error: 'org_id y email requeridos' })

    const { error } = await central.from('empleados_organizacion').insert({
      org_id,
      email: email.trim().toLowerCase(),
      nombre: nombre?.trim() || email.trim(),
      activo: true,
    })
    if (error) return res.status(500).json({ error: error.message })

    central.from('notificaciones_admin').insert({
      tipo: 'nuevo_colaborador',
      mensaje: `Nuevo colaborador en App Eventos — ${nombre || email} (${email})`,
      org_id,
      app_id: APP_ID,
    }).then(() => {})

    return res.status(200).json({ ok: true })
  }

  // PATCH — desactivar colaborador
  if (req.method === 'PATCH') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id requerido' })
    const { error } = await central
      .from('empleados_organizacion')
      .update({ activo: false })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
