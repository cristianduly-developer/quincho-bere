import { useMemo, useState, useEffect } from "react";
import { clientName, fmtDate, fmtCurrency, getSaldo } from "../lib/utils.js";
import { TURNOS } from "../lib/constants.js";

const STORAGE_KEY = "quincho_briefing_date";
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_FULL = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function weatherIcon(code) {
  if (code <= 1) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌧️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  if (code <= 99) return "⛈️";
  return "🌤️";
}

function weatherLabel(code) {
  if (code <= 1) return "Despejado";
  if (code <= 3) return "Parcialmente nublado";
  if (code <= 48) return "Nublado";
  if (code <= 57) return "Llovizna";
  if (code <= 67) return "Lluvia";
  if (code <= 77) return "Nieve";
  if (code <= 82) return "Lluvia fuerte";
  if (code <= 86) return "Nieve fuerte";
  if (code <= 99) return "Tormenta";
  return "Variable";
}

function useWeather() {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    const hoy = new Date();
    const start = toISO(hoy);
    const fin = new Date(hoy); fin.setDate(fin.getDate() + 2);
    const end = toISO(fin);
    const url = "https://api.open-meteo.com/v1/forecast?latitude=-38.0055&longitude=-57.5426&current=temperature_2m,weathercode,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=America/Argentina/Buenos_Aires&start_date=" + start + "&end_date=" + end;
    console.log("[CLIMA] fetching:", url);
    fetch(url).then(function(r) { return r.json(); }).then(function(data) {
      console.log("[CLIMA] response:", data);
      if (!data || !data.current || !data.daily) { console.log("[CLIMA] missing current/daily"); return; }
      setWeather({
        now: {
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weathercode,
          humidity: data.current.relative_humidity_2m,
          wind: Math.round(data.current.wind_speed_10m),
        },
        days: data.daily.time.map(function(t, i) { return {
          date: t,
          max: Math.round(data.daily.temperature_2m_max[i]),
          min: Math.round(data.daily.temperature_2m_min[i]),
          rain: data.daily.precipitation_probability_max[i],
          code: data.daily.weathercode[i],
        }; }),
      });
    }).catch(function(err) { console.error("[CLIMA] error:", err); });
  }, []);
  return weather;
}

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
  const ACTIVAS = ["visita","pendiente","senada","confirmada"];
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

  const visitasHoy = reservas.filter(r => r.estado === "visita" && r.fechaVisita === hoy).map(r => {
    const c = clientes.find(x=>x.id===r.clienteId);
    return { reserva: r, cliente: c };
  });

  return { alertasHoy, alertasSemana, oportunidades, totalEventos: eventosSemana.length, visitasHoy };
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

