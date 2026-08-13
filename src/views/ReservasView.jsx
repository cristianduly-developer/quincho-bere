import { useState, useMemo } from "react";
import { clientName, fmtDate, fmtCurrency, getSaldo, getTotalExtras } from "../lib/utils.js";
import { STATUS, TURNOS } from "../lib/constants.js";
import { Btn, StatusBadge } from "../components/ui.jsx";

const DIAS_SEMANA = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const ESTADO_COLOR = { pendiente:"#F59E0B", senada:"#3B82F6", confirmada:"#16A34A", finalizada:"#8B7355", cancelada:"#DC2626" };

function getWeekDays() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dow = hoy.getDay(); // 0=sun
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({length:7}, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate()+i); return d; });
}

function toISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function WeeklyGrid({ reservas, clientes, recursos, turnosRecurso, onReservaClick }) {
  const days = getWeekDays();
  const hoyStr = toISO(new Date());

  const turnos = useMemo(() => {
    if (turnosRecurso?.length > 0) return turnosRecurso.map(t => ({ id: t.id, label: t.nombre, custom: true }));
    return Object.entries(TURNOS).map(([k, v]) => ({ id: k, label: `${v.icon} ${v.label}`, custom: false }));
  }, [turnosRecurso]);

  const semanaISO = useMemo(() => days.map(toISO), [days]);
  const reservasSemana = useMemo(() =>
    reservas.filter(r => semanaISO.includes(r.fecha) && ["pendiente","senada","confirmada"].includes(r.estado)),
    [reservas, semanaISO]
  );

  const getCellReserva = (dayStr, turnoId) =>
    reservasSemana.find(r => {
      if (r.fecha !== dayStr) return false;
      if (turnosRecurso?.length > 0) return r.turnoId === turnoId;
      return r.turno === turnoId;
    });

  return (
    <div style={{overflowX:"auto",marginTop:4}}>
      <div style={{minWidth: turnos.length > 1 ? `${80 + turnos.length * 110}px` : "100%"}}>
        {/* Header días */}
        <div style={{display:"grid", gridTemplateColumns:`80px repeat(${turnos.length},1fr)`, gap:4, marginBottom:4}}>
          <div />
          {turnos.map(t => (
            <div key={t.id} style={{
              textAlign:"center", fontSize:11, fontWeight:700, color:"#8B7355",
              background:"#FDF8F3", borderRadius:8, padding:"6px 4px",
              border:"0.5px solid #EDE0D0",
            }}>{t.label}</div>
          ))}
        </div>

        {/* Filas por día */}
        {days.map((d, di) => {
          const dayStr = toISO(d);
          const esHoy = dayStr === hoyStr;
          const pasado = dayStr < hoyStr;
          return (
            <div key={dayStr} style={{
              display:"grid", gridTemplateColumns:`80px repeat(${turnos.length},1fr)`, gap:4, marginBottom:4,
            }}>
              {/* Etiqueta día */}
              <div style={{
                display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center",
                background: esHoy ? "#C4602B" : pasado ? "#F5F0EB" : "#FDF8F3",
                borderRadius:8, padding:"6px 4px", border:`0.5px solid ${esHoy?"#C4602B":"#EDE0D0"}`,
              }}>
                <div style={{fontSize:10, fontWeight:700, color: esHoy?"#FFF":"#8B7355", textTransform:"uppercase"}}>{DIAS_SEMANA[di]}</div>
                <div style={{fontSize:15, fontWeight:800, color: esHoy?"#FFF": pasado?"#C4B49A":"#1C1C1E"}}>{d.getDate()}</div>
              </div>

              {/* Celdas por turno */}
              {turnos.map(t => {
                const r = getCellReserva(dayStr, t.id);
                const c = r ? clientes.find(x => x.id === r.clienteId) : null;
                const rec = r ? recursos.find(x => x.id === r.recursoId) : null;
                if (r) {
                  return (
                    <div key={t.id} onClick={()=>onReservaClick(r)} style={{
                      background:"#FFF", borderRadius:8, padding:"7px 8px", cursor:"pointer",
                      border:`1.5px solid ${ESTADO_COLOR[r.estado]||"#EDE0D0"}`,
                      borderLeft:`4px solid ${ESTADO_COLOR[r.estado]||"#EDE0D0"}`,
                      minHeight:54, display:"flex", flexDirection:"column", justifyContent:"center",
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background="#FDF5EE"}
                    onMouseLeave={e=>e.currentTarget.style.background="#FFF"}>
                      <div style={{fontSize:11,fontWeight:700,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{clientName(c)}</div>
                      {rec && <div style={{fontSize:10,color:"#8B7355",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🏠 {rec.nombre}</div>}
                      <div style={{marginTop:3}}>
                        <span style={{fontSize:9,fontWeight:700,color:"#FFF",background:ESTADO_COLOR[r.estado]||"#8B7355",borderRadius:4,padding:"1px 5px"}}>
                          {r.estado}
                        </span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={t.id} style={{
                    background: pasado ? "#F9F6F2" : "#FFF",
                    borderRadius:8, padding:"7px 8px", border:"0.5px solid #EDE0D0",
                    minHeight:54, display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <span style={{fontSize:10,color: pasado?"#D1C4B5":"#C4D9C0",fontWeight:600}}>
                      {pasado ? "—" : "Libre"}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const parseDate = s => { const [y,m,d]=s.split("-"); const dt=new Date(y,m-1,d); dt.setHours(0,0,0,0); return dt; };
const diffDays = s => Math.round((parseDate(s)-today())/86400000);

function groupLabel(dateStr) {
  const diff = diffDays(dateStr);
  if (diff < 0) return null;
  if (diff <= 7)  return "📅 Esta semana";
  if (diff <= 30) return "📆 Este mes";
  return "🗓️ Más adelante";
}

function StatCard({ val, label, color }) {
  return (
    <div style={{flex:1,minWidth:80,background:"var(--surface-1,#FDF8F3)",border:"0.5px solid #EDE0D0",borderRadius:10,padding:"10px 14px"}}>
      <div style={{fontSize:18,fontWeight:700,color:color||"#1C1C1E"}}>{val}</div>
      <div style={{fontSize:11,color:"#8B7355",marginTop:2}}>{label}</div>
    </div>
  );
}

function ProgressBar({ pct }) {
  const color = pct>=100 ? "#16A34A" : pct>=50 ? "#C4602B" : "#DC2626";
  return (
    <div style={{background:"#EDE0D0",borderRadius:4,height:4,margin:"8px 0 6px",overflow:"hidden"}}>
      <div style={{height:4,borderRadius:4,background:color,width:`${Math.min(100,Math.max(0,pct))}%`,transition:"width .3s"}} />
    </div>
  );
}

function ReservaCard({ r, clientes, recursos, extrasReserva, pagos, onReservaClick, onCobrar, negocio }) {
  const c = clientes.find(x=>x.id===r.clienteId);
  const rec = recursos.find(x=>x.id===r.recursoId);
  const saldo = getSaldo(r, extrasReserva, pagos);
  const total = r.montoPactado + getTotalExtras(r.id, extrasReserva);
  const pct = total > 0 ? Math.round(((total - saldo) / total) * 100) : 100;
  const deuda = saldo > 0;
  const ACTIVAS = ["pendiente","senada","confirmada"];
  const activa = ACTIVAS.includes(r.estado);
  const turnoInfo = TURNOS[r.turno];

  const waMsg = () => {
    const neg = negocio?.nombreNegocio || "nuestro espacio";
    const tel = c?.whatsapp?.replace(/\D/g,"");
    if (!tel) return;
    const msg = `Hola ${clientName(c)} 👋, te escribimos desde *${neg}*.\n\nTu reserva para el *${fmtDate(r.fecha)}* está registrada.\n${deuda ? `Recordá que tenés un saldo pendiente de *${fmtCurrency(saldo)}*.` : "¡Ya tenés todo pagado! ✅"}`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`);
  };

  const diff = diffDays(r.fecha);
  const urgente = activa && diff >= 0 && diff <= 3;

  return (
    <div onClick={()=>onReservaClick(r)} style={{
      background:"#FFF", borderRadius:12, border:"0.5px solid #EDE0D0",
      borderLeft:`3px solid ${urgente?"#C4602B":deuda?"#FCD34D":r.estado==="confirmada"?"#16A34A":"#EDE0D0"}`,
      marginBottom:8, padding:"13px 14px", cursor:"pointer",
    }}
    onMouseEnter={e=>e.currentTarget.style.background="#FDF8F3"}
    onMouseLeave={e=>e.currentTarget.style.background="#FFF"}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {urgente && <span style={{marginRight:4}}>🔔</span>}{clientName(c)}
          </div>
          <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
            {fmtDate(r.fecha)}{diff===0?" · Hoy":diff===1?" · Mañana":""}{turnoInfo?` · ${turnoInfo.icon} ${turnoInfo.label}`:""}{r.cantInvitados>0?` · 👥 ${r.cantInvitados}`:""}</div>
          <div style={{fontSize:11,color:"#8B7355"}}>🏠 {rec?.nombre||"Sin espacio"}</div>
        </div>
        <StatusBadge estado={r.estado} />
      </div>

      {activa && <ProgressBar pct={pct} />}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:activa?0:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:700,color:deuda?"#C4602B":saldo===0?"#16A34A":"#8B7355"}}>
            {deuda ? `⚠️ Saldo ${fmtCurrency(saldo)}` : `✅ ${fmtCurrency(total)}`}
          </span>
          {r.proximoPagoMonto && activa && (() => {
            const vencido = r.proximoPagoFecha && diffDays(r.proximoPagoFecha) < 0;
            return (
              <span style={{fontSize:10,fontWeight:600,color:"#fff",background:vencido?"#DC2626":"#16A34A",borderRadius:4,padding:"2px 6px",whiteSpace:"nowrap"}}>
                ⏳ {fmtCurrency(r.proximoPagoMonto)}{r.proximoPagoFecha ? ` · ${fmtDate(r.proximoPagoFecha)}` : ""}
              </span>
            );
          })()}
        </div>
        {activa && (
          <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
            {c?.whatsapp && (
              <button onClick={waMsg} style={{padding:"4px 10px",borderRadius:6,border:"0.5px solid #EDE0D0",background:"#FFF8F3",color:"#3D2B1F",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                💬 WA
              </button>
            )}
            {deuda && (
              <button onClick={()=>onCobrar(r)} style={{padding:"4px 10px",borderRadius:6,border:"0.5px solid #C4602B",background:"#C4602B",color:"#FFF",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                💰 Cobrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function getWeekStart(offsetWeeks = 0) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dow = hoy.getDay();
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1) + offsetWeeks * 7);
  return lunes;
}

function SemanaView({ reservas, clientes, recursos, turnosRecurso, onReservaClick }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const ACTIVAS = ["pendiente","senada","confirmada"];
  const hoyStr = toISO(new Date());

  const days = useMemo(() => {
    const lunes = getWeekStart(weekOffset);
    return Array.from({length:7}, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate()+i); return d; });
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const ini = days[0]; const fin = days[6];
    if (ini.getMonth() === fin.getMonth())
      return `${ini.getDate()} – ${fin.getDate()} ${MESES_CORTO[ini.getMonth()]} ${ini.getFullYear()}`;
    return `${ini.getDate()} ${MESES_CORTO[ini.getMonth()]} – ${fin.getDate()} ${MESES_CORTO[fin.getMonth()]} ${fin.getFullYear()}`;
  }, [days]);

  const reservasPorDia = useMemo(() => {
    const map = {};
    days.forEach(d => { map[toISO(d)] = []; });
    reservas.filter(r => ACTIVAS.includes(r.estado) && map[r.fecha] !== undefined)
      .forEach(r => map[r.fecha].push(r));
    Object.keys(map).forEach(k => map[k].sort((a,b) => {
      const hA = turnosRecurso?.find(t=>t.id===a.turnoId)?.horaInicio || TURNOS[a.turno]?.label || "";
      const hB = turnosRecurso?.find(t=>t.id===b.turnoId)?.horaInicio || TURNOS[b.turno]?.label || "";
      return hA.localeCompare(hB);
    }));
    return map;
  }, [reservas, days, turnosRecurso]);

  const getTurnoLabel = (r) => {
    if (r.turnoId) {
      const t = turnosRecurso?.find(x=>x.id===r.turnoId);
      return t ? `${t.horaInicio}–${t.horaFin}` : "";
    }
    const t = TURNOS[r.turno];
    return t ? `${t.icon} ${t.label}` : "";
  };

  const totalSemana = days.reduce((s,d) => s + (reservasPorDia[toISO(d)]?.length||0), 0);

  return (
    <div>
      {/* Navegación semana */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,background:"#FDF8F3",borderRadius:10,padding:"8px 12px",border:"0.5px solid #EDE0D0"}}>
        <button onClick={()=>setWeekOffset(p=>p-1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#C4602B",padding:"0 6px",fontFamily:"inherit"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1C1C1E"}}>{weekLabel}</div>
          <div style={{fontSize:11,color:"#8B7355",marginTop:1}}>{totalSemana} evento{totalSemana!==1?"s":""} esta semana</div>
        </div>
        <button onClick={()=>setWeekOffset(p=>p+1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#C4602B",padding:"0 6px",fontFamily:"inherit"}}>›</button>
      </div>

      {weekOffset !== 0 && (
        <button onClick={()=>setWeekOffset(0)} style={{display:"block",margin:"0 auto 12px",fontSize:11,fontWeight:600,color:"#C4602B",background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>
          Volver a hoy
        </button>
      )}

      {/* Días */}
      {days.map(d => {
        const dayStr = toISO(d);
        const esHoy = dayStr === hoyStr;
        const pasado = dayStr < hoyStr;
        const items = reservasPorDia[dayStr] || [];
        const esFinde = d.getDay() === 6 || d.getDay() === 0;

        return (
          <div key={dayStr} style={{
            marginBottom:8, borderRadius:12, overflow:"hidden",
            border:`1px solid ${esHoy?"#C4602B":items.length>1?"#FCD34D":items.length===1?"#EDE0D0":"#F0EBE4"}`,
            opacity: pasado && items.length===0 ? 0.45 : 1,
          }}>
            {/* Cabecera del día */}
            <div style={{
              display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
              background: esHoy?"#C4602B": items.length>1?"#FFFBEB": esFinde&&items.length?"#F0FFF4":"#FDF8F3",
            }}>
              <div style={{
                width:36, height:36, borderRadius:8, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", flexShrink:0,
                background: esHoy?"rgba(255,255,255,0.2)": pasado?"#EDE0D0":"#FFF",
                border: esHoy?"none":"0.5px solid #EDE0D0",
              }}>
                <div style={{fontSize:9,fontWeight:700,color:esHoy?"#FFF":"#8B7355",textTransform:"uppercase",lineHeight:1}}>{DIAS_SEMANA[d.getDay()===0?6:d.getDay()-1]}</div>
                <div style={{fontSize:16,fontWeight:800,color:esHoy?"#FFF":pasado?"#B0A090":"#1C1C1E",lineHeight:1.1}}>{d.getDate()}</div>
              </div>
              <div style={{flex:1}}>
                {items.length === 0 ? (
                  <span style={{fontSize:12,color:esHoy?"rgba(255,255,255,0.7)":"#C4B49A"}}>Sin eventos</span>
                ) : (
                  <span style={{fontSize:12,fontWeight:700,color:esHoy?"#FFF":items.length>1?"#92400E":"#8B7355"}}>
                    {items.length > 1 ? `⚠️ ${items.length} eventos — revisar operativo` : "1 evento"}
                  </span>
                )}
              </div>
              {items.length > 1 && (
                <span style={{fontSize:10,background:"#FEF3C7",color:"#92400E",borderRadius:4,padding:"2px 6px",fontWeight:700,border:"1px solid #FCD34D"}}>DOBLE</span>
              )}
            </div>

            {/* Chips de reservas */}
            {items.map(r => {
              const c = clientes.find(x=>x.id===r.clienteId);
              const rec = recursos.find(x=>x.id===r.recursoId);
              const turnoLbl = getTurnoLabel(r);
              const saldo = getSaldo(r, [], []);
              return (
                <div key={r.id} onClick={()=>onReservaClick(r)} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                  borderTop:"0.5px solid #F0EBE4", background:"#FFF", cursor:"pointer",
                }}
                onMouseEnter={e=>e.currentTarget.style.background="#FDF5EE"}
                onMouseLeave={e=>e.currentTarget.style.background="#FFF"}>
                  <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:ESTADO_COLOR[r.estado]||"#EDE0D0",flexShrink:0}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{clientName(c)}</div>
                    <div style={{fontSize:11,color:"#8B7355",marginTop:1,display:"flex",gap:6,flexWrap:"wrap"}}>
                      {turnoLbl && <span>🕐 {turnoLbl}</span>}
                      {rec && <span>🏠 {rec.nombre}</span>}
                      {r.cantInvitados>0 && <span>👥 {r.cantInvitados}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <span style={{fontSize:10,fontWeight:700,color:"#FFF",background:ESTADO_COLOR[r.estado]||"#8B7355",borderRadius:4,padding:"2px 6px"}}>{r.estado}</span>
                    {saldo>0 && <div style={{fontSize:10,color:"#C4602B",fontWeight:600,marginTop:2}}>⚠️ Saldo</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const MESES_FULL2 = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function DisponibilidadView({ reservas, bloqueos, turnosRecurso }) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const hoyStr = toISO(hoy);
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const ACTIVAS = ["pendiente","senada","confirmada"];

  const toMin = s => { const [h,m] = (s+":0").split(":"); return Number(h)*60+Number(m||0); };
  const solapan = (a, b) => toMin(a.horaInicio) < toMin(b.horaFin) && toMin(b.horaInicio) < toMin(a.horaFin);

  // Turnos a mostrar: excluir los que solapan con 2+ otros (ej: "Día Completo")
  // Así mostramos solo las franjas base y el completo afecta ambas
  const todosLosTurnos = turnosRecurso?.length > 0
    ? turnosRecurso
    : Object.entries(TURNOS).map(([k,v]) => ({ id: k, nombre: v.label, horaInicio: v.horaInicio||"00:00", horaFin: v.horaFin||"23:59" }));

  const turnosBase = todosLosTurnos.filter(t => {
    const solapaCon = todosLosTurnos.filter(o => o.id !== t.id && solapan(t, o));
    // Si solapa con TODOS los demás → es el "completo", no lo mostramos como franja
    return solapaCon.length < todosLosTurnos.length - 1;
  });

  const turnos = turnosBase.length > 0 ? turnosBase : todosLosTurnos;

  const navMes = (d) => {
    const dt = new Date(anio, mes + d, 1);
    setMes(dt.getMonth()); setAnio(dt.getFullYear());
  };

  // Días del mes (con padding de lunes)
  const primerDia = new Date(anio, mes, 1);
  const dowInicio = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1; // 0=lun
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const celdas = Array(dowInicio).fill(null).concat(
    Array.from({ length: diasMes }, (_, i) => i + 1)
  );

  // Índices por fecha
  const resIdx = useMemo(() => {
    const idx = {};
    reservas.filter(r => ACTIVAS.includes(r.estado)).forEach(r => {
      if (!idx[r.fecha]) idx[r.fecha] = [];
      idx[r.fecha].push(r);
    });
    return idx;
  }, [reservas]);

  const bloqIdx = useMemo(() => {
    const idx = {};
    (bloqueos||[]).forEach(b => {
      if (!idx[b.fecha]) idx[b.fecha] = [];
      idx[b.fecha].push(b);
    });
    return idx;
  }, [bloqueos]);

  // Estado de cada franja base en un día
  const getTurnoEstado = (dayStr, turno) => {
    const bls = bloqIdx[dayStr] || [];
    // Bloqueado si hay bloqueo completo o que solapa con esta franja
    const bloqueado = bls.some(b => {
      if (b.turno === "completo") return true;
      if (b.turno === turno.id) return true;
      const bt = todosLosTurnos.find(t => t.id === b.turno);
      return bt ? solapan(turno, bt) : false;
    });
    if (bloqueado) return "bloqueado";
    const res = resIdx[dayStr] || [];
    // Ocupado si hay reserva que coincide o que (siendo "completo") solapa con esta franja
    const ocupado = res.some(r => {
      if (r.turnoId === turno.id) return true;
      const rt = todosLosTurnos.find(t => t.id === r.turnoId);
      return rt ? solapan(turno, rt) : false;
    });
    return ocupado ? "ocupado" : "libre";
  };

  const COLOR = { libre:"#D1FAE5", ocupado:"#FECACA", bloqueado:"#E5E7EB", libreborder:"#6EE7B7", ocupadoborder:"#FCA5A5", bloqueadoborder:"#D1D5DB" };
  const LABEL_COLOR = { libre:"#065F46", ocupado:"#991B1B", bloqueado:"#6B7280" };

  return (
    <div>
      {/* Navegación mes */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:"#FDF8F3",borderRadius:10,padding:"8px 16px",border:"0.5px solid #EDE0D0"}}>
        <button onClick={()=>navMes(-1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#C4602B",padding:"0 4px"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:800,color:"#1C1C1E"}}>{MESES_FULL2[mes]} {anio}</div>
        </div>
        <button onClick={()=>navMes(1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#C4602B",padding:"0 4px"}}>›</button>
      </div>

      {/* Leyenda */}
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        {[["#D1FAE5","#065F46","Libre"],["#FECACA","#991B1B","Ocupado"],["#E5E7EB","#6B7280","Bloqueado"]].map(([bg,c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:12,height:12,borderRadius:3,background:bg,border:`1px solid ${c}22`}} />
            <span style={{fontSize:11,color:"#8B7355"}}>{l}</span>
          </div>
        ))}
      </div>

      {/* Cabecera días */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
        {DIAS_SEMANA.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#8B7355",padding:"4px 0"}}>{d}</div>
        ))}
      </div>

      {/* Grilla días */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {celdas.map((dia, idx) => {
          if (!dia) return <div key={`e${idx}`} />;
          const dayStr = `${anio}-${String(mes+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
          const esHoy = dayStr === hoyStr;
          const pasado = dayStr < hoyStr;
          const estadosTurnos = turnos.map(t => getTurnoEstado(dayStr, t));
          const todosLibres = estadosTurnos.every(e=>e==="libre");
          const todosBloq = estadosTurnos.every(e=>e==="bloqueado");
          const todosOcup = estadosTurnos.every(e=>e==="ocupado");
          const parcial = !todosLibres && !todosBloq && !todosOcup;

          return (
            <div key={dayStr} style={{
              borderRadius:8, overflow:"hidden", border:`1px solid ${esHoy?"#C4602B":"#EDE0D0"}`,
              opacity: pasado ? 0.5 : 1,
              outline: esHoy ? "2px solid #C4602B" : "none",
              outlineOffset: esHoy ? "1px" : "0",
            }}>
              {/* Número del día */}
              <div style={{
                textAlign:"center", fontSize:11, fontWeight: esHoy?800:600,
                color: esHoy?"#C4602B":"#1C1C1E",
                padding:"3px 2px 2px", background:"#FAFAFA",
                borderBottom: turnos.length > 1 ? "0.5px solid #EDE0D0" : "none",
              }}>{dia}</div>

              {/* Franjas por turno */}
              {turnos.length === 1 ? (
                <div style={{
                  height:28,
                  background: estadosTurnos[0]==="bloqueado"?"#E5E7EB": estadosTurnos[0]==="ocupado"?"#FECACA":"#D1FAE5",
                }} />
              ) : (
                <div style={{display:"flex",flexDirection:"column"}}>
                  {turnos.map((t,ti) => {
                    const est = estadosTurnos[ti];
                    return (
                      <div key={t.id} style={{
                        height: Math.max(10, Math.floor(32/turnos.length)),
                        background: est==="bloqueado"?"#E5E7EB": est==="ocupado"?"#FECACA":"#D1FAE5",
                        borderTop: ti>0?"0.5px solid rgba(255,255,255,0.6)":"none",
                      }} title={t.nombre} />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen del mes */}
      {(() => {
        const mesStr = `${anio}-${String(mes+1).padStart(2,"0")}`;
        const resMes = reservas.filter(r=>r.fecha?.startsWith(mesStr)&&ACTIVAS.includes(r.estado));
        const bloqMes = (bloqueos||[]).filter(b=>b.fecha?.startsWith(mesStr));
        if (!resMes.length && !bloqMes.length) return null;
        return (
          <div style={{display:"flex",gap:8,marginTop:14}}>
            {resMes.length>0&&<div style={{flex:1,background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:"#991B1B"}}>{resMes.length}</div>
              <div style={{fontSize:11,color:"#991B1B"}}>Reservas</div>
            </div>}
            {bloqMes.length>0&&<div style={{flex:1,background:"#F3F4F6",border:"0.5px solid #D1D5DB",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:"#6B7280"}}>{bloqMes.length}</div>
              <div style={{fontSize:11,color:"#6B7280"}}>Bloqueados</div>
            </div>}
            <div style={{flex:1,background:"#ECFDF5",border:"0.5px solid #6EE7B7",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:"#065F46"}}>{diasMes - new Set(resMes.map(r=>r.fecha)).size - new Set(bloqMes.map(b=>b.fecha)).size}</div>
              <div style={{fontSize:11,color:"#065F46"}}>Días libres</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function ReservasView({ reservas, clientes, pagos, recursos, turnosRecurso, extrasReserva, bloqueos, onReservaClick, onNewReserva, onCobrar, negocio }) {
  const ACTIVAS = ["pendiente","senada","confirmada"];
  const [filter, setFilter] = useState("activas");
  const [search, setSearch]  = useState("");
  const [vista, setVista] = useState("lista");

  const stats = useMemo(() => {
    const activas = reservas.filter(r=>ACTIVAS.includes(r.estado));
    const saldoTotal = activas.reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0);
    const hoy = new Date(); const mes = hoy.getMonth(); const anio = hoy.getFullYear();
    const cobradoMes = pagos.filter(p=>{ const d=new Date(p.fecha||p.creadoEn); return d.getMonth()===mes&&d.getFullYear()===anio; }).reduce((s,p)=>s+p.monto,0);
    return { activas: activas.length, saldoTotal, cobradoMes };
  }, [reservas, pagos, extrasReserva]);

  const filtered = useMemo(() => {
    let list = [...reservas];
    if (filter === "activas")    list = list.filter(r=>ACTIVAS.includes(r.estado));
    else if (filter === "historial") list = list.filter(r=>r.estado==="finalizada"||r.estado==="cancelada");
    else if (filter === "saldo") list = list.filter(r=>ACTIVAS.includes(r.estado)&&getSaldo(r,extrasReserva,pagos)>0);
    else if (filter === "vencidos") list = list.filter(r=>ACTIVAS.includes(r.estado)&&r.proximoPagoFecha&&diffDays(r.proximoPagoFecha)<0);
    else if (filter !== "all")   list = list.filter(r=>r.estado===filter);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r=>{
        const c = clientes.find(x=>x.id===r.clienteId);
        return clientName(c).toLowerCase().includes(q)||r.fecha.includes(q)||(recursos.find(x=>x.id===r.recursoId)?.nombre||"").toLowerCase().includes(q);
      });
    }

    const isHistorial = filter==="historial";
    list.sort((a,b)=>isHistorial ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha));
    return list;
  }, [reservas, clientes, pagos, extrasReserva, recursos, filter, search]);

  // Agrupar por período
  const groups = useMemo(() => {
    if (filter==="historial") return [{ label: "📋 Historial", items: filtered }];
    const map = {};
    const ORDER = ["📅 Esta semana","📆 Este mes","🗓️ Más adelante","📋 Sin fecha futura"];
    filtered.forEach(r => {
      const diff = diffDays(r.fecha);
      const lbl = diff < 0 ? "📋 Sin fecha futura" : groupLabel(r.fecha);
      if (!map[lbl]) map[lbl] = [];
      map[lbl].push(r);
    });
    return ORDER.filter(l=>map[l]).map(l=>({ label:l, items:map[l] }));
  }, [filtered, filter]);

  const FILTERS = [
    { v:"activas",   l:"Activas" },
    { v:"saldo",     l:"⚠️ Con saldo" },
    { v:"vencidos",  l:"⏰ Vencidos" },
    { v:"senada",    l:"Señada" },
    { v:"confirmada",l:"Confirmada" },
    { v:"pendiente", l:"Pendiente" },
    { v:"all",       l:"Todas" },
    { v:"historial", l:"Historial" },
  ];

  return (
    <div style={{padding:"16px 14px 100px"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        {/* Toggle vista */}
        <div style={{display:"flex",gap:0,borderRadius:8,overflow:"hidden",border:"1px solid #EDE0D0"}}>
          <button onClick={()=>setVista("lista")} style={{padding:"7px 10px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:vista==="lista"?"#C4602B":"#FDF8F3",color:vista==="lista"?"#FFF":"#8B7355",transition:"all 0.15s"}}>☰ Lista</button>
          <button onClick={()=>setVista("semanas")} style={{padding:"7px 10px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:vista==="semanas"?"#C4602B":"#FDF8F3",color:vista==="semanas"?"#FFF":"#8B7355",transition:"all 0.15s"}}>📅 Semanas</button>
          <button onClick={()=>setVista("disponibilidad")} style={{padding:"7px 10px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:vista==="disponibilidad"?"#C4602B":"#FDF8F3",color:vista==="disponibilidad"?"#FFF":"#8B7355",transition:"all 0.15s"}}>🟢 Meses</button>
        </div>
        <button onClick={onNewReserva} style={{background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Nueva</button>
      </div>

      {/* Vista semanas */}
      {vista === "semanas" && (
        <SemanaView reservas={reservas} clientes={clientes} recursos={recursos} turnosRecurso={turnosRecurso} onReservaClick={onReservaClick} />
      )}

      {/* Vista disponibilidad */}
      {vista === "disponibilidad" && (
        <DisponibilidadView reservas={reservas} bloqueos={bloqueos} turnosRecurso={turnosRecurso} />
      )}

      {/* Vista lista */}
      {vista === "lista" && (<>
      {/* Filtros */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:10,scrollbarWidth:"none"}}>
        {FILTERS.map(f=>(
          <button key={f.v} onClick={()=>setFilter(f.v)} style={{
            padding:"6px 13px",borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,whiteSpace:"nowrap",fontFamily:"inherit",cursor:"pointer",
            background:filter===f.v?"#C4602B":"#FDF8F3",color:filter===f.v?"#FFF":"#8B7355",
            border:`1px solid ${filter===f.v?"#C4602B":"#EDE0D0"}`,
          }}>{f.l}</button>
        ))}
      </div>

      {/* Búsqueda */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Buscar por cliente, fecha o espacio..."
        style={{width:"100%",padding:"9px 12px",border:"0.5px solid #EDE0D0",borderRadius:8,fontSize:13,background:"#FFF",color:"#1C1C1E",fontFamily:"inherit",marginBottom:14,boxSizing:"border-box"}} />

      {/* Lista agrupada */}
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"48px 0",color:"#8B7355"}}>
          <div style={{fontSize:44,marginBottom:10}}>📋</div>
          <div style={{fontWeight:600}}>No hay reservas{search?" con ese criterio":""}</div>
          <div style={{marginTop:14}}>
            <button onClick={onNewReserva} style={{background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Nueva reserva</button>
          </div>
        </div>
      ) : groups.map(g=>(
        <div key={g.label}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:".7px",margin:"16px 0 8px"}}>{g.label}</div>
          {g.label==="📅 Esta semana" ? (
            <WeeklyGrid reservas={reservas} clientes={clientes} recursos={recursos} turnosRecurso={turnosRecurso} onReservaClick={onReservaClick} />
          ) : g.items.map(r=>(
            <ReservaCard key={r.id} r={r} clientes={clientes} recursos={recursos} extrasReserva={extrasReserva} pagos={pagos}
              onReservaClick={onReservaClick} onCobrar={onCobrar} negocio={negocio} />
          ))}
        </div>
      ))}
      </>)}
    </div>
  );
}
