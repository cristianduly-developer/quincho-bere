import { useState } from "react";
import { clientName, fmtDate, fmtCurrency, getSaldo } from "../lib/utils.js";
import { STATUS, TURNOS } from "../lib/constants.js";
import { card, inputStyle } from "../lib/styles.js";
import { Btn, StatusBadge } from "../components/ui.jsx";

export default function ReservasView({ reservas, clientes, pagos, recursos, extrasReserva, onReservaClick, onNewReserva }) {
  const ACTIVAS=["pendiente","senada","confirmada"];
  const [scope,setScope]=useState("activas");
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const scoped=scope==="activas"?reservas.filter(r=>ACTIVAS.includes(r.estado)):scope==="finalizadas"?reservas.filter(r=>r.estado==="finalizada"||r.estado==="cancelada"):reservas;
  const filtered=scoped
    .filter(r=>filter==="all"||r.estado===filter)
    .filter(r=>{ if(!search)return true; const c=clientes.find(x=>x.id===r.clienteId); return clientName(c).toLowerCase().includes(search.toLowerCase())||r.fecha.includes(search); })
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return (
    <div style={{padding:"16px 16px 100px"}}>
      <div style={{display:"flex",gap:0,marginBottom:12,borderRadius:10,overflow:"hidden",border:"1px solid #EDE0D0"}}>
        {[{v:"activas",l:"Activas"},{v:"all",l:"Todas"},{v:"finalizadas",l:"Historial"}].map(o=>(
          <button key={o.v} onClick={()=>{setScope(o.v);setFilter("all");}} style={{flex:1,padding:"10px 0",fontWeight:700,fontSize:13,border:"none",cursor:"pointer",fontFamily:"inherit",background:scope===o.v?"#C4602B":"#FDF8F3",color:scope===o.v?"#FFF":"#8B7355"}}>{o.l}</button>
        ))}
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar por cliente o fecha..." style={{...inputStyle,marginBottom:12}} />
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:16}}>
        {[{value:"all",label:"Todas"},...Object.entries(STATUS).map(([k,v])=>({value:k,label:v.label}))].map(opt=>(
          <button key={opt.value} onClick={()=>setFilter(opt.value)} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,whiteSpace:"nowrap",
            background:filter===opt.value?"#C4602B":"#FDF8F3",color:filter===opt.value?"#FFF":"#8B7355",
            border:`1px solid ${filter===opt.value?"#C4602B":"#EDE0D0"}`,cursor:"pointer",fontFamily:"inherit",
          }}>{opt.label}</button>
        ))}
      </div>
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"48px 0",color:"#8B7355"}}>
          <div style={{fontSize:44,marginBottom:10}}>📋</div>
          <div style={{fontWeight:600}}>No hay reservas{search?" con ese criterio":""}</div>
          <div style={{marginTop:14}}><Btn small onClick={onNewReserva}>+ Nueva reserva</Btn></div>
        </div>
      ) : filtered.map(r=>{
        const c=clientes.find(x=>x.id===r.clienteId);
        const rec=recursos.find(x=>x.id===r.recursoId);
        const saldo=getSaldo(r,extrasReserva,pagos);
        const deuda=saldo>0;
        return (
          <div key={r.id} onClick={()=>onReservaClick(r)} style={{...card,padding:"14px 16px",marginBottom:10,cursor:"pointer",borderLeft:`3px solid ${deuda?"#DC2626":TURNOS[r.turno]?.color||"#EDE0D0"}`,borderRadius:"0 12px 12px 0"}}
          onMouseEnter={e=>e.currentTarget.style.background="#FDF5EE"}
          onMouseLeave={e=>e.currentTarget.style.background="#FFF"}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15,color:deuda?"#DC2626":"#1C1C1E",marginBottom:2}}>
                  {deuda&&"⚠️ "}{clientName(c)}
                </div>
                <div style={{fontSize:12,color:"#8B7355"}}>{fmtDate(r.fecha)} · {TURNOS[r.turno]?.icon} {TURNOS[r.turno]?.label}{r.cantInvitados>0?` · 👥 ${r.cantInvitados} pers.`:""}</div>
              </div>
              <StatusBadge estado={r.estado} />
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:"#8B7355"}}>🏠 {rec?.nombre||"Sin espacio"}</span>
              <span style={{fontSize:13,fontWeight:700,color:deuda?"#DC2626":"#16A34A"}}>
                {deuda?`⚠️ Saldo: ${fmtCurrency(saldo)}`:`✅ ${fmtCurrency(r.montoPactado)}`}
              </span>
            </div>
          </div>
        );
      })}
      <div style={{marginTop:20,textAlign:"center"}}><Btn onClick={onNewReserva}>+ Nueva Reserva</Btn></div>
    </div>
  );
}