function VisitaCard({ reserva, cliente, onConfirm, onPosponer, onReprogramar, onNoConcreto, onEditVisita }) {
  const [open, setOpen] = useState(false);
  const [showRepro, setShowRepro] = useState(false);
  const [reproFecha, setReproFecha] = useState(reserva.fechaVisita || "");
  const [reproHora, setReproHora] = useState(reserva.horaVisita || "");
  const [showPosponer, setShowPosponer] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [motivo, setMotivo] = useState("");

  return (
    <div style={{background:"#F5F3FF",border:"1.5px solid #DDD6FE",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:20,flexShrink:0}}>👁️</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{clientName(cliente)}</div>
          <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
            {reserva.horaVisita ? `${reserva.horaVisita} hs` : ""}{reserva.tipoEvento ? ` · ${reserva.tipoEvento}` : ""}{reserva.cantInvitados>0 ? ` · ${reserva.cantInvitados} personas` : ""}
          </div>
          <div style={{fontSize:12,color:"#7C3AED",fontWeight:600,marginTop:2}}>
            Evento: {fmtDate(reserva.fecha)}{reserva.montoPactado ? ` · ${fmtCurrency(reserva.montoPactado)}` : ""}
          </div>
        </div>
        <button onClick={()=>{setOpen(v=>!v);setShowRepro(false);setShowPosponer(false);setConfirmAction(null);}} style={{background:open?"#7C3AED":"#EDE0D0",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:open?"#FFF":"#8B7355",flexShrink:0,transition:"all 0.15s"}}>
          {open ? "✕" : "···"}
        </button>
      </div>

      {open && !showRepro && !showPosponer && !confirmAction && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
          <button onClick={()=>setConfirmAction("confirmar")} style={{flex:1,padding:"8px 10px",background:"#16A34A",color:"#FFF",border:"none",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",minWidth:80}}>
            ✅ Confirmar
          </button>
          <button onClick={()=>setShowPosponer(true)} style={{flex:1,padding:"8px 10px",background:"#FFF8E1",color:"#92680A",border:"1px solid #FFD54F",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",minWidth:80}}>
            ⏳ Posponer
          </button>
          <button onClick={()=>setShowRepro(true)} style={{flex:1,padding:"8px 10px",background:"#EFF6FF",color:"#2563EB",border:"1px solid #93C5FD",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",minWidth:80}}>
            📅 Reprogramar
          </button>
          <button onClick={()=>onEditVisita(reserva)} style={{flex:1,padding:"8px 10px",background:"#FDF8F3",color:"#8B7355",border:"1px solid #EDE0D0",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",minWidth:80}}>
            ✏️ Editar
          </button>
          <button onClick={()=>setConfirmAction("noconcreto")} style={{flex:1,padding:"8px 10px",background:"#FEF2F2",color:"#DC2626",border:"1px solid #FECACA",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",minWidth:80}}>
            ❌ No concretó
          </button>
        </div>
      )}

      {open && confirmAction === "confirmar" && (
        <div style={{background:"#DCFCE7",border:"1px solid #86EFAC",borderRadius:8,padding:"10px 12px",marginTop:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"#166534",marginBottom:8}}>¿Confirmar la reserva de {clientName(cliente)}?</div>
          <div style={{fontSize:12,color:"#166534",marginBottom:10}}>La reserva pasará a Pendiente y el cliente a Cliente.</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{onConfirm(reserva);setOpen(false);setConfirmAction(null);}} style={{flex:1,padding:"8px",background:"#16A34A",color:"#FFF",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Sí, confirmar</button>
            <button onClick={()=>setConfirmAction(null)} style={{padding:"8px 12px",background:"none",border:"1px solid #86EFAC",borderRadius:6,fontSize:12,color:"#166534",cursor:"pointer",fontFamily:"inherit"}}>Volver</button>
          </div>
        </div>
      )}

      {open && confirmAction === "noconcreto" && (
        <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 12px",marginTop:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"#991B1B",marginBottom:8}}>¿Marcar como no concretada?</div>
          <div style={{fontSize:12,color:"#991B1B",marginBottom:8}}>La fecha se liberará y la reserva se cancelará.</div>
          <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo (opcional): ej. muy caro, muchos invitados..." style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:"1px solid #FECACA",borderRadius:6,fontSize:12,fontFamily:"inherit",marginBottom:8,background:"#FFF"}} />
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{onNoConcreto(reserva,motivo.trim());setOpen(false);setConfirmAction(null);setMotivo("");}} style={{flex:1,padding:"8px",background:"#DC2626",color:"#FFF",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Sí, no concretó</button>
            <button onClick={()=>{setConfirmAction(null);setMotivo("");}} style={{padding:"8px 12px",background:"none",border:"1px solid #FECACA",borderRadius:6,fontSize:12,color:"#991B1B",cursor:"pointer",fontFamily:"inherit"}}>Volver</button>
          </div>
        </div>
      )}

      {open && showPosponer && (
        <div style={{background:"#FFF8E1",border:"1px solid #FFD54F",borderRadius:8,padding:"10px 12px",marginTop:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"#92680A",marginBottom:8}}>¿Cuánto posponer?</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[{label:"6 horas",h:6},{label:"12 horas",h:12},{label:"Mañana",h:24}].map(opt=>(
              <button key={opt.h} onClick={()=>{onPosponer(reserva,opt.h);setOpen(false);setShowPosponer(false);}} style={{flex:1,padding:"8px",background:"#FFF",border:"1px solid #FFD54F",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#92680A",minWidth:70}}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={()=>setShowPosponer(false)} style={{width:"100%",marginTop:6,padding:"6px",background:"none",border:"none",fontSize:11,color:"#8B7355",cursor:"pointer",fontFamily:"inherit"}}>Volver</button>
        </div>
      )}

      {open && showRepro && (
        <div style={{background:"#EFF6FF",border:"1px solid #93C5FD",borderRadius:8,padding:"10px 12px",marginTop:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"#2563EB",marginBottom:8}}>Nueva fecha y hora de visita</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input type="date" value={reproFecha} onChange={e=>setReproFecha(e.target.value)} style={{padding:"8px",borderRadius:6,border:"1px solid #93C5FD",fontSize:13,fontFamily:"inherit"}} />
            <input type="time" value={reproHora} onChange={e=>setReproHora(e.target.value)} style={{padding:"8px",borderRadius:6,border:"1px solid #93C5FD",fontSize:13,fontFamily:"inherit"}} />
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{if(!reproFecha){alert("Elegí una fecha.");return;} onReprogramar(reserva,reproFecha,reproHora);setOpen(false);setShowRepro(false);}} style={{flex:1,padding:"8px",background:"#2563EB",color:"#FFF",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Guardar</button>
            <button onClick={()=>setShowRepro(false)} style={{padding:"8px 12px",background:"none",border:"1px solid #93C5FD",borderRadius:6,fontSize:12,color:"#2563EB",cursor:"pointer",fontFamily:"inherit"}}>Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DailyBriefing({ reservas, clientes, pagos, extrasReserva, recursos, servicios, turnosRecurso, negocio, recordatorios, tareas, onClose, onConfirmVisita, onPosponerVisita, onReprogramarVisita, onNoConcreto, onEditVisita }) {
  const hoy = new Date();
  const diaLabel = `${DIAS[hoy.getDay()]} ${hoy.getDate()}/${hoy.getMonth()+1}`;
  const hora = hoy.getHours();
  const saludo = hora < 13 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  const weather = useWeather();

  const { alertasHoy, alertasSemana, oportunidades, totalEventos, visitasHoy } = useMemo(() =>
    generarAlertas({ reservas, clientes, pagos, extrasReserva, recursos, servicios, turnosRecurso }),
    [reservas, clientes, pagos, extrasReserva, recursos, servicios, turnosRecurso]
  );

  // Recordatorios manuales de hoy
  const hoyStr = toISO(new Date());
  const recHoy = (recordatorios||[]).filter(r => r.estado === "Pendiente" && r.fechaAlerta === hoyStr)
    .sort((a,b) => (a.horaAlerta||"").localeCompare(b.horaAlerta||""));

  // Tareas pendientes del quincho
  const tareasPendientes = (tareas||[]).filter(t => t.estado === "pendiente");

  const hayAlgo = alertasHoy.length || alertasSemana.length || oportunidades.length || visitasHoy.length;

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
          {weather && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#0284C7",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🌤️ Clima en Mar del Plata</div>
              <div style={{background:"linear-gradient(135deg,#E0F2FE,#F0F9FF)",border:"1px solid #BAE6FD",borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <span style={{fontSize:36}}>{weatherIcon(weather.now.code)}</span>
                  <div>
                    <div style={{fontSize:28,fontWeight:800,color:"#0C4A6E"}}>{weather.now.temp}°</div>
                    <div style={{fontSize:12,color:"#0369A1",fontWeight:600}}>{weatherLabel(weather.now.code)}</div>
                  </div>
                  <div style={{marginLeft:"auto",textAlign:"right",fontSize:11,color:"#0369A1",lineHeight:1.6}}>
                    <div>💨 {weather.now.wind} km/h</div>
                    <div>💧 {weather.now.humidity}%</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:`repeat(${weather.days.length},1fr)`,gap:8}}>
                  {weather.days.map((d,i) => {
                    const dt = new Date(d.date+"T12:00:00");
                    const label = i === 0 ? "Hoy" : i === 1 ? "Mañana" : DIAS[dt.getDay()];
                    return (
                      <div key={d.date} style={{background:"rgba(255,255,255,0.7)",borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                        <div style={{fontSize:10,fontWeight:700,color:"#0369A1",marginBottom:4}}>{label}</div>
                        <div style={{fontSize:18}}>{weatherIcon(d.code)}</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#0C4A6E",marginTop:2}}>{d.max}° / {d.min}°</div>
                        {d.rain > 30 && <div style={{fontSize:10,color:d.rain>60?"#DC2626":"#D97706",fontWeight:600,marginTop:2}}>🌧 {d.rain}%</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!hayAlgo && !weather && (
            <div style={{textAlign:"center",padding:"32px 0",color:"#8B7355"}}>
              <div style={{fontSize:40,marginBottom:8}}>✅</div>
              <div style={{fontWeight:600}}>Todo tranquilo por hoy</div>
            </div>
          )}

          {!hayAlgo && weather && !recHoy.length && !tareasPendientes.length && !visitasHoy.length && (
            <div style={{textAlign:"center",padding:"16px 0",color:"#8B7355"}}>
              <div style={{fontSize:28,marginBottom:4}}>✅</div>
              <div style={{fontWeight:600,fontSize:13}}>Sin alertas por hoy</div>
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

          {visitasHoy.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>👁️ Visitas de hoy</div>
              {visitasHoy.map(({ reserva: v, cliente: vc }) => (
                <VisitaCard key={v.id} reserva={v} cliente={vc} onConfirm={onConfirmVisita} onPosponer={onPosponerVisita} onReprogramar={onReprogramarVisita} onNoConcreto={onNoConcreto} onEditVisita={onEditVisita} />
              ))}
            </div>
          )}

          {alertasHoy.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#C4602B",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🔴 Hoy</div>
              {alertasHoy.map((a,i) => <AlertaItem key={i} {...a} />)}
            </div>
          )}

          {tareasPendientes.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#0369A1",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>✅ Tareas pendientes del quincho</div>
              {tareasPendientes.map(t => (
                <AlertaItem key={t.id} icon="🔧" texto={t.descripcion} />
              ))}
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
