import { useState } from "react";
import { toDateStr, clientName } from "../lib/utils.js";
import { card, inputStyle } from "../lib/styles.js";
import { Btn, Avatar } from "../components/ui.jsx";
import RecontactosView from "./RecontactosView.jsx";

const CRM_BADGE = {
  Potencial: { bg:"#FEF9C3", color:"#A16207", border:"#FDE68A", icon:"🟡" },
  Cliente:   { bg:"#DCFCE7", color:"#16A34A", border:"#BBF7D0", icon:"🟢" },
  Inactivo:  { bg:"#F3F4F6", color:"#6B7280", border:"#E5E7EB", icon:"⚪" },
};

export default function ClientesView({ clientes, reservas, onClienteClick, onNewCliente, recursos, negocio }) {
  const [tab, setTab] = useState("clientes");
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");

  const today = toDateStr(new Date());
  const activeIds = new Set(reservas.filter(r => r.fecha >= today && (r.estado === "senada" || r.estado === "confirmada")).map(r => r.clienteId));

  const scopedClientes = (() => {
    if (scope === "activos") return clientes.filter(c => activeIds.has(c.id));
    if (scope === "potenciales") return clientes.filter(c => c.estadoCrm === "Potencial");
    if (scope === "inactivos") return clientes.filter(c => c.estadoCrm === "Inactivo");
    return clientes;
  })();

  const filtered = scopedClientes.filter(c => clientName(c).toLowerCase().includes(search.toLowerCase()) || (c.whatsapp || "").includes(search));

  const countPotenciales = clientes.filter(c => c.estadoCrm === "Potencial").length;

  return (
    <div style={{paddingBottom:100}}>
      {/* Tabs principales */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid #EDE0D0",background:"#FDF8F3"}}>
        {[{v:"clientes",l:"👥 Clientes"},{v:"recontactos",l:"📣 Recontactos"}].map(o=>(
          <button key={o.v} onClick={()=>setTab(o.v)} style={{
            flex:1,padding:"12px 0",fontWeight:700,fontSize:13,border:"none",cursor:"pointer",fontFamily:"inherit",
            background:"transparent",
            color:tab===o.v?"#C4602B":"#8B7355",
            borderBottom:`2px solid ${tab===o.v?"#C4602B":"transparent"}`,
            transition:"all 0.15s",
          }}>{o.l}</button>
        ))}
      </div>

      {tab === "clientes" && (
        <div style={{padding:"16px 16px 0"}}>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:12,scrollbarWidth:"none"}}>
            {[
              {v:"all",l:"Todos"},
              {v:"activos",l:"Activos"},
              {v:"potenciales",l:`🟡 Potenciales${countPotenciales?` (${countPotenciales})`:""}`},
              {v:"inactivos",l:"Inactivos"},
            ].map(o=>(
              <button key={o.v} onClick={()=>setScope(o.v)} style={{
                padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,whiteSpace:"nowrap",fontFamily:"inherit",cursor:"pointer",
                background:scope===o.v?"#C4602B":"#FDF8F3",color:scope===o.v?"#FFF":"#8B7355",
                border:`1px solid ${scope===o.v?"#C4602B":"#EDE0D0"}`,
              }}>{o.l}</button>
            ))}
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar cliente..." style={{...inputStyle,marginBottom:12}} />
          {filtered.length === 0 ? (
            <div style={{textAlign:"center",padding:"48px 0",color:"#8B7355"}}>
              <div style={{fontSize:44,marginBottom:10}}>👥</div>
              <div style={{fontWeight:600}}>{scope==="potenciales"?"No hay potenciales registrados":scope==="inactivos"?"No hay clientes inactivos":"Aún no hay clientes"}</div>
              <div style={{marginTop:14}}><Btn small onClick={onNewCliente}>+ Nuevo cliente</Btn></div>
            </div>
          ) : filtered.map(c => {
            const cr = reservas.filter(r => r.clienteId === c.id && r.estado !== "cancelada");
            const badge = CRM_BADGE[c.estadoCrm];
            return (
              <div key={c.id} onClick={()=>onClienteClick(c)} style={{...card,padding:"14px 16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}
                onMouseEnter={e=>e.currentTarget.style.background="#FDF5EE"}
                onMouseLeave={e=>e.currentTarget.style.background="#FFF"}>
                <Avatar nombre={c.nombre} />
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontWeight:700,fontSize:15,color:"#1C1C1E"}}>{clientName(c)}</span>
                    {badge && <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99,background:badge.bg,color:badge.color,border:`1px solid ${badge.border}`}}>{c.estadoCrm}</span>}
                  </div>
                  <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
                    {c.localidad&&`📍 ${c.localidad}`}{c.localidad&&c.whatsapp&&" · "}{c.whatsapp&&`📱 ${c.whatsapp}`}{c.origen?` · ${c.origen}`:""}
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
      )}

      {tab === "recontactos" && (
        <RecontactosView reservas={reservas} clientes={clientes} recursos={recursos} negocio={negocio} />
      )}
    </div>
  );
}
