import { useMemo } from "react";
import { clientName, fmtDate, fmtCurrency, getSaldo } from "../lib/utils.js";
import { TURNOS } from "../lib/constants.js";

const STORAGE_KEY = "quincho_briefing_date";
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_FULL = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

export function shouldShowBriefing() {
  const hora = new Date().getHours();
  if (hora < 7) return false; // no mostrar antes de las 7am
  const last = localStorage.getItem(STORAGE_KEY);
  return last !== toISO(new Date());
}

export function markBriefingShown() {
  localStorage.setItem(STORAGE_KEY, toISO(new Date()));
}

function generarAlertas({ reservas, clientes, pagos, extrasReserva, recursos, servicios, turnosRecurso }) {
  const ACTIVAS = ["pendiente","senada","confirmada"];
  const hoy = toISO(new Date());

  // Próximos 7 días
  const dias7 = Array.from({length:7}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate()+i); d.setHours(0,0,0,0); return d;
  });
  const dias7ISO = dias7.map(toISO);

  const eventosSemana = reservas.filter(r => dias7ISO.includes(r.fecha) && ACTIVAS.includes(r.estado));
  const eventosHoy = eventosSemana.filter(r => r.fecha === hoy);

  // Extras en uso esta semana
  const extrasEnUso = {};
  eventosSemana.forEach(r => {
    extrasReserva.filter(e => e.reservaId === r.id).forEach(e => {
      const nombre = e.descripcion || servicios?.find(s=>s.id===e.servicioId)?.nombre || "Extra";
      extrasEnUso[nombre] = (extrasEnUso[nombre]||0) + 1;
    });
  });

  // Días con múltiples eventos
  const porDia = {};
  eventosSemana.forEach(r => { porDia[r.fecha] = (porDia[r.fecha]||[]).concat(r); });

  // Días libres próximos 7 días
  const diasLibres = dias7.filter(d => {
    const iso = toISO(d);
    return iso > hoy && !porDia[iso];
  });

  // Saldos pendientes en eventos próximos 3 días
  const dias3ISO = dias7ISO.slice(0, 3);
  const conSaldo = reservas.filter(r => {
    if (!dias3ISO.includes(r.fecha) || !ACTIVAS.includes(r.estado)) return false;
    return getSaldo(r, extrasReserva, pagos) > 0;
  });

  // Sin confirmar esta semana
  const sinConfirmar = eventosSemana.filter(r => r.estado === "pendiente" || r.estado === "senada");

  const alertasHoy = [];
  const alertasSemana = [];
  const oportunidades = [];

  // ── HOY ──
  if (eventosHoy.length === 0) {
    alertasHoy.push({ icon:"😴", texto:"Hoy no tenés eventos. Buen día para mantenimiento o promo." });
  } else if (eventosHoy.length >= 2) {
    const turnos = eventosHoy.map(r => {
      const t = turnosRecurso?.find(x=>x.id===r.turnoId);
      return t ? `${t.nombre} (${t.horaInicio}–${t.horaFin})` : (TURNOS[r.turno]?.label||"");
    }).filter(Boolean).join(" → ");
    alertasHoy.push({ icon:"⚡", texto:`Doble evento hoy — ${turnos}. Coordiná limpieza y operativo entre turnos.`, urgente:true });
  } else {
    const r = eventosHoy[0];
    const c = clientes.find(x=>x.id===r.clienteId);
    const t = turnosRecurso?.find(x=>x.id===r.turnoId);
    const turnoLabel = t ? `${t.nombre} ${t.horaInicio}–${t.horaFin}` : (TURNOS[r.turno]?.label||"");
    alertasHoy.push({ icon:"🎉", texto:`Hoy: ${clientName(c)}${turnoLabel?` · ${turnoLabel}`:""}${r.cantInvitados>0?` · ${r.cantInvitados} personas`:""}` });
  }

  const extrasHoy = {};
  eventosHoy.forEach(r => {
    extrasReserva.filter(e=>e.reservaId===r.id).forEach(e => {
      const nombre = e.descripcion || servicios?.find(s=>s.id===e.servicioId)?.nombre || "Extra";
      extrasHoy[nombre] = (extrasHoy[nombre]||0)+1;
    });
  });
  if (Object.keys(extrasHoy).length > 0) {
    const lista = Object.entries(extrasHoy).map(([n,c])=>c>1?`${n} ×${c}`:n).join(" · ");
    alertasHoy.push({ icon:"📦", texto:`Extras de hoy: ${lista}. Verificá que estén listos.` });
  }

  conSaldo.filter(r=>r.fecha===hoy).forEach(r => {
    const c = clientes.find(x=>x.id===r.clienteId);
    const s = getSaldo(r, extrasReserva, pagos);
    alertasHoy.push({ icon:"💰", texto:`${clientName(c)} tiene saldo pendiente de ${fmtCurrency(s)} — evento hoy.`, urgente:true });
  });

  // ── SEMANA ──
  Object.entries(porDia).filter(([d]) => d !== hoy && d > hoy).forEach(([d, items]) => {
    if (items.length >= 2) {
      const dow = new Date(d+"T12:00:00").getDay();
      alertasSemana.push({ icon:"⚠️", texto:`El ${DIAS_FULL[dow]} hay ${items.length} eventos — tiempo reducido entre turnos. Organizá limpieza con tiempo.`, urgente:true });
    }
  });

  if (Object.keys(extrasEnUso).length > 0) {
    const masUsado = Object.entries(extrasEnUso).sort((a,b)=>b[1]-a[1]);
    masUsado.slice(0,3).forEach(([nombre, cant]) => {
      if (cant >= 2)
        alertasSemana.push({ icon:"🔧", texto:`"${nombre}" se usa ${cant} veces esta semana. Asegurate de tenerlo disponible.` });
    });
  }

  if (sinConfirmar.length > 0) {
    alertasSemana.push({ icon:"📋", texto:`Tenés ${sinConfirmar.length} reserva${sinConfirmar.length!==1?"s":""} sin confirmar esta semana. Revisalas.` });
  }

  conSaldo.filter(r=>r.fecha!==hoy).forEach(r => {
    const c = clientes.find(x=>x.id===r.clienteId);
    const s = getSaldo(r, extrasReserva, pagos);
    const dow = new Date(r.fecha+"T12:00:00").getDay();
    alertasSemana.push({ icon:"💳", texto:`${clientName(c)} tiene saldo de ${fmtCurrency(s)} — evento el ${DIAS_FULL[dow]} ${fmtDate(r.fecha)}.` });
  });

  // ── MAÑANA: alertas de preparación ──
  const manana = toISO(dias7[1]);
  const eventosManana = reservas.filter(r => r.fecha === manana && ACTIVAS.includes(r.estado));
  if (eventosManana.length > 0) {
    const extrasManana = {};
    eventosManana.forEach(r => {
      extrasReserva.filter(e=>e.reservaId===r.id).forEach(e => {
        const nombre = e.descripcion || servicios?.find(s=>s.id===e.servicioId)?.nombre || "Extra";
        extrasManana[nombre] = (extrasManana[nombre]||0)+1;
      });
    });
    if (Object.keys(extrasManana).length > 0) {
      const lista = Object.entries(extrasManana).map(([n,c])=>c>1?`${n} ×${c}`:n).join(" · ");
      alertasSemana.push({ icon:"📅", texto:`Mañana hay extras: ${lista}. Si necesitás reposición o carga (barril, hielo, etc.) pedila hoy.`, urgente:false });
    }
    if (eventosManana.length >= 2) {
      alertasSemana.push({ icon:"⚡", texto:`Mañana hay ${eventosManana.length} eventos. Preparación doble — tené todo listo hoy.`, urgente:true });
    }
  }

  // ── OPORTUNIDADES ──
  if (diasLibres.length > 0) {
    const libresLabel = diasLibres.map(d => {
      const dow = d.getDay();
      return `${DIAS[dow]} ${d.getDate()}`;
    }).join(", ");
    const esFinde = diasLibres.some(d => d.getDay()===6||d.getDay()===0);
    oportunidades.push({
      icon: esFinde ? "📸" : "📣",
      texto: `${esFinde?"Fin de semana libre":"Días libres"}: ${libresLabel}. Buen momento para publicar disponibilidad en Instagram.`,
      accion: esFinde ? "publicar" : null,
    });
  }

  if (eventosSemana.length >= 4) {
    oportunidades.push({ icon:"📊", texto:`Semana cargada: ${eventosSemana.length} eventos. Confirmá logística de pileta y limpieza.` });
  }

  return { alertasHoy, alertasSemana, oportunidades, totalEventos: eventosSemana.length };
}

