export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    clienteEmail, clienteNombre,
    negocioNombre, negocioLogo, negocioTelefono,
    espacioNombre, fecha, turnoNombre, horaInicio, horaFin,
    cantInvitados, montoPactado, sena, saldo, metodoPago, notas,
  } = req.body;

  if (!clienteEmail) return res.status(400).json({ error: 'Sin email' });

  const fmtFecha = (f) => {
    if (!f) return '';
    const [y, m, d] = f.split('-');
    const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${parseInt(d)} de ${MESES[parseInt(m)-1]} de ${y}`;
  };

  const fmtMonto = (n) =>
    n != null ? `$${Number(n).toLocaleString('es-AR')}` : '—';

  const horario = horaInicio && horaFin
    ? `${horaInicio} a ${horaFin}`
    : turnoNombre || '—';

  const logoHtml = negocioLogo
    ? `<img src="${negocioLogo}" alt="${negocioNombre}" style="max-height:60px;max-width:160px;object-fit:contain;margin-bottom:8px;" />`
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
        <div style="color:#fff;font-size:20px;font-weight:800;">${negocioNombre || 'App Eventos'}</div>
        ${negocioTelefono ? `<div style="color:#EDE0D0;font-size:13px;margin-top:4px;">📞 ${negocioTelefono}</div>` : ''}
      </div>

      <!-- Body -->
      <div style="background:#fff;padding:36px 40px;border:1px solid #EDE0D0;border-top:none;border-radius:0 0 12px 12px;">

        <!-- Título -->
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:40px;margin-bottom:10px;">✅</div>
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#1C1C1E;">¡Tu reserva fue confirmada!</h1>
          <p style="margin:8px 0 0;color:#8B7355;font-size:14px;">Hola <strong>${clienteNombre}</strong>, ya tenés tu lugar reservado.</p>
        </div>

        <!-- Datos de la reserva -->
        <div style="background:#FDF8F3;border:1px solid #EDE0D0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <div style="background:#C4602B;padding:10px 16px;">
            <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:.5px;">DETALLE DE TU RESERVA</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${row('📅 Fecha', fmtFecha(fecha))}
            ${row('🕐 Horario', horario)}
            ${row('🏟️ Espacio', espacioNombre)}
            ${row('👥 Participantes', cantInvitados ? `Hasta ${cantInvitados} personas` : null)}
            ${row('💰 Total del evento', fmtMonto(montoPactado))}
            ${row('✅ Seña abonada', sena > 0 ? fmtMonto(sena) + (metodoPago ? ` <span style="color:#8B7355;font-weight:400;font-size:12px;">(${metodoPago})</span>` : '') : null)}
            ${row('⏳ Saldo restante', saldo > 0 ? `<span style="color:#C4602B;">${fmtMonto(saldo)}</span>` : saldo === 0 ? '<span style="color:#16A34A;">Pagado ✓</span>' : null)}
            ${notas ? row('📝 Notas', `<span style="font-weight:400;color:#5C4033;">${notas}</span>`) : ''}
          </table>
        </div>

        <!-- Aviso saldo -->
        ${saldo > 0 ? `
        <div style="background:#FFF8E1;border:1px solid #FFD54F;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#6D4C00;">
          💡 Recordá abonar el saldo de <strong>${fmtMonto(saldo)}</strong> el día del evento.
        </div>` : ''}

        <!-- Condiciones -->
        <div style="border:1px solid #EDE0D0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <div style="background:#3D2B1F;padding:12px 20px;">
            <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:.5px;">📋 NORMAS Y CONDICIONES DEL ALQUILER</span>
          </div>
          <div style="padding:16px 20px;background:#fff;">

            <div style="margin-bottom:14px;">
              <div style="font-size:12px;font-weight:700;color:#C4602B;margin-bottom:5px;">💰 DEPÓSITOS Y PAGOS</div>
              <ul style="margin:0;padding-left:18px;font-size:13px;color:#3D2B1F;line-height:1.8;">
                <li>Depósito de garantía: <strong>$50.000</strong> (reintegrable al finalizar el evento)</li>
                <li>Seña: no reembolsable. Reprogramación por clima adverso sujeto a fechas disponibles</li>
              </ul>
            </div>

            <div style="margin-bottom:14px;">
              <div style="font-size:12px;font-weight:700;color:#C4602B;margin-bottom:5px;">🧹 ORDEN Y LIMPIEZA</div>
              <ul style="margin:0;padding-left:18px;font-size:13px;color:#3D2B1F;line-height:1.8;">
                <li>Limpieza opcional: <strong>$30.000</strong></li>
                <li>Entregar el espacio ordenado: recolección de residuos, lavar vajilla y reacomodar mobiliario</li>
              </ul>
            </div>

            <div style="margin-bottom:14px;">
              <div style="font-size:12px;font-weight:700;color:#C4602B;margin-bottom:5px;">🚫 CONDICIONES DE USO DEL ESPACIO</div>
              <ul style="margin:0;padding-left:18px;font-size:13px;color:#3D2B1F;line-height:1.8;">
                <li>Música: volumen moderado. Sin DJs ni bandas</li>
                <li>Puerta cerrada en todo momento</li>
                <li>No ingresar vehículos al predio</li>
                <li>Sin pirotecnia ni mascotas</li>
                <li>Prohibido globos con confeti, papel picado, bombuchas o inflables con agua</li>
                <li>Piscina: responsabilidad del contratante</li>
              </ul>
            </div>

            <div>
              <div style="font-size:12px;font-weight:700;color:#C4602B;margin-bottom:5px;">🕐 HORARIOS</div>
              <ul style="margin:0;padding-left:18px;font-size:13px;color:#3D2B1F;line-height:1.8;">
                <li>Cumplir horarios de ingreso y egreso</li>
                <li>Decorar y limpiar dentro del turno</li>
                <li>Máxima tolerancia 15 minutos al finalizar</li>
              </ul>
            </div>

          </div>
          <div style="background:#FDF8F3;border-top:1px solid #EDE0D0;padding:10px 20px;text-align:center;font-size:12px;color:#8B7355;font-style:italic;">
            El respeto por estas pautas nos permite cuidar el espacio y brindar un mejor servicio para todos.
          </div>
        </div>

        <hr style="border:none;border-top:1px solid #EDE0D0;margin:0 0 20px;" />
        <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
          ¿Tenés alguna consulta? Escribinos por WhatsApp${negocioTelefono ? ` al ${negocioTelefono}` : ''}.<br/>
          <strong style="color:#8B7355;">${negocioNombre || 'App Eventos'} · Soluciones MDP</strong>
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
        subject: `✅ Reserva confirmada — ${negocioNombre || 'App Eventos'} · ${fmtFecha(fecha)}`,
        html,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[mail-reserva] Resend error:', err);
      return res.status(500).json({ error: err });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[mail-reserva] catch:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
