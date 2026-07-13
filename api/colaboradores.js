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

  // Determinar el org_id real del usuario autenticado
  const { data: acceso } = await central.rpc('verificar_acceso_email', {
    email_param: user.email.toLowerCase(),
    app_id_param: APP_ID,
  })
  const userOrgId = Array.isArray(acceso) ? acceso[0]?.ret_org_id : null
  if (!userOrgId) return res.status(403).json({ error: 'sin_acceso' })

  // GET — listar colaboradores del org del usuario
  if (req.method === 'GET') {
    const { data, error } = await central
      .from('empleados_organizacion')
      .select('*')
      .eq('org_id', userOrgId)
      .eq('activo', true)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, colaboradores: data || [] })
  }

  // POST — agregar colaborador al org del usuario
  if (req.method === 'POST') {
    const { email, nombre } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email requerido' })

    const { count } = await central
      .from('empleados_organizacion')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', userOrgId)
      .eq('activo', true)
    const MAX_COLABORADORES = 5
    if ((count ?? 0) >= MAX_COLABORADORES) {
      return res.status(403).json({ error: 'LIMITE_PLAN: Máximo de colaboradores alcanzado' })
    }

    const { error } = await central.from('empleados_organizacion').insert({
      org_id: userOrgId,
      email: email.trim().toLowerCase(),
      nombre: nombre?.trim() || email.trim(),
      activo: true,
    })
    if (error) return res.status(500).json({ error: error.message })

    central.from('notificaciones_admin').insert({
      tipo: 'nuevo_colaborador',
      mensaje: `Nuevo colaborador en App Eventos — ${nombre || email} (${email})`,
      org_id: userOrgId,
      app_id: APP_ID,
    }).then(() => {})

    return res.status(200).json({ ok: true })
  }

  // PATCH — desactivar colaborador (solo del org del usuario)
  if (req.method === 'PATCH') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id requerido' })
    const { error } = await central
      .from('empleados_organizacion')
      .update({ activo: false })
      .eq('id', id)
      .eq('org_id', userOrgId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
