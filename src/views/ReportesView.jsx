import { useState } from "react";
import { MONTHS, EXPENSE_CATS, TURNOS } from "../lib/constants.js";
import { fmtCurrency, fmtDate, escHtml, toDateStr, getSaldo } from "../lib/utils.js";
import { card } from "../lib/styles.js";

export default function ReportesView({ pagos, gastos, reservas, extrasReserva, serviciosExtras, clientes, negocio, turnosRecurso }) {
  const getTurnoNombre = (r) => {
    if(r.turnoId) {
      const t=(turnosRecurso||[]).find(x=>x.id===r.turnoId);
      if(t) return t.nombre;
    }
    return TURNOS[r.turno]?.label || r.turno || "—";
  };

  const generarPDF = () => {
    const mes = MONTHS[selMonth];
    const anio = selYear;
    const prefix = selYear+"-"+String(selMonth+1).padStart(2,"0");
    const reservasMes = reservas.filter(r=>r.fecha&&r.fecha.startsWith(prefix)&&r.estado!=="cancelada").sort((a,b)=>a.fecha.localeCompare(b.fecha));
    const gastosMes = gastos.filter(g=>g.fecha&&g.fecha.startsWith(prefix));
    const totalCobrado = pagos.filter(p=>p.fecha&&p.fecha.startsWith(prefix)).reduce((s,p)=>s+p.monto,0);
    const totalGastos = gastosMes.reduce((s,g)=>s+g.monto,0);
    const fmt = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);

    const porTurno = {};
    reservasMes.forEach(r=>{ const k=getTurnoNombre(r); porTurno[k]=(porTurno[k]||0)+1; });
    const turnoRows = Object.entries(porTurno).map(([t,n])=>"<tr><td>"+escHtml(t)+"</td><td style=\"text-align:center\">"+n+"</td></tr>").join("") || "<tr><td colspan=\"2\" style=\"color:#8B7355\">Sin datos</td></tr>";

    const extrasMap = {};
    reservasMes.forEach(r=>{ extrasReserva.filter(e=>e.reservaId===r.id).forEach(e=>{ extrasMap[e.descripcion]=(extrasMap[e.descripcion]||0)+(e.cantidad||1); }); });
    const extrasRows = Object.entries(extrasMap).map(([d,n])=>"<tr><td>"+d+"</td><td style=\"text-align:center\">"+n+"</td></tr>").join("") || "<tr><td colspan=\"2\" style=\"color:#8B7355\">Sin extras</td></tr>";

    const gastosCat = {};
    gastosMes.forEach(g=>{ gastosCat[g.categoria||"Otros"]=(gastosCat[g.categoria||"Otros"]||0)+g.monto; });
    const gastosCatRows = Object.entries(gastosCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,monto])=>"<tr><td>"+cat+"</td><td style=\"text-align:right\">"+fmt(monto)+"</td></tr>").join("");

    const rowsRes = reservasMes.map(r=>{
      const c=clientes.find(x=>x.id===r.clienteId);
      const tp=pagos.filter(p=>p.reservaId===r.id).reduce((s,p)=>s+p.monto,0);
      const saldo=Math.max(0,r.montoPactado-tp);
      const extrasR=extrasReserva.filter(e=>e.reservaId===r.id).map(e=>e.descripcion+(e.cantidad>1?" x"+e.cantidad:"")).join(", ")||"—";
      return "<tr><td>"+fmtDate(r.fecha)+"</td>"
        +"<td><b>"+(c?escHtml(c.nombre)+" "+escHtml(c.apellido):"—")+"</b><br><small style=\"color:#8B7355\">"+escHtml(c?.whatsapp||"")+"</small></td>"
        +"<td>"+escHtml(getTurnoNombre(r))+"</td>"
        +"<td style=\"font-size:10px\">"+escHtml(extrasR)+"</td>"
        +"<td>"+fmt(r.montoPactado)+"</td>"
        +"<td>"+fmt(tp)+"</td>"
        +"<td style=\"color:"+(saldo>0?"#DC2626":"#16A34A")+"\">"+fmt(saldo)+"</td></tr>";
    }).join("");

    const css = "*{box-sizing:border-box;margin:0;padding:0}"
      +"body{font-family:Georgia,serif;color:#1C1C1E;padding:28px;max-width:820px;margin:0 auto;font-size:12px;line-height:1.5}"
      +".hdr{text-align:center;padding-bottom:14px;margin-bottom:20px;border-bottom:3px solid #C4602B}"
      +".logo{font-size:22px;font-weight:bold;color:#C4602B}.logo-img{height:56px;width:56px;border-radius:50%;object-fit:cover;margin-right:14px}.hdr-left{display:flex;align-items:center}"
      +".sub{color:#8B7355;font-size:11px;margin-top:3px}"
      +".ttl{font-size:19px;font-weight:bold;margin-top:8px}"
      +".kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px}"
      +".kpi{background:#FDF8F3;border:1px solid #EDE0D0;border-radius:7px;padding:10px;text-align:center}"
      +".knum{font-size:14px;font-weight:bold;color:#C4602B}"
      +".klbl{font-size:9px;color:#8B7355;margin-top:2px;text-transform:uppercase;letter-spacing:.4px}"
      +".two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}"
      +".sec{margin-bottom:18px}"
      +".stitle{font-size:11px;font-weight:bold;color:#C4602B;padding:5px 0;border-bottom:2px solid #EDE0D0;margin-bottom:7px;text-transform:uppercase;letter-spacing:.5px}"
      +"table{width:100%;border-collapse:collapse;font-size:11px}"
      +"th{background:#C4602B;color:#FFF;padding:6px 7px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.3px}"
      +"td{padding:5px 7px;border-bottom:1px solid #F0E8E0;vertical-align:top}"
      +"tr:nth-child(even) td{background:#FDF8F3}"
      +".ft{text-align:center;margin-top:20px;color:#8B7355;font-size:9px;border-top:1px solid #EDE0D0;padding-top:10px}";

    const logoTag = negocio?.logoUrl ? `<img class="logo-img" src="${negocio.logoUrl}" alt="logo" crossorigin="anonymous">` : "";
    const html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><style>"+css+"</style></head><body>"
      +`<div class="hdr"><div class="hdr-left">${logoTag}<div><div class="logo">${escHtml(negocio?.nombreNegocio||"Mi Negocio")}</div><div class="sub">${escHtml(negocio?.ciudad||"")}</div></div></div><div class="ttl">Reporte Mensual — ${escHtml(mes)} ${anio}</div></div>`
      +"<div class=\"kpis\">"
        +"<div class=\"kpi\"><div class=\"knum\">"+reservasMes.length+"</div><div class=\"klbl\">Reservas</div></div>"
        +"<div class=\"kpi\"><div class=\"knum\">"+fmt(totalCobrado)+"</div><div class=\"klbl\">Total cobrado</div></div>"
        +"<div class=\"kpi\"><div class=\"knum\">"+fmt(totalGastos)+"</div><div class=\"klbl\">Total gastos</div></div>"
        +"<div class=\"kpi\"><div class=\"knum\" style=\"color:"+(totalCobrado-totalGastos>=0?"#16A34A":"#DC2626")+"\">"+fmt(totalCobrado-totalGastos)+"</div><div class=\"klbl\">Balance neto</div></div>"
      +"</div>"
      +"<div class=\"two\">"
        +"<div class=\"sec\"><div class=\"stitle\">📊 Alquileres por turno</div><table><tr><th>Turno</th><th style=\"text-align:center\">Cant.</th></tr>"+turnoRows+"</table></div>"
        +"<div class=\"sec\"><div class=\"stitle\">✨ Extras contratados</div><table><tr><th>Servicio</th><th style=\"text-align:center\">Cant.</th></tr>"+extrasRows+"</table></div>"
      +"</div>"
      +(reservasMes.length>0
        ?"<div class=\"sec\"><div class=\"stitle\">📅 Detalle de reservas</div><table><tr><th>Fecha</th><th>Cliente / Tel.</th><th>Turno</th><th>Extras</th><th>Pactado</th><th>Cobrado</th><th>Saldo</th></tr>"+rowsRes+"</table></div>"
        :"<p style=\"color:#8B7355;padding:10px 0\">Sin reservas este mes.</p>")
      +(gastosCatRows?"<div class=\"sec\"><div class=\"stitle\">💸 Gastos por categoría</div><table><tr><th>Categoría</th><th style=\"text-align:right\">Total</th></tr>"+gastosCatRows+"<tr><td style=\"font-weight:bold\">TOTAL</td><td style=\"text-align:right;font-weight:bold\">"+fmt(totalGastos)+"</td></tr></table></div>":"")
      +"<div class=\"ft\">Generado el "+new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})+" · "+(negocio?.nombreNegocio||"Mi Negocio")+"</div>"
      +"</body></html>";

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if(!w){ alert("Tu navegador bloqueó la ventana emergente. Habilitá los pop-ups para este sitio y volvé a intentarlo."); URL.revokeObjectURL(url); return; }
    w.onafterprint = () => URL.revokeObjectURL(url);
    setTimeout(()=>{ w.print(); setTimeout(()=>URL.revokeObjectURL(url), 60000); }, 600);
  };

  const now = new Date();
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const selKey = `${selYear}-${String(selMonth+1).padStart(2,"0")}`;
  const todayKey = toDateStr(now).slice(0,7);
  const isFutureMonth = selKey > todayKey;
  const monthRes = reservas.filter(r=>r.fecha&&r.fecha.startsWith(selKey)&&r.estado!=="cancelada");

  const ingresos = pagos.filter(p=>p.fecha?.startsWith(selKey)).reduce((s,p)=>s+p.monto,0);
  const gastosTotal = gastos.filter(g=>g.fecha?.startsWith(selKey)).reduce((s,g)=>s+g.monto,0);
  const ganancia = ingresos - gastosTotal;

  const ingEfectivo = pagos.filter(p=>p.fecha?.startsWith(selKey)&&p.metodo==="Efectivo").reduce((s,p)=>s+p.monto,0);
  const ingTransf   = pagos.filter(p=>p.fecha?.startsWith(selKey)&&p.metodo==="Transferencia").reduce((s,p)=>s+p.monto,0);
  const gstEfectivo = gastos.filter(g=>g.fecha?.startsWith(selKey)&&g.metodo==="Efectivo").reduce((s,g)=>s+g.monto,0);
  const gstTransf   = gastos.filter(g=>g.fecha?.startsWith(selKey)&&g.metodo==="Transferencia").reduce((s,g)=>s+g.monto,0);
  const cajaFisica  = ingEfectivo - gstEfectivo;
  const cuentas     = ingTransf - gstTransf;

  const proyeccion = isFutureMonth
    ? reservas.filter(r=>r.fecha?.startsWith(selKey)&&r.estado!=="cancelada").reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0)
    : null;

  const porCobrar = !isFutureMonth
    ? reservas.filter(r=>r.fecha?.startsWith(selKey)&&["pendiente","senada"].includes(r.estado)).reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0)
    : 0;

  const topCats = EXPENSE_CATS.map(cat=>({
    name:cat,
    value:gastos.filter(g=>g.fecha?.startsWith(selKey)&&g.categoria===cat).reduce((s,g)=>s+g.monto,0)
  })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value).slice(0,3);

  const withDates = monthRes.filter(r=>r.fechaCreacion&&r.fecha);
  const avgLead = withDates.length>0
    ? Math.round(withDates.reduce((s,r)=>s+Math.round((new Date(r.fecha)-new Date(r.fechaCreacion))/(86400000)),0)/withDates.length)
    : null;

  const last6 = Array.from({length:6},(_,i)=>{
    const d=new Date(selYear,selMonth-5+i,1);
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return {
      mes:MONTHS[d.getMonth()].slice(0,3),
      ingresos:pagos.filter(p=>p.fecha?.startsWith(k)).reduce((s,p)=>s+p.monto,0),
      gastos:gastos.filter(g=>g.fecha?.startsWith(k)).reduce((s,g)=>s+g.monto,0),
    };
  });
  const maxBar=Math.max(...last6.flatMap(d=>[d.ingresos,d.gastos]),1);

  return (
    <div style={{padding:"16px 16px 100px"}}>

      <button onClick={generarPDF} style={{width:"100%",padding:"13px",background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>📄 Generar PDF / Imprimir reporte</button>

      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <button onClick={()=>{if(selMonth===0){setSelMonth(11);setSelYear(y=>y-1);}else setSelMonth(m=>m-1);}}
          style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>‹</button>
        <div style={{...card,flex:1,padding:"9px 14px",textAlign:"center",fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{MONTHS[selMonth]} {selYear}</div>
        <button onClick={()=>{if(selMonth===11){setSelMonth(0);setSelYear(y=>y+1);}else setSelMonth(m=>m+1);}}
          style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>›</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:6}}>Ingresos</div>
          <div style={{fontSize:26,fontWeight:800,color:"#16A34A",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(ingresos)}</div>
          <div style={{marginTop:8,borderTop:"1px solid #EDE0D0",paddingTop:6,display:"flex",flexDirection:"column",gap:3}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>💵 Efectivo</span><span style={{fontWeight:700,color:"#16A34A"}}>{fmtCurrency(ingEfectivo)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>🏦 Transf.</span><span style={{fontWeight:700,color:"#16A34A"}}>{fmtCurrency(ingTransf)}</span></div>
          </div>
        </div>
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:6}}>Gastos</div>
          <div style={{fontSize:26,fontWeight:800,color:"#DC2626",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(gastosTotal)}</div>
          <div style={{marginTop:8,borderTop:"1px solid #EDE0D0",paddingTop:6,display:"flex",flexDirection:"column",gap:3}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>💵 Efectivo</span><span style={{fontWeight:700,color:"#DC2626"}}>{fmtCurrency(gstEfectivo)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>🏦 Transf.</span><span style={{fontWeight:700,color:"#DC2626"}}>{fmtCurrency(gstTransf)}</span></div>
          </div>
        </div>
      </div>

      <div style={{...card,padding:"14px 16px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div><div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:4}}>Ganancia Neta</div>
          <div style={{fontSize:28,fontWeight:800,fontFamily:"'Playfair Display',serif",color:ganancia>=0?"#16A34A":"#DC2626"}}>{fmtCurrency(Math.abs(ganancia))}</div></div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:"#8B7355",marginBottom:4}}>Caja física</div>
            <div style={{fontWeight:700,fontSize:16,color:cajaFisica>=0?"#16A34A":"#DC2626"}}>{fmtCurrency(cajaFisica)}</div>
            <div style={{fontSize:11,color:"#8B7355",marginTop:6,marginBottom:2}}>Cuentas banco</div>
            <div style={{fontWeight:700,fontSize:16,color:cuentas>=0?"#16A34A":"#DC2626"}}>{fmtCurrency(cuentas)}</div>
          </div>
        </div>
      </div>

      {isFutureMonth ? (
        <div style={{...card,padding:"14px 16px",marginBottom:10,border:"2px solid #C4602B"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#C4602B",textTransform:"uppercase",marginBottom:4}}>📈 Proyección de caja</div>
          <div style={{fontSize:24,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(proyeccion)}</div>
          <div style={{fontSize:11,color:"#8B7355",marginTop:4}}>Saldo pendiente de {monthRes.length} reserva{monthRes.length!==1?"s":""} confirmadas</div>
        </div>
      ) : porCobrar>0 && (
        <div style={{...card,padding:"14px 16px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:4}}>⚠️ Por cobrar</div>
          <div style={{fontSize:24,fontWeight:800,color:"#D97706",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(porCobrar)}</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        {avgLead!==null&&(
          <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:6}}>Anticipación promedio</div>
            <div style={{fontSize:28,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display',serif"}}>{avgLead}</div>
            <div style={{fontSize:11,color:"#8B7355",marginTop:2}}>días de anticipación</div>
          </div>
        )}
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:4}}>Reservas por turno</div>
          <div style={{fontSize:20,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display',serif",marginBottom:8}}>{monthRes.length} <span style={{fontSize:12,color:"#8B7355",fontWeight:400}}>total mes</span></div>
          {(()=>{
            const porT={};
            monthRes.forEach(r=>{ const k=getTurnoNombre(r); porT[k]=(porT[k]||0)+1; });
            return Object.entries(porT).sort((a,b)=>b[1]-a[1]).map(([nombre,cant])=>(
              <div key={nombre} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,color:"#1C1C1E"}}>📌 {nombre}</span>
                <span style={{fontWeight:700,fontSize:14,color:"#C4602B"}}>{cant}</span>
              </div>
            ));
          })()}
        </div>
      </div>

      {topCats.length>0&&(
        <div style={{...card,padding:"14px 16px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:10}}>🏆 Top 3 gastos del mes</div>
          {topCats.map((c,i)=>(
            <div key={c.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<topCats.length-1?"1px solid #F5EDE4":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:20,height:20,borderRadius:10,background:["#C4602B","#D97706","#6B7280"][i],display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:11,fontWeight:800}}>{i+1}</span>
                <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{c.name}</span>
              </div>
              <span style={{fontWeight:800,color:"#DC2626",fontSize:14}}>{fmtCurrency(c.value)}</span>
            </div>
          ))}
        </div>
      )}

      {(()=>{
        if(!serviciosExtras||!serviciosExtras.length) return null;
        const items=serviciosExtras.map(function(srv){
          var total=extrasReserva.filter(function(e){var r=reservas.find(function(x){return x.id===e.reservaId;});return e.servicioId===srv.id&&r&&r.fecha&&r.fecha.startsWith(selKey);}).reduce(function(s,e){return s+e.cantidad;},0);
          return total>0?{name:srv.descripcion,total}:null;
        }).filter(Boolean);
        if(!items.length) return null;
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:10}}>🎉 Extras contratados</div>
            {items.map(function(it){return (
              <div key={it.name} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #EDE0D0",fontSize:13}}>
                <span>{it.name}</span><span style={{fontWeight:700,color:"#C4602B"}}>{it.total} {it.total===1?"vez":"veces"}</span>
              </div>
            );})}
          </div>
        );
      })()}

      {/* ¿Cuándo reservan? — para decidir cuándo invertir en publicidad */}
      {(()=>{
        const anioVista = selYear;
        // Agrupar por mes de creación de la reserva (no del evento)
        const porMesCreacion = Array.from({length:12},(_,m)=>({
          mes: MONTHS[m].slice(0,3),
          mesNum: m,
          cant: reservas.filter(r=>{
            if(!r.fechaCreacion && !r.creadoEn) return false;
            const fc = (r.fechaCreacion||r.creadoEn||"").slice(0,7);
            return fc === `${anioVista}-${String(m+1).padStart(2,"0")}` && r.estado !== "cancelada";
          }).length,
        }));
        const maxCant = Math.max(...porMesCreacion.map(m=>m.cant), 1);
        // Top 3 meses
        const top3 = [...porMesCreacion].sort((a,b)=>b.cant-a.cant).slice(0,3).filter(m=>m.cant>0);
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:4}}>📣 ¿Cuándo reservan? ({anioVista})</div>
            <div style={{fontSize:11,color:"#8B7355",marginBottom:12}}>Mes en que se hizo la reserva — para planificar publicidad</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80,marginBottom:6}}>
              {porMesCreacion.map((m,i)=>{
                const isTop = top3.some(t=>t.mesNum===m.mesNum);
                return (
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{
                      width:"100%",borderRadius:"3px 3px 0 0",
                      background: isTop ? "#C4602B" : "#EDE0D0",
                      height: Math.max(m.cant>0?6:2, Math.round((m.cant/maxCant)*64))+"px",
                      transition:"height .3s"
                    }} />
                    <div style={{fontSize:8,color:isTop?"#C4602B":"#8B7355",fontWeight:isTop?700:400}}>{m.mes}</div>
                  </div>
                );
              })}
            </div>
            {top3.length>0 && (
              <div style={{borderTop:"1px solid #EDE0D0",paddingTop:10,marginTop:4}}>
                <div style={{fontSize:11,color:"#5C4033",fontWeight:700,marginBottom:6}}>🏆 Meses con más reservas:</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {top3.map((m,i)=>(
                    <div key={m.mes} style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"6px 12px",fontSize:12}}>
                      <span style={{color:["#C4602B","#D97706","#6B7280"][i],fontWeight:800}}>{["1°","2°","3°"][i]}</span>
                      {" "}<span style={{fontWeight:700}}>{MONTHS[m.mesNum]}</span>
                      <span style={{color:"#8B7355"}}> · {m.cant} reserva{m.cant!==1?"s":""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {top3.length===0 && <div style={{fontSize:12,color:"#8B7355",textAlign:"center",padding:"8px 0"}}>Sin datos de reservas para {anioVista}</div>}
          </div>
        );
      })()}

      <div style={{...card,padding:"14px 16px",marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:12}}>📊 Últimos 6 meses</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100,marginBottom:8}}>
          {last6.map((d,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:80}}>
                <div style={{flex:1,background:"#16A34A",borderRadius:"3px 3px 0 0",height:Math.max(4,Math.round((d.ingresos/maxBar)*76))+"px"}} />
                <div style={{flex:1,background:"#DC2626",borderRadius:"3px 3px 0 0",height:Math.max(4,Math.round((d.gastos/maxBar)*76))+"px"}} />
              </div>
              <div style={{fontSize:9,color:"#8B7355",fontWeight:600}}>{d.mes}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#8B7355"}}><div style={{width:10,height:10,background:"#16A34A",borderRadius:2}} />Ingresos</div>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#8B7355"}}><div style={{width:10,height:10,background:"#DC2626",borderRadius:2}} />Gastos</div>
        </div>
      </div>

    </div>
  );
}
