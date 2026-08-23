import { useState } from "react";
import { MONTHS, EXPENSE_CATS, TURNOS } from "../lib/constants.js";
import { fmtCurrency, fmtDate, escHtml, toDateStr, getSaldo, getTotalExtras } from "../lib/utils.js";
import { card } from "../lib/styles.js";

export default function ReportesView({ pagos, gastos, reservas, extrasReserva, serviciosExtras, clientes, negocio, turnosRecurso, recursos, bloqueos }) {
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

    const porTipoEvento = {};
    reservasMes.forEach(r=>{ const k=r.tipoEvento||"Sin especificar"; porTipoEvento[k]=(porTipoEvento[k]||0)+1; });
    const tipoEventoRows = Object.entries(porTipoEvento).sort((a,b)=>b[1]-a[1]).map(([t,n])=>"<tr><td>"+escHtml(t)+"</td><td style=\"text-align:center\">"+n+"</td></tr>").join("");

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
        +"<div class=\"sec\"><div class=\"stitle\">🎉 Por tipo de evento</div><table><tr><th>Tipo</th><th style=\"text-align:center\">Cant.</th></tr>"+tipoEventoRows+"</table></div>"
      +"</div>"
      +"<div class=\"two\">"
        +"<div class=\"sec\"><div class=\"stitle\">✨ Extras contratados</div><table><tr><th>Servicio</th><th style=\"text-align:center\">Cant.</th></tr>"+extrasRows+"</table></div>"
        +"<div class=\"sec\"></div>"
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
  const [modo, setModo] = useState("mes"); // "mes" | "rango"
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [desde, setDesde] = useState(toDateStr(new Date(now.getFullYear(), 0, 1))); // 1 ene año actual
  const [hasta, setHasta] = useState(toDateStr(now));

  // Filtro unificado según modo
  const enRango = (fecha) => {
    if (!fecha) return false;
    if (modo === "mes") return fecha.startsWith(selKey);
    return fecha >= desde && fecha <= hasta;
  };
  const enRangoPago = (fecha) => {
    if (!fecha) return false;
    if (modo === "mes") return fecha.startsWith(selKey);
    return fecha >= desde && fecha <= hasta;
  };

  const selKey = `${selYear}-${String(selMonth+1).padStart(2,"0")}`;
  const todayKey = toDateStr(now).slice(0,7);
  const isFutureMonth = modo==="mes" && selKey > todayKey;
  const monthRes = reservas.filter(r=>r.fecha&&enRango(r.fecha)&&r.estado!=="cancelada");

  const ingresos = pagos.filter(p=>enRangoPago(p.fecha)).reduce((s,p)=>s+p.monto,0);
  const gastosTotal = gastos.filter(g=>enRangoPago(g.fecha)).reduce((s,g)=>s+g.monto,0);
  const ganancia = ingresos - gastosTotal;

  const ingEfectivo = pagos.filter(p=>enRangoPago(p.fecha)&&p.metodo==="Efectivo").reduce((s,p)=>s+p.monto,0);
  const ingTransf   = pagos.filter(p=>enRangoPago(p.fecha)&&p.metodo==="Transferencia").reduce((s,p)=>s+p.monto,0);
  const gstEfectivo = gastos.filter(g=>enRangoPago(g.fecha)&&g.metodo==="Efectivo").reduce((s,g)=>s+g.monto,0);
  const gstTransf   = gastos.filter(g=>enRangoPago(g.fecha)&&g.metodo==="Transferencia").reduce((s,g)=>s+g.monto,0);
  const cajaFisica  = ingEfectivo - gstEfectivo;
  const cuentas     = ingTransf - gstTransf;

  const proyeccion = isFutureMonth
    ? reservas.filter(r=>r.fecha?.startsWith(selKey)&&r.estado!=="cancelada").reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0)
    : null;

  const porCobrar = !isFutureMonth
    ? reservas.filter(r=>enRango(r.fecha)&&["pendiente","senada"].includes(r.estado)).reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0)
    : 0;

  const topCats = EXPENSE_CATS.map(cat=>({
    name:cat,
    value:gastos.filter(g=>enRangoPago(g.fecha)&&g.categoria===cat).reduce((s,g)=>s+g.monto,0)
  })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value).slice(0,3);

  const withDates = monthRes.filter(r=>r.fechaCreacion&&r.fecha);
  const avgLead = withDates.length>0
    ? Math.round(withDates.reduce((s,r)=>s+Math.round((new Date(r.fecha)-new Date(r.fechaCreacion))/(86400000)),0)/withDates.length)
    : null;

  const ticketPromedio = monthRes.length>0
    ? Math.round(monthRes.reduce((s,r)=>s+r.montoPactado+getTotalExtras(r.id,extrasReserva),0)/monthRes.length)
    : null;

  const topClientes = (()=>{
    const map = {};
    pagos.filter(p=>enRangoPago(p.fecha)).forEach(p=>{
      const r = reservas.find(x=>x.id===p.reservaId);
      if(!r) return;
      const c = clientes.find(x=>x.id===r.clienteId);
      if(!c) return;
      const key = c.id;
      if(!map[key]) map[key]={ nombre: (c.nombre+" "+c.apellido).trim()||"Sin nombre", total:0, cant:0 };
      map[key].total += p.monto;
      map[key].cant += 1;
    });
    return Object.values(map).sort((a,b)=>b.total-a.total).slice(0,3);
  })();

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

      {/* Selector de modo */}
      <div style={{display:"flex",gap:0,marginBottom:12,borderRadius:10,overflow:"hidden",border:"1px solid #EDE0D0"}}>
        {[{v:"mes",l:"📅 Por mes"},{v:"rango",l:"📆 Por fechas"}].map(o=>(
          <button key={o.v} onClick={()=>setModo(o.v)} style={{flex:1,padding:"10px 0",fontWeight:700,fontSize:13,border:"none",cursor:"pointer",fontFamily:"inherit",background:modo===o.v?"#C4602B":"#FDF8F3",color:modo===o.v?"#FFF":"#8B7355",transition:"all 0.15s"}}>{o.l}</button>
        ))}
      </div>

      {modo==="mes" && (
        <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
          <button onClick={()=>{if(selMonth===0){setSelMonth(11);setSelYear(y=>y-1);}else setSelMonth(m=>m-1);}}
            style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>‹</button>
          <div style={{...card,flex:1,padding:"9px 14px",textAlign:"center",fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{MONTHS[selMonth]} {selYear}</div>
          <button onClick={()=>{if(selMonth===11){setSelMonth(0);setSelYear(y=>y+1);}else setSelMonth(m=>m+1);}}
            style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>›</button>
        </div>
      )}

      {modo==="rango" && (
        <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:4}}>DESDE</div>
            <input type="date" value={desde} onChange={e=>setDesde(e.target.value)}
              style={{width:"100%",boxSizing:"border-box",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",color:"#1C1C1E",background:"#FDF8F3"}} />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:4}}>HASTA</div>
            <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}
              style={{width:"100%",boxSizing:"border-box",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",color:"#1C1C1E",background:"#FDF8F3"}} />
          </div>
        </div>
      )}

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

      {/* Dashboard de ocupación */}
      {modo==="mes"&&(()=>{
        const tr=turnosRecurso||[];
        const recs=recursos||[];
        const bloqs=bloqueos||[];
        const activeTurnos=tr.filter(t=>t.activo!==false);
        const slotsPerDay=activeTurnos.length||1;
        const year=selYear, month=selMonth;
        const daysInMonth=new Date(year,month+1,0).getDate();
        const totalSlots=daysInMonth*slotsPerDay;
        const prefix=selKey;
        const occupied=new Set();
        reservas.filter(r=>r.fecha?.startsWith(prefix)&&r.estado!=="cancelada").forEach(r=>{
          const key=r.turnoId?`${r.fecha}-${r.turnoId}`:`${r.fecha}-${r.turno}`;
          occupied.add(key);
        });
        bloqs.filter(b=>b.fecha?.startsWith(prefix)).forEach(b=>{
          const matching=b.turno?activeTurnos.filter(t=>t.nombre===b.turno||t.id===b.turno):activeTurnos;
          matching.forEach(t=>{occupied.add(`${b.fecha}-${t.id}`);});
        });
        const occupiedCount=occupied.size;
        const pct=totalSlots>0?Math.round((occupiedCount/totalSlots)*100):0;
        const libre=totalSlots-occupiedCount;
        const prevYear=month===0?year-1:year;
        const prevMonth=month===0?11:month-1;
        const prevPrefix=`${prevYear}-${String(prevMonth+1).padStart(2,"0")}`;
        const prevDays=new Date(prevYear,prevMonth+1,0).getDate();
        const prevTotal=prevDays*slotsPerDay;
        const prevOcc=new Set();
        reservas.filter(r=>r.fecha?.startsWith(prevPrefix)&&r.estado!=="cancelada").forEach(r=>{
          const key=r.turnoId?`${r.fecha}-${r.turnoId}`:`${r.fecha}-${r.turno}`;
          prevOcc.add(key);
        });
        bloqs.filter(b=>b.fecha?.startsWith(prevPrefix)).forEach(b=>{
          const matching=b.turno?activeTurnos.filter(t=>t.nombre===b.turno||t.id===b.turno):activeTurnos;
          matching.forEach(t=>{prevOcc.add(`${b.fecha}-${t.id}`);});
        });
        const prevPct=prevTotal>0?Math.round((prevOcc.size/prevTotal)*100):0;
        const diff=pct-prevPct;
        const prevYearSameMonth=`${year-1}-${String(month+1).padStart(2,"0")}`;
        const yoyDays=new Date(year-1,month+1,0).getDate();
        const yoyTotal=yoyDays*slotsPerDay;
        const yoyOcc=new Set();
        reservas.filter(r=>r.fecha?.startsWith(prevYearSameMonth)&&r.estado!=="cancelada").forEach(r=>{
          const key=r.turnoId?`${r.fecha}-${r.turnoId}`:`${r.fecha}-${r.turno}`;
          yoyOcc.add(key);
        });
        const yoyPct=yoyTotal>0?Math.round((yoyOcc.size/yoyTotal)*100):0;
        const hasYoy=yoyOcc.size>0;
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:10}}>📊 Ocupación del mes</div>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
              <div style={{position:"relative",width:72,height:72,flexShrink:0}}>
                <svg viewBox="0 0 36 36" style={{width:72,height:72,transform:"rotate(-90deg)"}}>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#EDE0D0" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={pct>=70?"#16A34A":pct>=40?"#D97706":"#DC2626"} strokeWidth="3"
                    strokeDasharray={`${pct*0.974} 100`} strokeLinecap="round"/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:18,color:"#1C1C1E"}}>{pct}%</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"#1C1C1E",marginBottom:4}}>{occupiedCount} de {totalSlots} turnos</div>
                <div style={{fontSize:12,color:"#16A34A",fontWeight:600}}>{libre} turnos libres</div>
                {diff!==0&&<div style={{fontSize:11,color:diff>0?"#16A34A":"#DC2626",marginTop:4,fontWeight:600}}>
                  {diff>0?"▲":"▼"} {Math.abs(diff)}% vs mes anterior ({prevPct}%)
                </div>}
                {hasYoy&&<div style={{fontSize:11,color:"#7C3AED",marginTop:2,fontWeight:600}}>
                  📅 {MONTHS[month]} {year-1}: {yoyPct}% {pct>yoyPct?`(+${pct-yoyPct}%)`:`(${pct-yoyPct}%)`}
                </div>}
              </div>
            </div>
            <div style={{height:8,background:"#EDE0D0",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:pct>=70?"#16A34A":pct>=40?"#D97706":"#DC2626",borderRadius:4,transition:"width .3s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"#8B7355"}}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
        );
      })()}

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
          {ticketPromedio!==null&&(
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #EDE0D0"}}>
              <div style={{fontSize:11,color:"#8B7355"}}>Ticket promedio</div>
              <div style={{fontWeight:800,fontSize:16,color:"#1C1C1E"}}>{fmtCurrency(ticketPromedio)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Reservas por tipo de evento */}
      {(()=>{
        const porTipo={};
        monthRes.forEach(r=>{ const k=r.tipoEvento||"Sin especificar"; porTipo[k]=(porTipo[k]||0)+1; });
        const items=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]);
        if(items.length===0 || (items.length===1 && items[0][0]==="Sin especificar")) return null;
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:8}}>🎉 Por tipo de evento</div>
            {items.map(([tipo,cant])=>(
              <div key={tipo} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,color:"#1C1C1E"}}>{tipo}</span>
                <span style={{fontWeight:700,fontSize:14,color:"#7C3AED"}}>{cant}</span>
              </div>
            ))}
          </div>
        );
      })()}

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
          const matching=extrasReserva.filter(function(e){var r=reservas.find(function(x){return x.id===e.reservaId;});return e.servicioId===srv.id&&r&&r.fecha&&enRango(r.fecha);});
          var total=matching.reduce(function(s,e){return s+e.cantidad;},0);
          var ingresos=matching.reduce(function(s,e){return s+(e.precioHistorico*e.cantidad);},0);
          return total>0?{name:srv.descripcion,total,ingresos}:null;
        }).filter(Boolean);
        if(!items.length) return null;
        const totalExtrasIngreso=items.reduce((s,it)=>s+it.ingresos,0);
        const resConExtras=new Set(extrasReserva.filter(e=>monthRes.some(r=>r.id===e.reservaId)).map(e=>e.reservaId)).size;
        const pctExtras=monthRes.length>0?Math.round((resConExtras/monthRes.length)*100):0;
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:10}}>🎉 Extras contratados</div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:1,background:"#F0FDF4",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid #BBF7D0"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#16A34A"}}>{fmtCurrency(totalExtrasIngreso)}</div>
                <div style={{fontSize:10,color:"#16A34A",fontWeight:600}}>Ingreso extras</div>
              </div>
              <div style={{flex:1,background:"#EFF6FF",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid #BFDBFE"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#2563EB"}}>{pctExtras}%</div>
                <div style={{fontSize:10,color:"#2563EB",fontWeight:600}}>{resConExtras} de {monthRes.length} sumaron</div>
              </div>
            </div>
            {items.map(function(it){return (
              <div key={it.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #EDE0D0",fontSize:13}}>
                <span>{it.name}</span>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#16A34A",fontWeight:600}}>{fmtCurrency(it.ingresos)}</span>
                  <span style={{fontWeight:700,color:"#C4602B",minWidth:50,textAlign:"right"}}>{it.total}x</span>
                </div>
              </div>
            );})}
          </div>
        );
      })()}

      {/* Funnel de conversión */}
      {(()=>{
        const allPeriod=reservas.filter(r=>r.fecha&&enRango(r.fecha));
        if(allPeriod.length===0) return null;
        const visitas=allPeriod.filter(r=>r.fechaVisita).length;
        const senadas=allPeriod.filter(r=>["senada","confirmada","finalizada"].includes(r.estado)).length;
        const confirmadas=allPeriod.filter(r=>["confirmada","finalizada"].includes(r.estado)).length;
        const canceladas=allPeriod.filter(r=>r.estado==="cancelada").length;
        const total=allPeriod.length;
        const steps=[
          {label:"Consultas",count:total,color:"#7C3AED"},
          {label:"Visitaron",count:visitas,color:"#3B82F6"},
          {label:"Señaron",count:senadas,color:"#D97706"},
          {label:"Confirmadas",count:confirmadas,color:"#16A34A"},
        ];
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:12}}>📊 Funnel de conversión</div>
            {steps.map((step,i)=>{
              const pct=total>0?Math.round((step.count/total)*100):0;
              const prevCount=i>0?steps[i-1].count:null;
              const convRate=prevCount&&prevCount>0?Math.round((step.count/prevCount)*100):null;
              return (
                <div key={step.label} style={{marginBottom:i<steps.length-1?8:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#1C1C1E"}}>{step.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {convRate!==null&&<span style={{fontSize:10,color:convRate>=50?"#16A34A":"#DC2626",fontWeight:600}}>{convRate}%</span>}
                      <span style={{fontWeight:800,fontSize:14,color:step.color}}>{step.count}</span>
                    </div>
                  </div>
                  <div style={{height:8,background:"#EDE0D0",borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:step.color,borderRadius:4,transition:"width .3s",minWidth:step.count>0?4:0}}/>
                  </div>
                </div>
              );
            })}
            {canceladas>0&&(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,paddingTop:8,borderTop:"1px solid #EDE0D0"}}>
                <span style={{fontSize:12,color:"#DC2626",fontWeight:600}}>Canceladas</span>
                <span style={{fontWeight:800,fontSize:14,color:"#DC2626"}}>{canceladas} <span style={{fontSize:10,fontWeight:400}}>({total>0?Math.round((canceladas/total)*100):0}%)</span></span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Origen de clientes */}
      {(()=>{
        const clienteIds=new Set(monthRes.map(r=>r.clienteId));
        const origenes={};
        clientes.filter(c=>clienteIds.has(c.id)&&c.origen).forEach(c=>{
          origenes[c.origen]=(origenes[c.origen]||0)+1;
        });
        const items=Object.entries(origenes).sort((a,b)=>b[1]-a[1]);
        if(items.length===0) return null;
        const sinOrigen=clientes.filter(c=>clienteIds.has(c.id)&&!c.origen).length;
        const maxOr=Math.max(...items.map(x=>x[1]),1);
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:10}}>📣 Origen de clientes</div>
            {items.map(([origen,cant])=>(
              <div key={origen} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:12,fontWeight:600,color:"#1C1C1E"}}>{origen}</span>
                  <span style={{fontWeight:700,fontSize:13,color:"#7C3AED"}}>{cant}</span>
                </div>
                <div style={{height:6,background:"#EDE0D0",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:Math.round((cant/maxOr)*100)+"%",background:"#7C3AED",borderRadius:3}}/>
                </div>
              </div>
            ))}
            {sinOrigen>0&&<div style={{fontSize:11,color:"#9CA3AF",marginTop:6}}>{sinOrigen} cliente{sinOrigen!==1?"s":""} sin origen registrado</div>}
          </div>
        );
      })()}

      {/* Tasa de conversión visita→reserva */}
      {(()=>{
        const visitaron=new Set(reservas.filter(r=>r.fechaVisita&&enRango(r.fechaVisita)).map(r=>r.clienteId));
        if(visitaron.size===0) return null;
        const convirtieron=new Set(reservas.filter(r=>r.fechaVisita&&enRango(r.fechaVisita)&&["pendiente","senada","confirmada","finalizada"].includes(r.estado)).map(r=>r.clienteId));
        const pct=Math.round((convirtieron.size/visitaron.size)*100);
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:8}}>🎯 Conversión de visitas</div>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{position:"relative",width:64,height:64,flexShrink:0}}>
                <svg viewBox="0 0 36 36" style={{width:64,height:64,transform:"rotate(-90deg)"}}>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#EDE0D0" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={pct>=60?"#16A34A":pct>=40?"#D97706":"#DC2626"} strokeWidth="3"
                    strokeDasharray={`${pct*0.974} 100`} strokeLinecap="round"/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:"#1C1C1E"}}>{pct}%</div>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#1C1C1E"}}>{convirtieron.size} de {visitaron.size} visitantes</div>
                <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>concretaron reserva</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Top clientes del mes */}
      {topClientes.length>0&&(
        <div style={{...card,padding:"14px 16px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",marginBottom:10}}>⭐ Top clientes del mes</div>
          {topClientes.map((c,i)=>(
            <div key={c.nombre} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<topClientes.length-1?"1px solid #F5EDE4":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{width:22,height:22,borderRadius:11,background:["#C4602B","#D97706","#6B7280"][i],display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
                <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{c.nombre}</span>
              </div>
              <span style={{fontWeight:800,color:"#16A34A",fontSize:14}}>{fmtCurrency(c.total)}</span>
            </div>
          ))}
        </div>
      )}

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
