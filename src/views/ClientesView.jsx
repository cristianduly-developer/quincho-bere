import { useState } from "react";
import { toDateStr, clientName } from "../lib/utils.js";
import { card, inputStyle } from "../lib/styles.js";
import { Btn, Avatar } from "../components/ui.jsx";

export default function ClientesView({ clientes, reservas, onClienteClick, onNewCliente }) {
  const [scope,setScope]=useState("all");
  const [search,setSearch]=useState("");
  const today=toDateStr(new Date());
  const activeIds=new Set(reservas.filter(r=>r.fecha>=today&&(r.estado==="senada"||r.estado==="confirmada")).map(r=>r.clienteId));
  const scopedClientes=scope==="activos"?clientes.filter(c=>activeIds.has(c.id)):clientes;
  const filtered=scopedClientes.filter(c=>clientName(c).toLowerCase().includes(search.toLowerCase())||(c.whatsapp||"").includes(search));
  return (
    <div style={{padding:"16px 16px 100px"}}>
      <div style={{display:"flex",gap:0,marginBottom:12,borderRadius:10,overflow:"hidden",border:"1px solid #EDE0D0"}}>
        {[{v:"activos",l:"Activos / Señados"},{v:"all",l:"Todos"}].map(o=>(
          <button key={o.v} onClick={()=>setScope(o.v)} style={{flex:1,padding:"10px 0",fontWeight:700,fontSize:13,border:"none",cursor:"pointer",fontFamily:"inherit",background:scope===o.v?"#C4602B":"#FDF8F3",color:scope===o.v?"#FFF":"#8B7355",transition:"all 0.15s"}}>{o.l}</button>
        ))}
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar cliente..." style={{...inputStyle,marginBottom:12}} />
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"48px 0",color:"#8B7355"}}>
          <div style={{fontSize:44,marginBottom:10}}>👥</div>
          <div style={{fontWeight:600}}>Aún no hay clientes</div>
          <div style={{marginTop:14}}><Btn small onClick={onNewCliente}>+ Nuevo cliente</Btn></div>
        </div>
      ) : filtered.map(c=>{
        const cr=reservas.filter(r=>r.clienteId===c.id&&r.estado!=="cancelada");
        return (
          <div key={c.id} onClick={()=>onClienteClick(c)} style={{...card,padding:"14px 16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}
          onMouseEnter={e=>e.currentTarget.style.background="#FDF5EE"}
          onMouseLeave={e=>e.currentTarget.style.background="#FFF"}>
            <Avatar nombre={c.nombre} />
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:"#1C1C1E"}}>{clientName(c)}</div>
              <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
                {c.localidad&&`📍 ${c.localidad}`}{c.localidad&&c.whatsapp&&" · "}{c.whatsapp&&`📱 ${c.whatsapp}`}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:11,color:"#8B7355"}}>{cr.length} reserva{cr.length!==1?"s":""}</div>
              {c.whatsapp && (
                <a href={`https://wa.me/${c.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                  onClick={e=>e.stopPropagation()} style={{display:"inline-block",marginTop:4,padding:"3px 8px",borderRadius:6,background:"#25D366",color:"#FFF",fontSize:11,fontWeight:600,textDecoration:"none"}}>💬</a>
              )}
            </div>
          </div>
        );
      })}
      <div style={{marginTop:20,textAlign:"center"}}><Btn onClick={onNewCliente}>+ Nuevo Cliente</Btn></div>
    </div>
  );
}
