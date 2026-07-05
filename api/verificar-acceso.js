import { createClient } from '@supabase/supabase-js'
import { syncTenantAccess } from '@solucionesmdp/core'

const APP_ID = 'quincho'
const supaLocal = createClient(process.env.VITE_SUPABASE_URL || process.env.VITE_SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = process.env.APP_ORIGIN || 'https://quincho.solucionesmdp.com.ar'
  if (origin === allowed || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

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

  const { data, error } = await central.rpc('verificar_acceso_email', {
    email_param: user.email.toLowerCase(),
    app_id_param: APP_ID,
  })
  if (error) { console.error('[verificar-acceso] RPC error:', error); return res.status(503).json({ ok: false, error: 'servicio_no_disponible' }) }

  const acceso = Array.isArray(data) ? (data[0] ?? null) : null

  if (!acceso?.tiene_acceso) {
    // Verificar si está suspendido/impago (el RPC filtra suspendidos)
    const { data: empData } = await central
      .from('empleados_organizacion').select('org_id')
      .eq('email', user.email.toLowerCase()).limit(1)
    if (empData?.length > 0) {
      const { data: subData } = await central
        .from('suscripciones_apps').select('estado')
        .eq('org_id', empData[0].org_id).eq('app_id', APP_ID)
        .in('estado', ['suspendido', 'impago', 'cancelado']).limit(1).maybeSingle()
      if (subData?.estado) return res.status(200).json({ tiene_acceso: false, estado: subData.estado, org_id: empData[0].org_id })
    }
  }

  if (acceso?.tiene_acceso) {
    const esLogin = req.query.login === 'true'
    if (esLogin) {
      central.rpc('incrementar_sesion', { p_org_id: acceso.ret_org_id, p_app_id: APP_ID }).then(({ error }) => {
        if (error) console.error('[verificar-acceso] incrementar_sesion error:', error)
      })
    } else {
      central.from('suscripciones_apps')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('app_id', APP_ID).eq('org_id', acceso.ret_org_id)
        .then(({ error }) => { if (error) console.error('[verificar-acceso] ultimo_acceso error:', error) })
    }
    await syncTenantAccess(supaLocal, acceso.ret_org_id, acceso.plan, acceso.dias_restantes)
  }

  res.setHeader('Cache-Control', 'private, max-age=120')
  return res.status(200).json(acceso)
}
