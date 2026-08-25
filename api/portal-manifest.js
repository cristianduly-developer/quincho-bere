import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const tkn = req.query.token
  if (!tkn || tkn.length < 8) return res.status(400).json({ error: 'token required' })

  const supa = createClient(process.env.VITE_SUPABASE_URL || process.env.VITE_SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  let reserva
  const r1 = await supa.from('reservas').select('nombre_evento, tipo_evento, edit_token').eq('edit_token', tkn).single()
  if (r1.data) { reserva = r1.data }
  else {
    const r2 = await supa.from('reservas').select('nombre_evento, tipo_evento, edit_token').eq('share_token', tkn).single()
    reserva = r2.data
  }
  if (!reserva) return res.status(404).json({ error: 'not_found' })

  const tipo = (reserva.tipo_evento || '').toLowerCase()
  let emoji = '🎉'
  if (tipo.includes('cumple') || tipo.includes('birthday')) emoji = '🎂'
  else if (tipo.includes('casamiento') || tipo.includes('boda')) emoji = '💍'
  else if (tipo.includes('bautismo')) emoji = '👼'
  else if (tipo.includes('infantil') || tipo.includes('nene') || tipo.includes('nena')) emoji = '🎈'
  else if (tipo.includes('empresa') || tipo.includes('corporate') || tipo.includes('after')) emoji = '🏢'
  else if (tipo.includes('navidad')) emoji = '🎄'
  else if (tipo.includes('año nuevo')) emoji = '🥂'
  else if (tipo.includes('despedida')) emoji = '💃'
  else if (tipo.includes('egresado') || tipo.includes('graduacion')) emoji = '🎓'
  else if (tipo.includes('reunion') || tipo.includes('juntada')) emoji = '🍻'

  const appName = reserva.nombre_evento || 'Mi Evento'
  const startToken = reserva.edit_token || tkn

  const manifest = {
    name: emoji + ' ' + appName,
    short_name: appName.length > 20 ? appName.slice(0, 18) + '…' : appName,
    start_url: '/mi-evento/' + startToken,
    display: 'standalone',
    background_color: '#F6F2EC',
    theme_color: '#C4602B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  }

  res.setHeader('Content-Type', 'application/manifest+json')
  res.setHeader('Cache-Control', 'no-cache')
  return res.status(200).json(manifest)
}
