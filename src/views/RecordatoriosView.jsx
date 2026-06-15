import { useState } from "react";
import { toDateStr, clientName, fmtDate, genId } from "../lib/utils.js";
import { card } from "../lib/styles.js";
import { Btn, BottomModal, Select, TextArea, Input } from "../components/ui.jsx";

const TIPO_RECORDATORIO = ["Cobro pendiente","Llamar al cliente","Confirmar asistencia","Preparar evento","Comprar insumos"];

export default function RecordatoriosView({ recordatorios, setRecordatorios, reservas, clientes, pagos, extrasReserva, onVerCliente, onVerEvento, onNewPago, negocio }) {
  const [tab, setTab] = useState("hoy");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({reservaId:"",clienteId:"",tipo:"Cobro pendiente",nota:"",fechaAlerta:toDateStr(new Date()),horaAlerta:"09:00"});
  const today = toDateStr(new Date());

  const pending = recordatorios.filter(r=>r.estado==="Pendiente");
  const hoy     = pending.filter(r=>r.fechaAlerta===today);
  const proximos= pending.filter(r=>r.fechaAlerta>today);
  const historial=recordatorios.filter(r=>r.estado!=="Pendiente");

  const save=d=>setRecordatorios(d);
  const markDone=(id)=>save(recordatorios.map(r=>r.id===id?{...r,estado:"Procesado"}:r));
  const snooze=(id,hours)=>{
    const d=new Date(); d.setHours(d.getHours()+hours);
    save(recordatorios.map(r=>r.id===id?{...r,fechaAlerta:toDateStr(d),horaAlerta:String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"),estado:"Pospuesto"}:r));
  };

  const lista = tab==="hoy"?hoy : tab==="proximos"?proximos : historial;

  return (
    <div style={{padding:"16px 16px 100px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:15,color:"#1C1C1E"}}>📋 Recordatorios</div>
        <Btn small onClick={()=>setShowForm(true)}>+ Nuevo</Btn>
      </div>
      <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:10,overflow:"hidden",border:"1px solid #EDE0D0"}}>
        {[{v:"hoy",l:`Para hoy (${hoy.length})`},{v:"proximos",l:`Próximos (${proximos.length})`},{v:"historial",l:"Historial"}].map(o=>(
          <button key={o.v} onClick={()=>setTab(o.v)} style={{flex:1,padding:"9px 4px",fontWeight:700,fontSize:11,border:"none",cursor:"pointer",fontFamily:"inherit",background:tab===o.v?"#C4602B":"#FDF8F3",color:tab===o.v?"#FFF":"#8B7355"}}>{o.l}</button>
        ))}
      </div>

      {lista.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#8B7355"}}><div style={{fontSize:36,marginBottom:8}}>✅</div><div>Sin recordatorios en esta sección</div></div>}

      {lista.map(rec=>{
        const c=clientes.find(x=>x.id===rec.clienteId);
        const r=reservas.find(x=>x.id===rec.reservaId);
        const overdue=rec.fechaAlerta<today&&rec.estado==="Pendiente";
        return (
          <div key={rec.id} style={{...card,padding:"14px 16px",marginBottom:10,borderLeft:`3px solid ${overdue?"#DC2626":"#C4602B"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:overdue?"#DC2626":"#1C1C1E"}}>{rec.tipo}</div>
                {c&&<div style={{fontSize:12,color:"#8B7355",marginTop:2}}>👤 {clientName(c)}</div>}
                {rec.nota&&<div style={{fontSize:12,color:"#5C4033",marginTop:2}}>📝 {rec.nota}</div>}
                <div style={{fontSize:11,color:overdue?"#DC2626":"#8B7355",marginTop:2}}>🗓 {fmtDate(rec.fechaAlerta)} {rec.horaAlerta}</div>
              </div>
              <span style={{padding:"3px 8px",borderRadius:99,fontSize:10,fontWeight:700,background:rec.estado==="Procesado"?"#DCFCE7":rec.estado==="Pospuesto"?"#FEF3C7":"#FEF2F2",color:rec.estado==="Procesado"?"#16A34A":rec.estado==="Pospuesto"?"#D97706":"#DC2626"}}>{rec.estado}</span>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {c&&<Btn small variant="secondary" onClick={()=>onVerCliente(c)}>👤 Ver cliente</Btn>}
              {r&&<Btn small variant="secondary" onClick={()=>onVerEvento(r)}>📋 Ver evento</Btn>}
              {rec.tipo==="Cobro pendiente"&&r&&<Btn small onClick={()=>onNewPago(r.id)}>💰 Cobro</Btn>}
              {c&&c.whatsapp&&(
                <a href={"https://wa.me/"+c.whatsapp.replace(/\D/g,"")+"?text="+encodeURIComponent("Hola "+clientName(c)+"! Te contactamos desde "+(negocio?.nombreNegocio||"nuestro negocio")+". "+rec.nota)}
                  target="_blank" rel="noreferrer"
                  style={{display:"inline-flex",alignItems:"center",gap:4,padding:"6px 12px",background:"#25D366",color:"#FFF",borderRadius:8,fontSize:12,fontWeight:600,textDecoration:"none"}}>
                  💬 WA
                </a>
              )}
              {rec.estado==="Pendiente"&&(
                <>
                  <button onClick={()=>snooze(rec.id,1)} style={{padding:"6px 10px",background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit",color:"#D97706",fontWeight:600}}>+1h</button>
                  <button onClick={()=>snooze(rec.id,24)} style={{padding:"6px 10px",background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit",color:"#D97706",fontWeight:600}}>Mañana</button>
                  <Btn small variant="ghost" onClick={()=>markDone(rec.id)}>✓ Listo</Btn>
                </>
              )}
            </div>
          </div>
        );
      })}

      {showForm&&(
        <BottomModal title="Nuevo Recordatorio" onClose={()=>setShowForm(false)}>
          <Select label="Tipo" value={form.tipo} onChange={v=>setForm(p=>({...p,tipo:v}))} options={TIPO_RECORDATORIO.map(t=>({value:t,label:t}))} />
          <Select label="Reserva (opcional)" value={form.reservaId} onChange={v=>{
            const r=reservas.find(x=>x.id===v);
            setForm(p=>({...p,reservaId:v,clienteId:r?.clienteId||p.clienteId}));
          }} options={[{value:"",label:"— Sin vincular —"},...reservas.filter(r=>r.estado!=="cancelada"&&r.estado!=="finalizada").map(r=>{const c=clientes.find(x=>x.id===r.clienteId);return{value:r.id,label:clientName(c)+" · "+fmtDate(r.fecha)};})]} />
          <TextArea label="Nota / descripción" value={form.nota} onChange={v=>setForm(p=>({...p,nota:v}))} placeholder="Detalle del recordatorio..." rows={2} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Fecha alerta" type="date" value={form.fechaAlerta} onChange={v=>setForm(p=>({...p,fechaAlerta:v}))} />
            <Input label="Hora alerta" type="time" value={form.horaAlerta} onChange={v=>setForm(p=>({...p,horaAlerta:v}))} />
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn onClick={()=>{
              save([...recordatorios,{id:genId(),...form,estado:"Pendiente",creadoEn:new Date().toISOString()}]);
              setShowForm(false);
            }}>Guardar</Btn>
          </div>
        </BottomModal>
      )}
    </div>
  );
}
