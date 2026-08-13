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

export default function ReservasView({ reservas, clientes, pagos, recursos, turnosRecurso, extrasReserva, onReservaClick, onNewReserva, onCobrar, negocio }) {
  const ACTIVAS = ["pendiente","senada","confirmada"];
  const [filter, setFilter] = useState("activas");
  const [search, setSearch]  = useState("");

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
    { v:"semana",    l:"📅 Esta semana" },
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
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
        <button onClick={onNewReserva} style={{background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Nueva</button>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <StatCard val={stats.activas} label="Activas" />
        <StatCard val={fmtCurrency(stats.saldoTotal)} label="Saldo pendiente" color={stats.saldoTotal>0?"#C4602B":"#16A34A"} />
        <StatCard val={fmtCurrency(stats.cobradoMes)} label="Cobrado este mes" color="#16A34A" />
      </div>

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

      {/* Vista semanal */}
      {filter === "semana" ? (
        <WeeklyGrid
          reservas={reservas}
          clientes={clientes}
          recursos={recursos}
          turnosRecurso={turnosRecurso}
          onReservaClick={onReservaClick}
        />
      ) : filtered.length===0 ? (
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
          {g.items.map(r=>(
            <ReservaCard key={r.id} r={r} clientes={clientes} recursos={recursos} extrasReserva={extrasReserva} pagos={pagos}
              onReservaClick={onReservaClick} onCobrar={onCobrar} negocio={negocio} />
          ))}
        </div>
      ))}
    </div>
  );
}
