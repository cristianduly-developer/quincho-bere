import { useState, useMemo } from "react";
import { clientName, fmtDate } from "../lib/utils.js";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_FULL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const MSG_DEFAULT =
  `Hola {nombre}! 👋 El año pasado nos acompañaste en *{mes}* y fue un placer recibirte.\n\n` +
  `Este año tenemos fechas disponibles con un descuento especial para clientes que ya nos conocen. ¿Te gustaría reservar? 🎉`;

const MSG_SEGUIMIENTO_LIBRE =
  `Hola {nombre}! 👋 ¿Cómo andás?\n\n` +
  `Te escribo porque la fecha *{fecha}* sigue disponible. Si te interesa, podemos reservarla para que no se te escape. ¿Qué te parece? 😊`;

const MSG_SEGUIMIENTO_OCUPADA =
  `Hola {nombre}! 👋 ¿Cómo andás?\n\n` +
  `Quería contarte que tenemos otras fechas muy buenas disponibles. Si te interesa, te paso las opciones. ¿Hablamos? 😊`;

function Estrellas({ n }) {
  if (!n) return <span style={{fontSize:11,color:"#9CA3AF"}}>Sin calif.</span>;
  return <span style={{fontSize:12}}>{Array.from({length:5},(_,i)=><span key={i} style={{color:i<n?"#F59E0B":"#E5E7EB"}}>★</span>)}</span>;
}

