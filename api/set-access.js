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

  const supa = createClient(process.env.VITE_SUPABASE_URL || process.env.VITE_SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const action = req.query.action

  // ═══════════════════════════════════════════════════════
  // Portal del cliente (público, validado por share_token)
  // ═══════════════════════════════════════════════════════
  if (action && action.startsWith('portal-')) {
    const tkn = req.body?.token
    if (!tkn || typeof tkn !== 'string' || tkn.length < 8) {
      return res.status(400).json({ ok: false, error: 'token required' })
    }

    // ── portal-data: devuelve toda la info del portal ──
    if (action === 'portal-data') {
      const editMode = req.body?.edit_mode === true
      const selectCols = 'id, org_id, cliente_id, fecha, horario, horario_fin, turno, cant_invitados, monto_pactado, estado, tipo_evento, nombre_evento, share_token, edit_token, share_sections, share_message, share_theme, share_hero_url, regalo_descuento, regalo_enviado_en, sobre_digital, mercado_activo'
      let reserva, rErr
      if (editMode) {
        const r1 = await supa.from('reservas').select(selectCols).eq('edit_token', tkn).single()
        if (r1.data) { reserva = r1.data; rErr = null }
        else {
          const r2 = await supa.from('reservas').select(selectCols).eq('share_token', tkn).single()
          reserva = r2.data; rErr = r2.error
        }
      } else {
        const r0 = await supa.from('reservas').select(selectCols).eq('share_token', tkn).single()
        reserva = r0.data; rErr = r0.error
      }

      if (rErr || !reserva) return res.status(404).json({ ok: false, error: 'not_found' })

      const [configRes, rsvpRes, fotosRes, pagosRes, serviciosRes, extrasRes, clienteRes, mercadoRes] = await Promise.all([
        supa.from('config').select('nombre_negocio, logo_url, telefono, direccion, wifi_password, google_review_url, condiciones_email, instagram_url').eq('org_id', reserva.org_id).single(),
        supa.from('evento_rsvp').select('nombre, cantidad, estado, creado_en').eq('reserva_id', reserva.id).order('creado_en'),
        supa.from('evento_fotos').select('url, creado_en').eq('reserva_id', reserva.id).order('creado_en'),
        supa.from('pagos').select('monto, fecha, metodo').eq('reserva_id', reserva.id).order('fecha'),
        supa.from('servicios_extras').select('id, descripcion, precio_actual, detalle, foto_url, grupo').eq('org_id', reserva.org_id).eq('activo', true),
        supa.from('extras_reserva').select('id, servicio_id, descripcion, cantidad, precio_historico').eq('reserva_id', reserva.id),
        supa.from('clientes').select('nombre, apellido').eq('id', reserva.cliente_id).single(),
        reserva.mercado_activo ? supa.from('mercado_productos').select('id, nombre, emoji, precio').eq('org_id', reserva.org_id).eq('activo', true).order('orden') : { data: [] },
      ])

      const pagos = pagosRes.data || []
      const extrasData = extrasRes.data || []
      const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
      const totalExtras = extrasData.reduce((s, e) => s + (Number(e.precio_historico) * e.cantidad), 0)
      const montoBase = Number(reserva.monto_pactado) || 0

      return res.json({
        id: reserva.id,
        reserva: {
          fecha: reserva.fecha,
          horario: reserva.horario,
          horario_fin: reserva.horario_fin,
          turno: reserva.turno,
          cant_invitados: reserva.cant_invitados,
          monto_pactado: montoBase,
          estado: reserva.estado,
          tipo_evento: reserva.tipo_evento,
          nombre_evento: reserva.nombre_evento,
          share_token: reserva.share_token || null,
          share_sections: reserva.share_sections,
          share_message: reserva.share_message || '',
          share_theme: reserva.share_theme || 'verde',
          share_hero_url: reserva.share_hero_url,
          regalo_descuento: reserva.regalo_descuento || null,
          regalo_enviado_en: reserva.regalo_enviado_en || null,
          sobre_digital: reserva.sobre_digital || null,
          mercado_activo: !!reserva.mercado_activo,
        },
        negocio: configRes.data || {},
        cliente: clienteRes.data || {},
        rsvp: rsvpRes.data || [],
        fotos: fotosRes.data || [],
        pagos: {
          total: montoBase + totalExtras,
          pagado: totalPagado,
          saldo: Math.max(0, montoBase + totalExtras - totalPagado),
          detalle: pagos.map(p => ({ monto: Number(p.monto), fecha: p.fecha, metodo: p.metodo }))
        },
        servicios: (serviciosRes.data || []).map(s => ({ id: s.id, descripcion: s.descripcion, precio: Number(s.precio_actual), detalle: s.detalle || '', foto_url: s.foto_url || '', grupo: s.grupo || '' })),
        extras: extrasData.map(e => ({ id: e.id, descripcion: e.descripcion, cantidad: e.cantidad, precio: Number(e.precio_historico) })),
        mercado: (mercadoRes.data || []).map(m => ({ id: m.id, nombre: m.nombre, emoji: m.emoji, precio: Number(m.precio) })),
      })
    }

    // ── portal-save: guarda config del evento compartido ──
    if (action === 'portal-save') {
      const editSave = req.body?.edit_mode === true
      let reserva
      if (editSave) {
        const r1 = await supa.from('reservas').select('id').eq('edit_token', tkn).single()
        if (r1.data) { reserva = r1.data }
        else { const r2 = await supa.from('reservas').select('id').eq('share_token', tkn).single(); reserva = r2.data }
      } else {
        const r0 = await supa.from('reservas').select('id').eq('share_token', tkn).single()
        reserva = r0.data
      }
      if (!reserva) return res.status(404).json({ ok: false, error: 'not_found' })

      const b = req.body
      const update = {}
      if (b.share_sections !== undefined) update.share_sections = b.share_sections
      if (b.share_message !== undefined) update.share_message = (b.share_message || '').slice(0, 300)
      if (b.share_theme !== undefined) update.share_theme = b.share_theme
      if (b.share_hero_url !== undefined) update.share_hero_url = b.share_hero_url || null
      if (b.nombre_evento !== undefined) update.nombre_evento = (b.nombre_evento || '').slice(0, 100)
      if (b.sobre_digital !== undefined) update.sobre_digital = b.sobre_digital

      if (!Object.keys(update).length) return res.json({ ok: true })

      const { error } = await supa.from('reservas').update(update).eq('id', reserva.id)
      if (error) return res.status(500).json({ ok: false, error: error.message })
      return res.json({ ok: true })
    }

    // ── portal-request-extra: solicita un extra ──
    if (action === 'portal-request-extra') {
      const { servicio_id, notas } = req.body
      if (!servicio_id) return res.status(400).json({ ok: false, error: 'servicio_id required' })

      const editExtra = req.body?.edit_mode === true
      let reserva
      if (editExtra) {
        const r1 = await supa.from('reservas').select('id, org_id, fecha, cliente_id, regalo_descuento').eq('edit_token', tkn).single()
        if (r1.data) { reserva = r1.data }
        else { const r2 = await supa.from('reservas').select('id, org_id, fecha, cliente_id, regalo_descuento').eq('share_token', tkn).single(); reserva = r2.data }
      } else {
        const r0 = await supa.from('reservas').select('id, org_id, fecha, cliente_id, regalo_descuento').eq('share_token', tkn).single()
        reserva = r0.data
      }
      if (!reserva) return res.status(404).json({ ok: false, error: 'not_found' })

      const [srvRes, cliRes] = await Promise.all([
        supa.from('servicios_extras').select('descripcion').eq('id', servicio_id).single(),
        supa.from('clientes').select('nombre, apellido, whatsapp').eq('id', reserva.cliente_id).single(),
      ])

      const cliNombre = [cliRes.data?.nombre, cliRes.data?.apellido].filter(Boolean).join(' ') || 'Cliente'
      const cliWhatsapp = cliRes.data?.whatsapp || ''
      const srvNombre = srvRes.data?.descripcion || 'Servicio'
      const regaloTag = reserva.regalo_descuento ? ` 🎁 ${reserva.regalo_descuento}` : ''
      const waTag = cliWhatsapp ? ` 📱${cliWhatsapp}` : ''
      const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

      await supa.from('tareas').insert({
        id: taskId,
        org_id: reserva.org_id,
        descripcion: `📦 Solicitud: ${srvNombre} — ${cliNombre} (${reserva.fecha})${regaloTag}${waTag}${notas ? ' · ' + notas : ''}`,
        estado: 'pendiente',
        fecha_registro: new Date().toISOString().slice(0, 10),
        creado_en: new Date().toISOString()
      })

      return res.json({ ok: true })
    }

    // ── portal-pedido: crea un pedido del mercado ──
    if (action === 'portal-pedido') {
      const { producto_id, producto_nombre, producto_emoji, cantidad, precio_unitario } = req.body || {}
      if (!producto_nombre || !precio_unitario) return res.status(400).json({ ok: false, error: 'missing fields' })

      const editPed = req.body?.edit_mode === true
      let reserva
      if (editPed) {
        const r1 = await supa.from('reservas').select('id, org_id, cliente_id, fecha, mercado_activo').eq('edit_token', tkn).single()
        if (r1.data) { reserva = r1.data }
        else { const r2 = await supa.from('reservas').select('id, org_id, cliente_id, fecha, mercado_activo').eq('share_token', tkn).single(); reserva = r2.data }
      } else {
        const r0 = await supa.from('reservas').select('id, org_id, cliente_id, fecha, mercado_activo').eq('share_token', tkn).single()
        reserva = r0.data
      }
      if (!reserva) return res.status(404).json({ ok: false, error: 'not_found' })
      if (!reserva.mercado_activo) return res.status(400).json({ ok: false, error: 'mercado_closed' })

      const cant = Math.max(1, Number(cantidad) || 1)
      const precio = Number(precio_unitario) || 0
      const total = cant * precio
      const pedidoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
      const extraId = 'mkt-' + pedidoId

      const [pedidoRes, extraRes] = await Promise.all([
        supa.from('mercado_pedidos').insert({
          id: pedidoId,
          org_id: reserva.org_id,
          reserva_id: reserva.id,
          producto_nombre,
          producto_emoji: producto_emoji || '📦',
          cantidad: cant,
          precio_unitario: precio,
          total,
          estado: 'pendiente',
        }),
        supa.from('extras_reserva').insert({
          id: extraId,
          org_id: reserva.org_id,
          reserva_id: reserva.id,
          servicio_id: null,
          descripcion: `🛒 ${producto_emoji || '📦'} ${producto_nombre}`,
          cantidad: cant,
          precio_historico: precio,
        }),
      ])

      if (pedidoRes.error) return res.status(500).json({ ok: false, error: pedidoRes.error.message })

      const [cliRes, cfgRes] = await Promise.all([
        supa.from('clientes').select('nombre, apellido').eq('id', reserva.cliente_id).single(),
        supa.from('config').select('telefono').eq('org_id', reserva.org_id).single(),
      ])
      const cliNombre = [cliRes.data?.nombre, cliRes.data?.apellido].filter(Boolean).join(' ') || 'Cliente'
      const ownerPhone = (cfgRes.data?.telefono || '').replace(/[\s-]/g, '')

      let waLink = null
      if (ownerPhone) {
        const msg = `🛒 *Nuevo pedido del Mercado*\n\n${producto_emoji || '📦'} *${producto_nombre}* x${cant}\n💰 Total: $${total.toLocaleString('es-AR')}\n👤 ${cliNombre}\n📅 Evento: ${reserva.fecha}\n\n_Pedido registrado automáticamente como extra en la reserva._`
        waLink = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(msg)}`
      }

      return res.json({ ok: true, pedido_id: pedidoId, wa_link: waLink })
    }

    // ── portal-track: registra evento de analytics ──
    if (action === 'portal-track') {
      const evento = req.body?.evento
      if (!evento || typeof evento !== 'string') return res.status(400).json({ ok: false, error: 'evento required' })

      const editTrack = req.body?.edit_mode === true
      let reserva
      if (editTrack) {
        const r1 = await supa.from('reservas').select('id, org_id').eq('edit_token', tkn).single()
        if (r1.data) { reserva = r1.data }
        else { const r2 = await supa.from('reservas').select('id, org_id').eq('share_token', tkn).single(); reserva = r2.data }
      } else {
        const r0 = await supa.from('reservas').select('id, org_id').eq('share_token', tkn).single()
        reserva = r0.data
      }
      if (!reserva) return res.status(404).json({ ok: false, error: 'not_found' })

      const evtId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
      await supa.from('portal_eventos').insert({ id: evtId, org_id: reserva.org_id, reserva_id: reserva.id, evento })
      return res.json({ ok: true })
    }

    return res.status(400).json({ ok: false, error: 'unknown portal action' })
  }

  // ═══════════════════════════════════════════════════════
  // Acciones admin (requieren x-app-key)
  // ═══════════════════════════════════════════════════════
  const appKey = req.headers['x-app-key']
  if (!process.env.ERROR_REPORT_KEY || appKey !== process.env.ERROR_REPORT_KEY) {
    return res.status(401).json({ ok: false, error: 'no_auth' })
  }

  // ── evento-cleanup: limpia eventos compartidos expirados (+10 días) ──
  if (action === 'evento-cleanup') {
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
      await supa.from('portal_eventos').delete().eq('reserva_id', r.id)
      await supa.from('reservas').update({ share_token: null, edit_token: null, share_sections: null, share_message: null, share_hero_url: null, sobre_digital: null }).eq('id', r.id)
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