function AlertaItem({ icon, texto, urgente }) {
  return (
    <div style={{
      display:"flex", gap:10, alignItems:"flex-start", padding:"10px 12px",
      background: urgente ? "#FFF7ED" : "#FAFAFA",
      borderRadius:10, marginBottom:6,
      border: `1px solid ${urgente?"#FED7AA":"#F0EBE4"}`,
    }}>
      <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{icon}</span>
      <span style={{fontSize:13,color:"#1C1C1E",lineHeight:1.5}}>{texto}</span>
    </div>
  );
}

export default function DailyBriefing({ reservas, clientes, pagos, extrasReserva, recursos, servicios, turnosRecurso, negocio, recordatorios, onClose }) {
  const hoy = new Date();
  const diaLabel = `${DIAS[hoy.getDay()]} ${hoy.getDate()}/${hoy.getMonth()+1}`;
  const hora = hoy.getHours();
  const saludo = hora < 13 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  const { alertasHoy, alertasSemana, oportunidades, totalEventos } = useMemo(() =>
    generarAlertas({ reservas, clientes, pagos, extrasReserva, recursos, servicios, turnosRecurso }),
    [reservas, clientes, pagos, extrasReserva, recursos, servicios, turnosRecurso]
  );

  // Recordatorios manuales de hoy
  const hoyStr = toISO(new Date());
  const recHoy = (recordatorios||[]).filter(r => r.estado === "Pendiente" && r.fechaAlerta === hoyStr)
    .sort((a,b) => (a.horaAlerta||"").localeCompare(b.horaAlerta||""));

  const hayAlgo = alertasHoy.length || alertasSemana.length || oportunidades.length;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,14,8,0.55)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:3000}}>
      <div style={{
        background:"#FFF", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:500,
        maxHeight:"85vh", display:"flex", flexDirection:"column",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.18)",
      }}>
        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 0"}}>
          <div style={{width:36,height:4,borderRadius:2,background:"#EDE0D0"}} />
        </div>

        {/* Header */}
        <div style={{padding:"14px 20px 12px",borderBottom:"0.5px solid #EDE0D0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:11,color:"#8B7355",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>{diaLabel}</div>
              <div style={{fontSize:20,fontWeight:800,color:"#1C1C1E",marginTop:2}}>{saludo} 👋</div>
              <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
                {totalEventos === 0 ? "Sin eventos esta semana" : `${totalEventos} evento${totalEventos!==1?"s":""} esta semana`}
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F3F0EB",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#8B7355"}}>✕</button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div style={{overflowY:"auto",padding:"16px 20px",flex:1}}>
          {!hayAlgo && (
            <div style={{textAlign:"center",padding:"32px 0",color:"#8B7355"}}>
              <div style={{fontSize:40,marginBottom:8}}>✅</div>
              <div style={{fontWeight:600}}>Todo tranquilo por hoy</div>
            </div>
          )}

          {recHoy.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>📌 Tus recordatorios de hoy</div>
              {recHoy.map(r => (
                <AlertaItem key={r.id} icon="📌" texto={`${r.horaAlerta ? r.horaAlerta+"hs · " : ""}${r.tipo}${r.nota ? ": "+r.nota : ""}`} urgente />
              ))}
            </div>
          )}

          {alertasHoy.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#C4602B",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🔴 Hoy</div>
              {alertasHoy.map((a,i) => <AlertaItem key={i} {...a} />)}
            </div>
          )}

          {alertasSemana.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#92400E",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🟡 Esta semana</div>
              {alertasSemana.map((a,i) => <AlertaItem key={i} {...a} />)}
            </div>
          )}

          {oportunidades.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#16A34A",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🟢 Oportunidades</div>
              {oportunidades.map((a,i) => <AlertaItem key={i} {...a} />)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 20px 28px",borderTop:"0.5px solid #EDE0D0"}}>
          <button onClick={onClose} style={{
            width:"100%",padding:"13px",background:"#C4602B",color:"#FFF",border:"none",
            borderRadius:12,fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"inherit",
          }}>Entendido ✓</button>
        </div>
      </div>
    </div>
  );
}