function SeguimientoTab({ reservas, clientes, recursos, onDescartarSeguimiento }) {
  const [contactados, setContactados] = useState(new Set());
  const [msgLibre, setMsgLibre] = useState(MSG_SEGUIMIENTO_LIBRE);
  const [msgOcupada, setMsgOcupada] = useState(MSG_SEGUIMIENTO_OCUPADA);
  const [editandoMsg, setEditandoMsg] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);

  const potenciales = useMemo(() => {
    const potencialesMap = {};
    clientes.filter(c => c.estadoCrm === "Potencial").forEach(c => { potencialesMap[c.id] = c; });

    const yaConReservaActiva = new Set(
      reservas.filter(r => ["visita","pendiente","senada","confirmada"].includes(r.estado))
        .map(r => r.clienteId)
    );

    const canceladasPotenciales = reservas.filter(r => {
      if (r.estado !== "cancelada") return false;
      if (r.seguimientoDescartado) return false;
      if (!potencialesMap[r.clienteId]) return false;
      if (yaConReservaActiva.has(r.clienteId)) return false;
      if (!r.fechaVisita) return false;
      const visitaDate = new Date(r.fechaVisita + "T00:00:00");
      const diffDays = Math.floor((today - visitaDate) / (1000*60*60*24));
      return diffDays >= 7;
    });

    const porCliente = {};
    canceladasPotenciales.forEach(r => {
      if (!porCliente[r.clienteId] || r.fechaVisita > porCliente[r.clienteId].fechaVisita)
        porCliente[r.clienteId] = r;
    });

    const fechasOcupadas = new Set(
      reservas.filter(r => ["visita","pendiente","senada","confirmada"].includes(r.estado))
        .map(r => r.fecha + "|" + r.recursoId)
    );

    return Object.values(porCliente)
      .map(r => {
        const cliente = potencialesMap[r.clienteId];
        const recurso = recursos.find(x => x.id === r.recursoId);
        const fechaLibre = !fechasOcupadas.has(r.fecha + "|" + r.recursoId) && r.fecha >= todayStr;
        const diasDesdeVisita = Math.floor((today - new Date(r.fechaVisita + "T00:00:00")) / (1000*60*60*24));
        return { reserva: r, cliente, recurso, fechaLibre, diasDesdeVisita };
      })
      .filter(x => x.cliente)
      .sort((a,b) => a.diasDesdeVisita - b.diasDesdeVisita);
  }, [reservas, clientes, recursos, todayStr]);

  const buildWA = ({ cliente, reserva, fechaLibre }) => {
    const tel = cliente.whatsapp?.replace(/\D/g, "");
    if (!tel) return null;
    const msg = fechaLibre ? msgLibre : msgOcupada;
    const texto = msg
      .replace(/\{nombre\}/g, clientName(cliente))
      .replace(/\{fecha\}/g, fmtDate(reserva.fecha));
    return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
  };

  const stats = useMemo(() => {
    const visitaronIds = new Set(reservas.filter(r => r.fechaVisita && r.estado === "cancelada").map(r => r.clienteId));
    const convirtieron = clientes.filter(c => c.estadoCrm === "Cliente" && visitaronIds.has(c.id)).length;
    const descartados = reservas.filter(r => r.estado === "cancelada" && r.seguimientoDescartado && r.fechaVisita).length;
    const pendientes = potenciales.length;
    const totalVisitas = visitaronIds.size;
    return { convirtieron, descartados, pendientes, totalVisitas };
  }, [reservas, clientes, potenciales]);

  return (
    <div style={{padding:"16px 16px 100px"}}>
      {/* Stats de conversión */}
      {stats.totalVisitas > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <div style={{background:"#DCFCE7",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #BBF7D0"}}>
            <div style={{fontSize:20,fontWeight:800,color:"#16A34A"}}>{stats.convirtieron}</div>
            <div style={{fontSize:10,color:"#16A34A",fontWeight:600}}>Convirtieron</div>
          </div>
          <div style={{background:"#FEF9C3",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #FDE68A"}}>
            <div style={{fontSize:20,fontWeight:800,color:"#A16207"}}>{stats.pendientes}</div>
            <div style={{fontSize:10,color:"#A16207",fontWeight:600}}>Pendientes</div>
          </div>
          <div style={{background:"#F3F4F6",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #D1D5DB"}}>
            <div style={{fontSize:20,fontWeight:800,color:"#6B7280"}}>{stats.descartados}</div>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:600}}>Descartados</div>
          </div>
        </div>
      )}

      {/* Mensaje editable */}
      <div style={{background:"#FFF",border:"0.5px solid #EDE0D0",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8B7355"}}>💬 MENSAJES DE SEGUIMIENTO</div>
          <button onClick={()=>setEditandoMsg(p=>!p)} style={{fontSize:11,fontWeight:600,color:"#C4602B",background:"none",border:"none",cursor:"pointer",padding:0}}>
            {editandoMsg ? "Listo ✓" : "Editar"}
          </button>
        </div>
        {editandoMsg ? (
          <>
            <div style={{fontSize:11,fontWeight:600,color:"#16A34A",marginBottom:4}}>Si la fecha sigue libre:</div>
            <textarea value={msgLibre} onChange={e=>setMsgLibre(e.target.value)} rows={4}
              style={{width:"100%",boxSizing:"border-box",border:"1px solid #EDE0D0",borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",color:"#1C1C1E",resize:"vertical",outline:"none",marginBottom:10}} />
            <div style={{fontSize:11,fontWeight:600,color:"#C2410C",marginBottom:4}}>Si la fecha ya está ocupada:</div>
            <textarea value={msgOcupada} onChange={e=>setMsgOcupada(e.target.value)} rows={4}
              style={{width:"100%",boxSizing:"border-box",border:"1px solid #EDE0D0",borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"inherit",color:"#1C1C1E",resize:"vertical",outline:"none"}} />
            <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>
              Usá <strong>{"{nombre}"}</strong> y <strong>{"{fecha}"}</strong> — se reemplazan solos.
            </div>
            <button onClick={()=>{setMsgLibre(MSG_SEGUIMIENTO_LIBRE);setMsgOcupada(MSG_SEGUIMIENTO_OCUPADA);}} style={{fontSize:11,color:"#8B7355",background:"none",border:"none",cursor:"pointer",padding:"4px 0 0",textDecoration:"underline"}}>
              Restaurar mensajes originales
            </button>
          </>
        ) : (
          <div style={{fontSize:12,color:"#8B7355"}}>
            Se envía un mensaje distinto según la fecha siga libre u ocupada.
          </div>
        )}
      </div>

      {/* Resultados */}
      {potenciales.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:"#8B7355"}}>
          <div style={{fontSize:36,marginBottom:8}}>🟡</div>
          <div style={{fontWeight:600}}>No hay potenciales para seguimiento</div>
          <div style={{fontSize:13,marginTop:6}}>Los potenciales que no concreten aparecerán acá después de 7 días.</div>
        </div>
      ) : (
        <>
          <div style={{fontSize:12,color:"#8B7355",marginBottom:10}}>
            {potenciales.length} potencial{potenciales.length!==1?"es":""} para seguimiento
          </div>
          {potenciales.map(({ reserva, cliente, recurso, fechaLibre, diasDesdeVisita }) => {
            const waUrl = buildWA({ cliente, reserva, fechaLibre });
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
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>
                        {yaContactado && <span style={{marginRight:4}}>✅</span>}{clientName(cliente)}
                      </span>
                      <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99,background:"#FEF9C3",color:"#A16207",border:"1px solid #FDE68A"}}>Potencial</span>
                    </div>
                    <div style={{fontSize:12,color:"#8B7355",marginTop:3}}>
                      {recurso?.nombre||"—"} · Le interesaba {fmtDate(reserva.fecha)}
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#6B7280"}}>🗓 Visita hace {diasDesdeVisita} día{diasDesdeVisita!==1?"s":""}</span>
                      {fechaLibre ? (
                        <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99,background:"#F0FDF4",color:"#16A34A",border:"1px solid #BBF7D0"}}>Fecha libre</span>
                      ) : (
                        <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99,background:"#FFF7ED",color:"#C2410C",border:"1px solid #FED7AA"}}>{reserva.fecha < todayStr ? "Fecha pasada" : "Fecha ocupada"}</span>
                      )}
                    </div>
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
                    {!yaContactado && onDescartarSeguimiento && (
                      <button onClick={()=>onDescartarSeguimiento(reserva)}
                        style={{fontSize:10,color:"#9CA3AF",background:"none",border:"none",cursor:"pointer",padding:0}}>
                        descartar
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

export default function RecontactosView({ reservas, clientes, recursos, negocio, onDescartarSeguimiento }) {
  const [subtab, setSubtab] = useState("recontactos");
  const [mesesSel, setMesesSel] = useState([8, 9]);
  const [calMinima, setCalMinima] = useState(4);
  const [contactados, setContactados] = useState(new Set());
  const [mensaje, setMensaje] = useState(MSG_DEFAULT);
  const [editandoMsg, setEditandoMsg] = useState(false);

  const toggleMes = (m) => setMesesSel(p => p.includes(m) ? p.filter(x=>x!==m) : [...p, m]);

  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);

  const countSeguimiento = useMemo(() => {
    const potIds = new Set(clientes.filter(c => c.estadoCrm === "Potencial").map(c => c.id));
    const activos = new Set(reservas.filter(r => ["visita","pendiente","senada","confirmada"].includes(r.estado)).map(r => r.clienteId));
    const seen = new Set();
    return reservas.filter(r => {
      if (r.estado !== "cancelada" || r.seguimientoDescartado || !potIds.has(r.clienteId) || activos.has(r.clienteId) || !r.fechaVisita || seen.has(r.clienteId)) return false;
      const diff = Math.floor((today - new Date(r.fechaVisita + "T00:00:00")) / (1000*60*60*24));
      if (diff < 7) return false;
      seen.add(r.clienteId);
      return true;
    }).length;
  }, [reservas, clientes]);

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
        if (!["visita","pendiente","senada","confirmada"].includes(r.estado)) return false;
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
    <div>
      {/* Sub-tabs */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid #EDE0D0",background:"#FDF8F3"}}>
        {[
          {v:"recontactos",l:"📣 Clientes anteriores"},
          {v:"seguimiento",l:`🟡 Seguimiento${countSeguimiento?` (${countSeguimiento})`:""}`},
        ].map(o=>(
          <button key={o.v} onClick={()=>setSubtab(o.v)} style={{
            flex:1,padding:"10px 0",fontWeight:600,fontSize:12,border:"none",cursor:"pointer",fontFamily:"inherit",
            background:"transparent",
            color:subtab===o.v?"#C4602B":"#8B7355",
            borderBottom:`2px solid ${subtab===o.v?"#C4602B":"transparent"}`,
            transition:"all 0.15s",
          }}>{o.l}</button>
        ))}
      </div>

      {subtab === "seguimiento" && (
        <SeguimientoTab reservas={reservas} clientes={clientes} recursos={recursos} onDescartarSeguimiento={onDescartarSeguimiento} />
      )}

      {subtab === "recontactos" && (
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
      )}
    </div>
  );
}
