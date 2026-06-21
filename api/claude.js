import { createClient } from '@supabase/supabase-js'

const LIMIT_POR_MINUTO = 10
const LIMIT_POR_DIA    = 80
const LIMIT_POR_MES    = 800

const central = createClient(
  process.env.CENTRAL_URL,
  process.env.CENTRAL_SERVICE_KEY,
)

async function checkRateLimit(key, max, windowSec) {
  try {
    const { data } = await central.rpc('check_rate_limit', {
      p_key: key, p_max: max, p_window_seconds: windowSec,
    })
    return data === true // true = bloqueado
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verificar token del usuario
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'no_auth' })

  const supabaseApp = createClient(
    process.env.VITE_SUPA_URL,
    process.env.VITE_SUPA_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await supabaseApp.auth.getUser()
  if (userErr || !user?.email) return res.status(401).json({ error: 'no_auth' })

  const email = user.email.toLowerCase()

  // Rate limits: por minuto, día y mes
  const bloqueadoMin = await checkRateLimit(`claude:min:${email}`, LIMIT_POR_MINUTO, 60)
  if (bloqueadoMin) return res.status(429).json({ error: 'limite_por_minuto', retry_after: 60 })

  const bloqueadoDia = await checkRateLimit(`claude:dia:${email}`, LIMIT_POR_DIA, 86400)
  if (bloqueadoDia) return res.status(429).json({ error: 'limite_por_dia', retry_after: 3600 })

  const bloqueadoMes = await checkRateLimit(`claude:mes:${email}`, LIMIT_POR_MES, 2592000)
  if (bloqueadoMes) return res.status(429).json({ error: 'limite_por_mes', retry_after: 86400 })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
