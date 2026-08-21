import { useState, useMemo } from "react";
import { clientName, fmtDate } from "../lib/utils.js";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_FULL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const MSG_DEFAULT =
  `Hola {nombre}! 👋 El año pasado nos acompañaste en *{mes}* y fue un placer recibirte.\n\n` +
  `Este año tenemos fechas disponibles con un descuento especial para clientes que ya nos conocen. ¿Te gustaría reservar? 🎉`;

function Estrellas({ n }) {
  if (!n) return <span style={{fontSize:11,color:"#9CA3AF"}}>Sin calif.</span>;
  return <span style={{fontSize:12}}>{Array.from({length:5},(_,i)=><span key={i} style={{color:i<n?"#F59E0B":"#E5E7EB"}}>★</span>)}</span>;
}

export default function RecontactosView({ reservas, clientes, recursos, negocio }) {
  const [mesesSel, setMesesSel] = useState([8, 9]);
  const [calMinima, setCalMinima] = useState(4);
  const [contactados, setContactados] = useState(new Set());
  const [mensaje, setMensaje] = useState(MSG_DEFAULT);
  const [editandoMsg, setEditandoMsg] = useState(false);

  const toggleMes = (m) => setMesesSel(p => p.includes(m) ? p.filter(x=>x!==m) : [...p, m]);

  const resultados = useMemo(() => {
    const anioAnterior = new Date().getFullYear() - 1;
    const candidatas = reservas.filter(r => {
      if (r.estado !== "finalizada") return false;
      if (!r.fecha) return false;
      const [anio, mes] = r.fecha.split("-").map(Number);
      if (anio !== anioAnterior) return false;
      if (!mesesSel.includes(mes - 1)) return false;
      if (calMinima > 0 && r.calificacion && r.calificacion < calMinima) return false;
      if (calMinima > 0 && !r.calificacion) return false;
      return true;
    });
    const porCliente = {};
    candidatas.forEach(r => {
      if (!porCliente[r.clienteId] || r.fecha > porCliente[r.clienteId].fecha)
        porCliente[r.clienteId] = r;
    });
    const anioActual = new Date().getFullYear();
    const yaReservados = new Set(
      reservas.filter(r => {
        if (!["pendiente","senada","confirmada"].includes(r.estado)) return false;
        const [anio, mes] = r.fecha.split("-").map(Number);
        return anio === anioActual && mesesSel.includes(mes - 1);
      }).map(r => r.clienteId)
    );
    return Object.values(porCliente)
      .filter(r => !yaReservados.has(r.clienteId))
      .sort((a, b) => (b.calificacion || 0) - (a.calificacion || 0))
      .map(r => ({
        reserva: r,
        cliente: clientes.find(c => c.id === r.clienteId),
        recurso: recursos.find(x => x.id === r.recursoId),
      }))
      .filter(x => x.cliente);
  }, [reservas, clientes, recursos, mesesSel, calMinima]);

  const buildWA = ({ cliente, reserva }) => {
    const tel = cliente.whatsapp?.replace(/\D/g, "");
    if (!tel) return null;
    const mesEvento = MESES_FULL[Number(reserva.fecha.split("-")[1]) - 1];
    const texto = mensaje
      .replace(/\{nombre\}/g, clientName(cliente))
      .replace(/\{mes\}/g, mesEvento);
    return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
  };

  return (
    <div style={{padding:"16px 16px 100px"}}>

      {/* Filtros */}
      <div style={{background:"#FDF8F3",border:"0.5px solid #EDE0D0",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"#8B7355",marginBottom:10}}>MESES QUE QUERÉS LLENAR</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
          {MESES.map((l,i) => (
            <button key={i} onClick={()=>toggleMes(i)} style={{
              padding:"5px 10px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${mesesSel.includes(i)?"#C4602B":"#EDE0D0"}`,
              background:mesesSel.includes(i)?"#C4602B":"#FFF",
              color:mesesSel.includes(i)?"#FFF":"#8B7355",
            }}>{l}</button>
          ))}
        </div>
        <div style={{fontSize:12,fontWeight:700,color:"#8B7355",marginBottom:8}}>CALIFICACIÓN MÍNIMA</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[{v:0,l:"Todas"},{v:3,l:"⭐⭐⭐+"},{v:4,l:"⭐⭐⭐⭐+"},{v:5,l:"⭐⭐⭐⭐⭐"}].map(o=>(
            <button key={o.v} onClick={()=>setCalMinima(o.v)} style={{
              padding:"5px 10px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              border:`1px solid ${calMinima===o.v?"#C4602B":"#EDE0D0"}`,
              background:calMinima===o.v?"#C4602B":"#FFF",
              color:calMinima===o.v?"#FFF":"#8B7355",
            }}>{o.l}</button>
          ))}
        </div>
      </div>

      {/* Mensaje editable */}
      <div style={{background:"#FFF",border:"0.5px solid #EDE0D0",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8B7355"}}>💬 MENSAJE A ENVIAR</div>
          <button onClick={()=>setEditandoMsg(p=>!p)} style={{fontSize:11,fontWeight:600,color:"#C4602B",background:"none",border:"none",cursor:"pointer",padding:0}}>
            {editandoMsg ? "Listo ✓" : "Editar"}
          </button>
        </div>
        {editandoMsg ? (
          <>
            <textarea
              value={mensaje}
              onChange={e=>setMensaje(e.target.value)}
              rows={5}
              style={{width:"100%",boxSizing:"border-box",border:"1px solid #EDE0D0",borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",color:"#1C1C1E",resize:"vertical",outline:"none"}}
            />
            <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>
              Usá <strong>{"{nombre}"}</strong> y <strong>{"{mes}"}</strong> — se reemplazan solos por cada cliente.
            </div>
            <button onClick={()=>setMensaje(MSG_DEFAULT)} style={{fontSize:11,color:"#8B7355",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",textDecoration:"underline"}}>
              Restaurar mensaje original
            </button>
          </>
        ) : (
          <div style={{fontSize:13,color:"#3D2B1F",whiteSpace:"pre-line",lineHeight:1.6,background:"#FDF8F3",borderRadius:8,padding:"10px 12px"}}>
            {mensaje}
          </div>
        )}
      </div>

      {/* Resultados */}
      {mesesSel.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:"#8B7355"}}>
          <div style={{fontSize:36,marginBottom:8}}>📅</div>
          <div style={{fontWeight:600}}>Seleccioná al menos un mes</div>
        </div>
      ) : resultados.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:"#8B7355"}}>
          <div style={{fontSize:36,marginBottom:8}}>✅</div>
          <div style={{fontWeight:600}}>No hay clientes para recontactar</div>
          <div style={{fontSize:13,marginTop:6}}>Puede que ya tengan reserva este año o no haya eventos en esos meses.</div>
        </div>
      ) : (
        <>
          <div style={{fontSize:12,color:"#8B7355",marginBottom:10}}>
            {resultados.length} cliente{resultados.length!==1?"s":""} para recontactar · eventos de {new Date().getFullYear()-1}
          </div>
          {resultados.map(({ reserva, cliente, recurso }) => {
            const waUrl = buildWA({ cliente, reserva });
            const yaContactado = contactados.has(cliente.id);
            return (
              <div key={cliente.id} style={{
                background: yaContactado ? "#F9FFF9" : "#FFF",
                border:`0.5px solid ${yaContactado?"#BBF7D0":"#EDE0D0"}`,
                borderRadius:12, marginBottom:8, padding:"13px 14px",
                opacity: yaContactado ? 0.7 : 1,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>
                      {yaContactado && <span style={{marginRight:4}}>✅</span>}{clientName(cliente)}
                    </div>
                    <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
                      {recurso?.nombre||"—"} · {fmtDate(reserva.fecha)}{reserva.tipoEvento ? ` · ${reserva.tipoEvento}` : ""}
                    </div>
                    <div style={{marginTop:4}}><Estrellas n={reserva.calificacion} /></div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    {waUrl ? (
                      <a href={waUrl} target="_blank" rel="noreferrer"
                        onClick={()=>setContactados(p=>new Set([...p,cliente.id]))}
                        style={{padding:"5px 12px",borderRadius:7,background:"#25D366",color:"#FFF",fontSize:12,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap"}}>
                        💬 WA
                      </a>
                    ) : (
                      <span style={{fontSize:11,color:"#9CA3AF"}}>Sin WA</span>
                    )}
                    {yaContactado && (
                      <button onClick={()=>setContactados(p=>{const n=new Set(p);n.delete(cliente.id);return n;})}
                        style={{fontSize:10,color:"#8B7355",background:"none",border:"none",cursor:"pointer",padding:0}}>
                        deshacer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
