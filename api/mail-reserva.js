import { createClient } from '@supabase/supabase-js'
import { reportarError } from './reportarError.js'

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  const allowed = process.env.APP_ORIGIN || 'https://eventos.solucionesmdp.com.ar'
  if (origin === allowed || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'no_auth' })

  const supabaseApp = createClient(
    process.env.VITE_SUPA_URL,
    process.env.VITE_SUPA_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await supabaseApp.auth.getUser()
  if (userErr || !user?.email) return res.status(401).json({ error: 'no_auth' })

  const {
    clienteEmail, clienteNombre,
    negocioNombre, negocioLogo, negocioTelefono,
    espacioNombre, fecha, turnoNombre, horaInicio, horaFin,
    cantInvitados, tipoEvento, montoPactado, sena, saldo, metodoPago, notas,
    condiciones,
  } = req.body;

  if (!clienteEmail) return res.status(400).json({ error: 'Sin email' });

  const esc = (s) => typeof s === 'string' ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : s

  const fmtFecha = (f) => {
    if (!f) return '';
    const [y, m, d] = f.split('-');
    const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${parseInt(d)} de ${MESES[parseInt(m)-1]} de ${y}`;
  };

  const fmtMonto = (n) =>
    n != null ? `$${Number(n).toLocaleString('es-AR')}` : '—';

  const horario = horaInicio && horaFin
    ? `${esc(horaInicio)} a ${esc(horaFin)}`
    : esc(turnoNombre) || '—';

  const safeNombre = esc(clienteNombre)
  const safeNegocio = esc(negocioNombre)
  const safeEspacio = esc(espacioNombre)
  const safeTelefono = esc(negocioTelefono)
  const safeNotas = esc(notas)

  const logoHtml = negocioLogo
    ? `<img src="${esc(negocioLogo)}" alt="${safeNegocio}" style="max-height:60px;max-width:160px;object-fit:contain;margin-bottom:8px;" />`
    : `<div style="font-size:32px;margin-bottom:6px;">🏟️</div>`;

  const row = (label, value) => value
    ? `<tr>
        <td style="padding:10px 16px;font-size:13px;color:#8B7355;font-weight:600;width:40%;border-bottom:1px solid #EDE0D0;">${label}</td>
        <td style="padding:10px 16px;font-size:14px;color:#1C1C1E;font-weight:700;border-bottom:1px solid #EDE0D0;">${value}</td>
      </tr>`
    : '';

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#3D2B1F,#5C3317);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
        ${logoHtml}
        <div style="color:#fff;font-size:20px;font-weight:800;">${safeNegocio || 'App Eventos'}</div>
        ${safeTelefono ? `<div style="color:#EDE0D0;font-size:13px;margin-top:4px;">📞 ${safeTelefono}</div>` : ''}
      </div>

      <!-- Body -->
      <div style="background:#fff;padding:36px 40px;border:1px solid #EDE0D0;border-top:none;border-radius:0 0 12px 12px;">

        <!-- Título -->
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:40px;margin-bottom:10px;">✅</div>
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#1C1C1E;">¡Tu reserva fue confirmada!</h1>
          <p style="margin:8px 0 0;color:#8B7355;font-size:14px;">Hola <strong>${safeNombre}</strong>, ya tenés tu lugar reservado.</p>
        </div>

        <!-- Datos de la reserva -->
        <div style="background:#FDF8F3;border:1px solid #EDE0D0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <div style="background:#C4602B;padding:10px 16px;">
            <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:.5px;">DETALLE DE TU RESERVA</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${row('📅 Fecha', fmtFecha(fecha))}
            ${row('🕐 Horario', horario)}
            ${row('🏟️ Espacio', safeEspacio)}
            ${row('🎉 Tipo de evento', tipoEvento ? esc(tipoEvento) : null)}
            ${row('👥 Participantes', cantInvitados ? `Hasta ${esc(cantInvitados)} personas` : null)}
            ${row('💰 Total del evento', fmtMonto(montoPactado))}
            ${row('✅ Seña abonada', sena > 0 ? fmtMonto(sena) + (metodoPago ? ` <span style="color:#8B7355;font-weight:400;font-size:12px;">(${esc(metodoPago)})</span>` : '') : null)}
            ${row('⏳ Saldo restante', saldo > 0 ? `<span style="color:#C4602B;">${fmtMonto(saldo)}</span>` : saldo === 0 ? '<span style="color:#16A34A;">Pagado ✓</span>' : null)}
            ${safeNotas ? row('📝 Notas', `<span style="font-weight:400;color:#5C4033;">${safeNotas}</span>`) : ''}
          </table>
        </div>

        <!-- Aviso saldo -->
        ${saldo > 0 ? `
        <div style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#6D4C00;">
          💡 Recordá abonar el saldo de <strong>${fmtMonto(saldo)}</strong> el día del evento.
        </div>` : ''}

        <!-- Condiciones (solo si el negocio las configuró) -->
        ${condiciones ? `
        <div style="border:1px solid #EDE0D0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <div style="background:#3D2B1F;padding:12px 20px;">
            <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:.5px;">📋 NORMAS Y CONDICIONES DEL ALQUILER</span>
          </div>
          <div style="padding:16px 20px;background:#fff;font-size:13px;color:#3D2B1F;line-height:1.8;white-space:pre-line;">
            ${esc(condiciones)}
          </div>
        </div>` : ''}

        <hr style="border:none;border-top:1px solid #EDE0D0;margin:0 0 20px;" />
        <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
          ¿Tenés alguna consulta? Escribinos por WhatsApp${safeTelefono ? ` al ${safeTelefono}` : ''}.<br/>
          <strong style="color:#8B7355;">${safeNegocio || 'App Eventos'} · Soluciones MDP</strong>
        </p>
      </div>
    </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.MAIL_RESERVAS_FROM ?? 'reservas-eventos@solucionesmdp.com.ar',
        to: clienteEmail,
        subject: `✅ Reserva confirmada — ${safeNegocio || 'App Eventos'} · ${fmtFecha(fecha)}`,
        html,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[mail-reserva] Resend error:', err);
      reportarError(new Error(err), { pantalla: 'mail-reserva', accion: 'resend_api', user_email: clienteEmail })
      return res.status(500).json({ error: err });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[mail-reserva] catch:', e.message);
    reportarError(e, { pantalla: 'mail-reserva', accion: 'send_email', user_email: clienteEmail })
    return res.status(500).json({ error: e.message });
  }
}
