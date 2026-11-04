import { useState, useEffect } from "react";
import { MONTHS, EXPENSE_CATS, TURNOS } from "../lib/constants.js";
import { fmtCurrency, fmtDate, escHtml, toDateStr, getSaldo, getTotalExtras } from "../lib/utils.js";
import { card } from "../lib/styles.js";
import { supabase, getCurrentOrgId } from "../lib/supabase.js";

export default function ReportesView({ pagos, gastos, reservas, extrasReserva, serviciosExtras, clientes, negocio, turnosRecurso, recursos, bloqueos, tareas, consultas }) {
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
    const reservasMes = reservas.filter(r=>r.fecha&&r.fecha.startsWith(prefix)&&r.estado!=="cancelada"&&r.estado!=="visita").sort((a,b)=>a.fecha.localeCompare(b.fecha));
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
      +(()=>{
        const pagosMes = pagos.filter(p=>p.fecha&&p.fecha.startsWith(prefix)).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));
        if(pagosMes.length===0) return "";
        const desgloseRows = pagosMes.map(p=>{
          const r = reservas.find(x=>x.id===p.reservaId);
          const c = r ? clientes.find(x=>x.id===r.clienteId) : null;
          const nombre = c ? (escHtml(c.nombre)+" "+escHtml(c.apellido)).trim() : "—";
          const concepto = escHtml(p.concepto || (p.esSena ? "Seña" : "Pago de reserva"));
          const metodo = p.metodo==="Efectivo"?"💵 Efectivo":"🏦 Transf.";
          const fechaEvento = r ? fmtDate(r.fecha) : "—";
          return "<tr><td>"+fmtDate(p.fecha)+"</td><td>"+nombre+"</td><td>"+concepto+"</td><td>"+metodo+"</td><td style=\"text-align:right\">"+fmt(p.monto)+"</td><td>"+fechaEvento+"</td></tr>";
        }).join("");
        return "<div class=\"sec\" style=\"page-break-before:auto\"><div class=\"stitle\">💰 Desglose de ingresos</div><table><tr><th>Fecha cobro</th><th>Cliente</th><th>Concepto</th><th>Método</th><th style=\"text-align:right\">Monto</th><th>Evento</th></tr>"+desgloseRows+"<tr><td colspan=\"4\" style=\"font-weight:bold\">TOTAL</td><td style=\"text-align:right;font-weight:bold\">"+fmt(totalCobrado)+"</td><td></td></tr></table></div>";
      })()
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

  const [subtab, setSubtab] = useState("financiero");
  const [desgloseOpen, setDesgloseOpen] = useState(false);
  const [portalData, setPortalData] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [captDesde, setCaptDesde] = useState("");
  const [captHasta, setCaptHasta] = useState("");
  const [captListaOpen, setCaptListaOpen] = useState(false);
  const [pubData, setPubData] = useState([]);
  const [pubMes, setPubMes] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [pubForm, setPubForm] = useState({ conv_meta:0, conv_marketplace:0 });
  const [pubSaving, setPubSaving] = useState(false);
  const [pubFormOpen, setPubFormOpen] = useState(false);

  useEffect(() => {
    if (subtab !== "captacion") return;
    const orgId = getCurrentOrgId();
    if (!orgId) return;
    supabase.from("publicidad_mensual").select("*").eq("org_id", orgId).order("mes", { ascending: false }).limit(24)
      .then(({ data }) => { if (data) setPubData(data); });
  }, [subtab]);

  useEffect(() => {
    const existing = pubData.find(p => p.mes === pubMes);
    if (existing) setPubForm({ conv_meta: (existing.conv_meta_insta||0) + (existing.conv_meta_face||0), conv_marketplace: existing.conv_marketplace||0 });
    else setPubForm({ conv_meta:0, conv_marketplace:0 });
  }, [pubMes, pubData]);

  const guardarPub = async () => {
    const orgId = getCurrentOrgId();
    if (!orgId) return;
    setPubSaving(true);
    const halfMeta = Math.round((pubForm.conv_meta || 0) / 2);
    const row = { org_id: orgId, mes: pubMes, conv_meta_insta: halfMeta, conv_meta_face: (pubForm.conv_meta || 0) - halfMeta, conv_marketplace: pubForm.conv_marketplace || 0 };
    const existing = pubData.find(p => p.mes === pubMes);
    if (existing) row.id = existing.id;
    const { data, error } = await supabase.from("publicidad_mensual").upsert(row, { onConflict: "org_id,mes" }).select();
    if (!error && data?.[0]) {
      setPubData(prev => { const filtered = prev.filter(p => p.mes !== pubMes); return [data[0], ...filtered].sort((a,b) => b.mes.localeCompare(a.mes)); });
      setPubFormOpen(false);
    }
    setPubSaving(false);
  };

  useEffect(() => {
    if (subtab !== "portal" || portalData) return;
    let cancelled = false;
    const load = async () => {
      setPortalLoading(true);
      try {
        const portalIds = reservas.filter(r => r.shareToken).map(r => r.id);
        if (!portalIds.length) { setPortalData({ rsvp: [], fotos: [], eventos: [], pedidos: [] }); setPortalLoading(false); return; }
        let allRsvp = [], allFotos = [], allEventos = [], allPedidos = [];
        for (let i = 0; i < portalIds.length; i += 200) {
          const chunk = portalIds.slice(i, i + 200);
          const [rRes, fRes, eRes, pRes] = await Promise.all([
            supabase.from("evento_rsvp").select("reserva_id, nombre, cantidad, estado, creado_en").in("reserva_id", chunk),
            supabase.from("evento_fotos").select("reserva_id, creado_en").in("reserva_id", chunk),
            supabase.from("portal_eventos").select("reserva_id, evento, creado_en").in("reserva_id", chunk),
            supabase.from("mercado_pedidos").select("reserva_id, producto_nombre, producto_emoji, cantidad, total, estado, creado_en").in("reserva_id", chunk),
          ]);
          if (rRes.data) allRsvp = allRsvp.concat(rRes.data);
          if (fRes.data) allFotos = allFotos.concat(fRes.data);
          if (eRes.data) allEventos = allEventos.concat(eRes.data);
          if (pRes.data) allPedidos = allPedidos.concat(pRes.data);
        }
        if (!cancelled) setPortalData({ rsvp: allRsvp, fotos: allFotos, eventos: allEventos, pedidos: allPedidos });
      } catch (err) {
        console.error("Portal fetch error:", err);
        if (!cancelled) setPortalData({ rsvp: [], fotos: [], eventos: [], pedidos: [] });
      } finally {
        if (!cancelled) setPortalLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [subtab]);

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
  const monthRes = reservas.filter(r=>r.fecha&&enRango(r.fecha)&&r.estado!=="cancelada"&&r.estado!=="visita");

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
    ? reservas.filter(r=>r.fecha?.startsWith(selKey)&&r.estado!=="cancelada"&&r.estado!=="visita").reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0)
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

      <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:"1px solid var(--qb-border)",background:"var(--qb-bg-card-alt)",borderRadius:"10px 10px 0 0",overflow:"hidden"}}>
        {[{v:"financiero",l:"💰 Financiero"},{v:"captacion",l:"📊 Captación"},{v:"portal",l:"📱 Portal"}].map(o=>(
          <button key={o.v} onClick={()=>setSubtab(o.v)} style={{flex:1,padding:"11px 0",fontWeight:600,fontSize:13,border:"none",cursor:"pointer",fontFamily:"inherit",background:"transparent",color:subtab===o.v?"var(--qb-accent)":"var(--qb-text2)",borderBottom:"2px solid "+(subtab===o.v?"var(--qb-accent)":"transparent"),transition:"all 0.15s"}}>{o.l}</button>
        ))}
      </div>

      {subtab==="financiero" && <>
      {/* Selector de modo */}
      <div style={{display:"flex",gap:0,marginBottom:12,borderRadius:10,overflow:"hidden",border:"1px solid var(--qb-border)"}}>
        {[{v:"mes",l:"📅 Por mes"},{v:"rango",l:"📆 Por fechas"}].map(o=>(
          <button key={o.v} onClick={()=>setModo(o.v)} style={{flex:1,padding:"10px 0",fontWeight:700,fontSize:13,border:"none",cursor:"pointer",fontFamily:"inherit",background:modo===o.v?"var(--qb-accent)":"var(--qb-bg-card-alt)",color:modo===o.v?"#FFF":"var(--qb-text2)",transition:"all 0.15s"}}>{o.l}</button>
        ))}
      </div>

      {modo==="mes" && (
        <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
          <button onClick={()=>{if(selMonth===0){setSelMonth(11);setSelYear(y=>y-1);}else setSelMonth(m=>m-1);}}
            style={{background:"var(--qb-bg-card-alt)",border:"1px solid var(--qb-border)",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>‹</button>
          <div style={{...card,flex:1,padding:"9px 14px",textAlign:"center",fontWeight:700,fontSize:14,color:"var(--qb-text)"}}>{MONTHS[selMonth]} {selYear}</div>
          <button onClick={()=>{if(selMonth===11){setSelMonth(0);setSelYear(y=>y+1);}else setSelMonth(m=>m+1);}}
            style={{background:"var(--qb-bg-card-alt)",border:"1px solid var(--qb-border)",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>›</button>
        </div>
      )}

      {modo==="rango" && (
        <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",marginBottom:4}}>DESDE</div>
            <input type="date" value={desde} onChange={e=>setDesde(e.target.value)}
              style={{width:"100%",boxSizing:"border-box",border:"1px solid var(--qb-border)",borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",color:"var(--qb-text)",background:"var(--qb-bg-card-alt)"}} />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",marginBottom:4}}>HASTA</div>
            <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}
              style={{width:"100%",boxSizing:"border-box",border:"1px solid var(--qb-border)",borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",color:"var(--qb-text)",background:"var(--qb-bg-card-alt)"}} />
          </div>
        </div>
      )}
      </>}

      {subtab==="portal" && (
        <div style={{padding:"10px 0 6px",marginBottom:8,textAlign:"center"}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--qb-text2)"}}>📱 Portales activos</span>
          <span style={{fontSize:12,color:"var(--qb-text2)",marginLeft:6}}>(últimos 30 días + próximos eventos)</span>
        </div>
      )}

      {subtab==="financiero" && <>
      <button onClick={generarPDF} style={{width:"100%",padding:"13px",background:"var(--qb-accent)",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>📄 Generar PDF / Imprimir reporte</button>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Ingresos</div>
          <div style={{fontSize:26,fontWeight:800,color:"#16A34A",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(ingresos)}</div>
          <div style={{marginTop:8,borderTop:"1px solid var(--qb-border)",paddingTop:6,display:"flex",flexDirection:"column",gap:3}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>💵 Efectivo</span><span style={{fontWeight:700,color:"#16A34A"}}>{fmtCurrency(ingEfectivo)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>🏦 Transf.</span><span style={{fontWeight:700,color:"#16A34A"}}>{fmtCurrency(ingTransf)}</span></div>
          </div>
        </div>
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Gastos</div>
          <div style={{fontSize:26,fontWeight:800,color:"#DC2626",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(gastosTotal)}</div>
          <div style={{marginTop:8,borderTop:"1px solid var(--qb-border)",paddingTop:6,display:"flex",flexDirection:"column",gap:3}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>💵 Efectivo</span><span style={{fontWeight:700,color:"#DC2626"}}>{fmtCurrency(gstEfectivo)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>🏦 Transf.</span><span style={{fontWeight:700,color:"#DC2626"}}>{fmtCurrency(gstTransf)}</span></div>
          </div>
        </div>
      </div>

      {/* Desglose de ingresos */}
      {ingresos > 0 && (()=>{
        const pagosPeriodo = pagos.filter(p=>enRangoPago(p.fecha));
        const porConcepto = {};
        pagosPeriodo.forEach(p => {
          const r = reservas.find(x=>x.id===p.reservaId);
          const concepto = p.concepto || (p.esSena ? "Seña" : "Pago de reserva");
          porConcepto[concepto] = (porConcepto[concepto] || 0) + p.monto;
        });
        const conceptoEntries = Object.entries(porConcepto).sort((a,b)=>b[1]-a[1]);

        const porReserva = {};
        pagosPeriodo.forEach(p => {
          const r = reservas.find(x=>x.id===p.reservaId);
          if (!r) return;
          const c = clientes.find(x=>x.id===r.clienteId);
          const key = r.id;
          if (!porReserva[key]) porReserva[key] = { nombre: c ? (c.nombre+" "+c.apellido).trim() : "Sin cliente", fecha: r.fecha, total: 0, pagos: [], ultimoPago: p.fecha };
          porReserva[key].total += p.monto;
          porReserva[key].pagos.push({ monto: p.monto, fecha: p.fecha, metodo: p.metodo, concepto: p.concepto || (p.esSena ? "Seña" : "Pago") });
          if (!porReserva[key].ultimoPago || p.fecha > porReserva[key].ultimoPago) porReserva[key].ultimoPago = p.fecha;
        });
        const reservaEntries = Object.values(porReserva).sort((a,b)=>(b.ultimoPago||"").localeCompare(a.ultimoPago||""));

        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div onClick={()=>setDesgloseOpen(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase"}}>💰 Desglose de ingresos</div>
              <span style={{fontSize:14,color:"var(--qb-text2)",transition:"transform 0.2s",transform:desgloseOpen?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
            </div>
            {!desgloseOpen && <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:4}}>Tocá para ver el detalle de los cobros</div>}

            {desgloseOpen && <>
              <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:8,marginBottom:12}}>¿De dónde viene la plata cobrada este período?</div>

              {conceptoEntries.length > 1 && <>
                <div style={{fontSize:10,fontWeight:700,color:"var(--qb-text2)",marginBottom:6}}>POR CONCEPTO</div>
                {conceptoEntries.map(([concepto, monto]) => {
                  const pct = Math.round((monto / ingresos) * 100);
                  return (
                    <div key={concepto} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{flex:1,fontSize:12,color:"var(--qb-text)"}}>{concepto}</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#16A34A"}}>{fmtCurrency(monto)}</div>
                      <div style={{width:36,fontSize:10,color:"var(--qb-text2)",textAlign:"right"}}>{pct}%</div>
                    </div>
                  );
                })}
                <div style={{borderTop:"1px solid var(--qb-border)",marginTop:8,marginBottom:10}} />
              </>}

              <div style={{fontSize:10,fontWeight:700,color:"var(--qb-text2)",marginBottom:6}}>POR RESERVA</div>
              {reservaEntries.map((re,i) => (
                <div key={i} style={{padding:"8px 0",borderBottom:i<reservaEntries.length-1?"1px solid var(--qb-border-light)":"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--qb-text)"}}>{re.nombre}</div>
                      <div style={{fontSize:10,color:"var(--qb-text2)"}}>Cobro: {fmtDate(re.pagos[re.pagos.length-1]?.fecha)}{re.fecha ? ` · Evento: ${fmtDate(re.fecha)}` : ""}</div>
                    </div>
                    <div style={{fontWeight:800,fontSize:14,color:"#16A34A"}}>{fmtCurrency(re.total)}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                    {re.pagos.map((p,j) => (
                      <span key={j} style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"var(--qb-cobro-bg)",color:"#16A34A",border:"1px solid var(--qb-cobro-border)"}}>
                        {p.concepto} · {fmtCurrency(p.monto)} · {p.metodo==="Efectivo"?"💵":"🏦"} · {fmtDate(p.fecha)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>}
          </div>
        );
      })()}

      <div style={{...card,padding:"14px 16px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div><div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:4}}>Ganancia Neta</div>
          <div style={{fontSize:28,fontWeight:800,fontFamily:"'Playfair Display',serif",color:ganancia>=0?"#16A34A":"#DC2626"}}>{fmtCurrency(Math.abs(ganancia))}</div></div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:"var(--qb-text2)",marginBottom:4}}>Caja física</div>
            <div style={{fontWeight:700,fontSize:16,color:cajaFisica>=0?"#16A34A":"#DC2626"}}>{fmtCurrency(cajaFisica)}</div>
            <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:6,marginBottom:2}}>Cuentas banco</div>
            <div style={{fontWeight:700,fontSize:16,color:cuentas>=0?"#16A34A":"#DC2626"}}>{fmtCurrency(cuentas)}</div>
          </div>
        </div>
      </div>

      {/* Rendimiento del mes: eventos realizados y su facturación */}
      {monthRes.length>0 && (()=>{
        const facturacion = monthRes.reduce((s,r)=>s+r.montoPactado+getTotalExtras(r.id,extrasReserva),0);
        const cobrado = monthRes.reduce((s,r)=>s+pagos.filter(p=>p.reservaId===r.id).reduce((ss,p)=>ss+p.monto,0),0);
        const pendiente = facturacion - cobrado;
        const promedio = monthRes.length>0 ? Math.round(facturacion/monthRes.length) : 0;
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10,border:"1.5px solid #D4A574"}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:10}}>🏠 Rendimiento del período</div>
            <div style={{fontSize:11,color:"var(--qb-text2)",marginBottom:12}}>Eventos que ocurrieron en este período y cuánto facturaron</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div style={{background:"var(--qb-bg-card-alt)",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid var(--qb-border)"}}>
                <div style={{fontSize:24,fontWeight:800,color:"var(--qb-accent)"}}>{monthRes.length}</div>
                <div style={{fontSize:10,color:"var(--qb-text2)",fontWeight:600}}>Alquileres</div>
              </div>
              <div style={{background:"var(--qb-cobro-bg)",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid var(--qb-cobro-border)"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#16A34A"}}>{fmtCurrency(facturacion)}</div>
                <div style={{fontSize:10,color:"#16A34A",fontWeight:600}}>Facturación total</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div style={{background:"#EFF6FF",borderRadius:10,padding:"8px 6px",textAlign:"center",border:"1px solid #BFDBFE"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#2563EB"}}>{fmtCurrency(promedio)}</div>
                <div style={{fontSize:9,color:"#2563EB",fontWeight:600}}>Promedio</div>
              </div>
              <div style={{background:"var(--qb-cobro-bg)",borderRadius:10,padding:"8px 6px",textAlign:"center",border:"1px solid var(--qb-cobro-border)"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#16A34A"}}>{fmtCurrency(cobrado)}</div>
                <div style={{fontSize:9,color:"#16A34A",fontWeight:600}}>Cobrado</div>
              </div>
              <div style={{background:pendiente>0?"#FEF3C7":"var(--qb-cobro-bg)",borderRadius:10,padding:"8px 6px",textAlign:"center",border:`1px solid ${pendiente>0?"#FCD34D":"var(--qb-cobro-border)"}`}}>
                <div style={{fontSize:14,fontWeight:800,color:pendiente>0?"#D97706":"#16A34A"}}>{fmtCurrency(pendiente)}</div>
                <div style={{fontSize:9,color:pendiente>0?"#D97706":"#16A34A",fontWeight:600}}>Pendiente</div>
              </div>
            </div>
          </div>
        );
      })()}

      {isFutureMonth ? (
        <div style={{...card,padding:"14px 16px",marginBottom:10,border:"2px solid #C4602B"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--qb-accent)",textTransform:"uppercase",marginBottom:4}}>📈 Proyección de caja</div>
          <div style={{fontSize:24,fontWeight:800,color:"var(--qb-accent)",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(proyeccion)}</div>
          <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:4}}>Saldo pendiente de {monthRes.length} reserva{monthRes.length!==1?"s":""} confirmadas</div>
        </div>
      ) : porCobrar>0 && (
        <div style={{...card,padding:"14px 16px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:4}}>⚠️ Por cobrar</div>
          <div style={{fontSize:24,fontWeight:800,color:"#D97706",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(porCobrar)}</div>
        </div>
      )}

      {/* Dashboard de ocupación — por días */}
      {modo==="mes"&&(()=>{
        const bloqs=bloqueos||[];
        const year=selYear, month=selMonth;
        const daysInMonth=new Date(year,month+1,0).getDate();
        const prefix=selKey;
        const occupiedDays=new Set();
        reservas.filter(r=>r.fecha?.startsWith(prefix)&&r.estado!=="cancelada"&&r.estado!=="visita").forEach(r=>{
          occupiedDays.add(r.fecha);
        });
        bloqs.filter(b=>b.fecha?.startsWith(prefix)).forEach(b=>{
          occupiedDays.add(b.fecha);
        });
        const occupiedCount=occupiedDays.size;
        const pct=daysInMonth>0?Math.round((occupiedCount/daysInMonth)*100):0;
        const libre=daysInMonth-occupiedCount;
        const prevYear=month===0?year-1:year;
        const prevMonth=month===0?11:month-1;
        const prevPrefix=`${prevYear}-${String(prevMonth+1).padStart(2,"0")}`;
        const prevDays=new Date(prevYear,prevMonth+1,0).getDate();
        const prevOcc=new Set();
        reservas.filter(r=>r.fecha?.startsWith(prevPrefix)&&r.estado!=="cancelada"&&r.estado!=="visita").forEach(r=>{
          prevOcc.add(r.fecha);
        });
        bloqs.filter(b=>b.fecha?.startsWith(prevPrefix)).forEach(b=>{
          prevOcc.add(b.fecha);
        });
        const prevPct=prevDays>0?Math.round((prevOcc.size/prevDays)*100):0;
        const diff=pct-prevPct;
        const prevYearSameMonth=`${year-1}-${String(month+1).padStart(2,"0")}`;
        const yoyDays=new Date(year-1,month+1,0).getDate();
        const yoyOcc=new Set();
        reservas.filter(r=>r.fecha?.startsWith(prevYearSameMonth)&&r.estado!=="cancelada"&&r.estado!=="visita").forEach(r=>{
          yoyOcc.add(r.fecha);
        });
        const yoyPct=yoyDays>0?Math.round((yoyOcc.size/yoyDays)*100):0;
        const hasYoy=yoyOcc.size>0;
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:10}}>📊 Ocupación del mes</div>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
              <div style={{position:"relative",width:72,height:72,flexShrink:0}}>
                <svg viewBox="0 0 36 36" style={{width:72,height:72,transform:"rotate(-90deg)"}}>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--qb-border)" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={pct>=70?"#16A34A":pct>=40?"#D97706":"#DC2626"} strokeWidth="3"
                    strokeDasharray={`${pct*0.974} 100`} strokeLinecap="round"/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:18,color:"var(--qb-text)"}}>{pct}%</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--qb-text)",marginBottom:4}}>{occupiedCount} de {daysInMonth} días</div>
                <div style={{fontSize:12,color:"#16A34A",fontWeight:600}}>{libre} días libres</div>
                {diff!==0&&<div style={{fontSize:11,color:diff>0?"#16A34A":"#DC2626",marginTop:4,fontWeight:600}}>
                  {diff>0?"▲":"▼"} {Math.abs(diff)}% vs mes anterior ({prevPct}%)
                </div>}
                {hasYoy&&<div style={{fontSize:11,color:"#7C3AED",marginTop:2,fontWeight:600}}>
                  📅 {MONTHS[month]} {year-1}: {yoyPct}% {pct>yoyPct?`(+${pct-yoyPct}%)`:`(${pct-yoyPct}%)`}
                </div>}
              </div>
            </div>
            <div style={{height:8,background:"var(--qb-border)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:pct>=70?"#16A34A":pct>=40?"#D97706":"#DC2626",borderRadius:4,transition:"width .3s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"var(--qb-text2)"}}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
        );
      })()}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        {avgLead!==null&&(
          <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Anticipación promedio</div>
            <div style={{fontSize:28,fontWeight:800,color:"var(--qb-accent)",fontFamily:"'Playfair Display',serif"}}>{avgLead}</div>
            <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>días de anticipación</div>
          </div>
        )}
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:4}}>Reservas por turno</div>
          <div style={{fontSize:20,fontWeight:800,color:"var(--qb-accent)",fontFamily:"'Playfair Display',serif",marginBottom:8}}>{monthRes.length} <span style={{fontSize:12,color:"var(--qb-text2)",fontWeight:400}}>total mes</span></div>
          {(()=>{
            const porT={};
            monthRes.forEach(r=>{ const k=getTurnoNombre(r); porT[k]=(porT[k]||0)+1; });
            return Object.entries(porT).sort((a,b)=>b[1]-a[1]).map(([nombre,cant])=>(
              <div key={nombre} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,color:"var(--qb-text)"}}>📌 {nombre}</span>
                <span style={{fontWeight:700,fontSize:14,color:"var(--qb-accent)"}}>{cant}</span>
              </div>
            ));
          })()}
          {ticketPromedio!==null&&(
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid var(--qb-border)"}}>
              <div style={{fontSize:11,color:"var(--qb-text2)"}}>Ticket promedio</div>
              <div style={{fontWeight:800,fontSize:16,color:"var(--qb-text)"}}>{fmtCurrency(ticketPromedio)}</div>
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
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:8}}>🎉 Por tipo de evento</div>
            {items.map(([tipo,cant])=>(
              <div key={tipo} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,color:"var(--qb-text)"}}>{tipo}</span>
                <span style={{fontWeight:700,fontSize:14,color:"#7C3AED"}}>{cant}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {topCats.length>0&&(
        <div style={{...card,padding:"14px 16px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:10}}>🏆 Top 3 gastos del mes</div>
          {topCats.map((c,i)=>(
            <div key={c.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<topCats.length-1?"1px solid var(--qb-border-light)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:20,height:20,borderRadius:10,background:["var(--qb-accent)","#D97706","#6B7280"][i],display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:11,fontWeight:800}}>{i+1}</span>
                <span style={{fontSize:13,fontWeight:600,color:"var(--qb-text)"}}>{c.name}</span>
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
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:10}}>🎉 Extras contratados</div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:1,background:"var(--qb-cobro-bg)",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid var(--qb-cobro-border)"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#16A34A"}}>{fmtCurrency(totalExtrasIngreso)}</div>
                <div style={{fontSize:10,color:"#16A34A",fontWeight:600}}>Ingreso extras</div>
              </div>
              <div style={{flex:1,background:"#EFF6FF",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid #BFDBFE"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#2563EB"}}>{pctExtras}%</div>
                <div style={{fontSize:10,color:"#2563EB",fontWeight:600}}>{resConExtras} de {monthRes.length} sumaron</div>
              </div>
            </div>
            {items.map(function(it){return (
              <div key={it.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--qb-border)",fontSize:13}}>
                <span>{it.name}</span>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#16A34A",fontWeight:600}}>{fmtCurrency(it.ingresos)}</span>
                  <span style={{fontWeight:700,color:"var(--qb-accent)",minWidth:50,textAlign:"right"}}>{it.total}x</span>
                </div>
              </div>
            );})}
          </div>
        );
      })()}

      {/* Funnel de conversión de visitas */}
      {(()=>{
        const allPeriod=reservas.filter(r=>r.fecha&&enRango(r.fecha));
        if(allPeriod.length===0) return null;
        const visitasAll=allPeriod.filter(r=>r.estado==="visita"||r.fechaVisita);
        const totalVisitas=visitasAll.length;
        if(totalVisitas===0) return null;
        const concretaron=visitasAll.filter(r=>["pendiente","senada","confirmada","finalizada"].includes(r.estado)).length;
        const senaron=visitasAll.filter(r=>["senada","confirmada","finalizada"].includes(r.estado)).length;
        const confirmaron=visitasAll.filter(r=>["confirmada","finalizada"].includes(r.estado)).length;
        const pendientes=visitasAll.filter(r=>r.estado==="visita").length;
        const canceladas=visitasAll.filter(r=>r.estado==="cancelada").length;
        const steps=[
          {label:"Visitas",count:totalVisitas,color:"#EC4899"},
          {label:"Reservaron",count:concretaron,color:"#3B82F6"},
          {label:"Señaron",count:senaron,color:"#D97706"},
          {label:"Confirmadas",count:confirmaron,color:"#16A34A"},
        ];
        return (
          <div style={{...card,padding:"14px 16px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:12}}>📊 Conversión de visitas</div>
            <div style={{fontSize:11,color:"var(--qb-text2)",marginBottom:12}}>Solo reservas que arrancaron como visita</div>
            {steps.map((step,i)=>{
              const pct=totalVisitas>0?Math.round((step.count/totalVisitas)*100):0;
              const prevCount=i>0?steps[i-1].count:null;
              const convRate=prevCount&&prevCount>0?Math.round((step.count/prevCount)*100):null;
              return (
                <div key={step.label} style={{marginBottom:i<steps.length-1?8:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:600,color:"var(--qb-text)"}}>{step.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {convRate!==null&&<span style={{fontSize:10,color:convRate>=50?"#16A34A":"#DC2626",fontWeight:600}}>{convRate}%</span>}
                      <span style={{fontWeight:800,fontSize:14,color:step.color}}>{step.count}</span>
                    </div>
                  </div>
                  <div style={{height:8,background:"var(--qb-border)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:step.color,borderRadius:4,transition:"width .3s",minWidth:step.count>0?4:0}}/>
                  </div>
                </div>
              );
            })}
            {(pendientes>0||canceladas>0)&&(
              <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid var(--qb-border)",display:"flex",gap:16}}>
                {pendientes>0&&<div style={{fontSize:12}}>
                  <span style={{color:"var(--qb-text2)",fontWeight:600}}>Pendientes: </span>
                  <span style={{fontWeight:800,color:"#EC4899"}}>{pendientes}</span>
                </div>}
                {canceladas>0&&<div style={{fontSize:12}}>
                  <span style={{color:"#DC2626",fontWeight:600}}>Canceladas: </span>
                  <span style={{fontWeight:800,color:"#DC2626"}}>{canceladas}</span>
                </div>}
              </div>
            )}
          </div>
        );
      })()}

      {/* Top clientes del mes */}
      {topClientes.length>0&&(
        <div style={{...card,padding:"14px 16px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:10}}>⭐ Top clientes del mes</div>
          {topClientes.map((c,i)=>(
            <div key={c.nombre} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<topClientes.length-1?"1px solid var(--qb-border-light)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{width:22,height:22,borderRadius:11,background:["var(--qb-accent)","#D97706","#6B7280"][i],display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
                <span style={{fontSize:13,fontWeight:600,color:"var(--qb-text)"}}>{c.nombre}</span>
              </div>
              <span style={{fontWeight:800,color:"#16A34A",fontSize:14}}>{fmtCurrency(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{...card,padding:"14px 16px",marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:12}}>📊 Últimos 6 meses</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100,marginBottom:8}}>
          {last6.map((d,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:80}}>
                <div style={{flex:1,background:"#16A34A",borderRadius:"3px 3px 0 0",height:Math.max(4,Math.round((d.ingresos/maxBar)*76))+"px"}} />
                <div style={{flex:1,background:"#DC2626",borderRadius:"3px 3px 0 0",height:Math.max(4,Math.round((d.gastos/maxBar)*76))+"px"}} />
              </div>
              <div style={{fontSize:9,color:"var(--qb-text2)",fontWeight:600}}>{d.mes}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"var(--qb-text2)"}}><div style={{width:10,height:10,background:"#16A34A",borderRadius:2}} />Ingresos</div>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"var(--qb-text2)"}}><div style={{width:10,height:10,background:"#DC2626",borderRadius:2}} />Gastos</div>
        </div>
      </div>

      {(()=>{
        const consRango = (consultas||[]).filter(c => enRango(c.fecha));
        const totalCons = consRango.reduce((s,c) => s + c.cantidad, 0);
        if (totalCons === 0) return null;
        const reservasRango = reservas.filter(r => enRango(r.fecha) && r.estado !== "cancelada" && r.estado !== "visita").length;
        const conversion = totalCons > 0 ? Math.round((reservasRango / totalCons) * 100) : 0;
        const porCanal = {};
        consRango.forEach(c => { porCanal[c.canal] = (porCanal[c.canal] || 0) + c.cantidad; });
        const canales = Object.entries(porCanal).sort((a,b) => b[1] - a[1]);
        const gastoPub = gastos.filter(g => enRangoPago(g.fecha) && g.categoria === "Publicidad").reduce((s,g) => s + g.monto, 0);
        const costoPorConsulta = totalCons > 0 && gastoPub > 0 ? Math.round(gastoPub / totalCons) : 0;
        const costoPorReserva = reservasRango > 0 && gastoPub > 0 ? Math.round(gastoPub / reservasRango) : 0;

        return (
          <div style={{...card,padding:"14px 16px",marginTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:12}}>📩 Embudo de consultas</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
              <div style={{textAlign:"center",background:"#E0F2FE",borderRadius:10,padding:"10px 6px",border:"1px solid #BAE6FD"}}>
                <div style={{fontSize:22,fontWeight:800,color:"#0284C7"}}>{totalCons}</div>
                <div style={{fontSize:10,fontWeight:600,color:"#0284C7"}}>Consultas</div>
              </div>
              <div style={{textAlign:"center",background:"var(--qb-cobro-bg)",borderRadius:10,padding:"10px 6px",border:"1px solid var(--qb-cobro-border)"}}>
                <div style={{fontSize:22,fontWeight:800,color:"#16A34A"}}>{reservasRango}</div>
                <div style={{fontSize:10,fontWeight:600,color:"#16A34A"}}>Reservas</div>
              </div>
              <div style={{textAlign:"center",background:"var(--qb-bg-card-alt)",borderRadius:10,padding:"10px 6px",border:"1px solid var(--qb-border)"}}>
                <div style={{fontSize:22,fontWeight:800,color:"var(--qb-accent)"}}>{conversion}%</div>
                <div style={{fontSize:10,fontWeight:600,color:"var(--qb-accent)"}}>Conversión</div>
              </div>
            </div>
            {gastoPub > 0 && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{textAlign:"center",background:"#FCE7F3",borderRadius:10,padding:"8px 6px",border:"1px solid #FBCFE8"}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#EC4899"}}>{fmtCurrency(costoPorConsulta)}</div>
                  <div style={{fontSize:10,fontWeight:600,color:"#EC4899"}}>Costo/consulta</div>
                </div>
                <div style={{textAlign:"center",background:"#FCE7F3",borderRadius:10,padding:"8px 6px",border:"1px solid #FBCFE8"}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#EC4899"}}>{fmtCurrency(costoPorReserva)}</div>
                  <div style={{fontSize:10,fontWeight:600,color:"#EC4899"}}>Costo/reserva</div>
                </div>
              </div>
            )}
            <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",marginBottom:8}}>POR CANAL</div>
            {canales.map(([canal, cnt]) => {
              const pct = Math.round((cnt / totalCons) * 100);
              const resCanal = reservas.filter(r => {
                if (!enRango(r.fecha) || r.estado === "cancelada" || r.estado === "visita") return false;
                const cli = clientes.find(x => x.id === r.clienteId);
                return cli?.origen === canal;
              }).length;
              return (
                <div key={canal} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:12,color:"var(--qb-text)"}}>{canal}</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#0284C7"}}>{cnt} consultas → {resCanal} reservas</span>
                  </div>
                  <div style={{height:6,background:"var(--qb-border)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:"#0284C7",borderRadius:3}} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      </>}

      {subtab==="captacion" && (()=>{
        const DIAS_SEMANA = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
        const allConFecha = reservas.filter(r => (r.creadoEn || r.fechaCreacion) && r.estado !== "cancelada" && r.estado !== "visita");
        const conFecha = allConFecha.filter(r => {
          if (!captDesde && !captHasta) return true;
          const creado = (r.creadoEn || r.fechaCreacion || "").slice(0, 10);
          if (!creado) return true;
          if (captDesde && creado < captDesde) return false;
          if (captHasta && creado > captHasta) return false;
          return true;
        });
        const hayFiltro = !!(captDesde || captHasta);

        const porDia = Array(7).fill(0);
        conFecha.forEach(r => {
          const d = new Date(r.creadoEn || r.fechaCreacion + "T12:00:00");
          if (!isNaN(d)) porDia[d.getDay()]++;
        });
        const maxDia = Math.max(...porDia, 1);
        const mejorDia = porDia.indexOf(Math.max(...porDia));

        const porHora = Array(24).fill(0);
        conFecha.forEach(r => {
          if (!r.creadoEn) return;
          const d = new Date(r.creadoEn);
          if (!isNaN(d)) porHora[d.getHours()]++;
        });
        const maxHora = Math.max(...porHora, 1);
        const mejorHora = porHora.indexOf(Math.max(...porHora));

        const hoy = new Date();
        const mesesData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
          const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          const count = conFecha.filter(r => (r.creadoEn || r.fechaCreacion || "").startsWith(prefix)).length;
          mesesData.push({ label: MONTHS[d.getMonth()].slice(0,3), count });
        }
        const maxMes = Math.max(...mesesData.map(m => m.count), 1);

        const anticipaciones = conFecha.filter(r => r.fecha && (r.creadoEn || r.fechaCreacion)).map(r => {
          const creado = new Date(r.creadoEn || r.fechaCreacion + "T12:00:00");
          const evento = new Date(r.fecha + "T12:00:00");
          return Math.round((evento - creado) / (1000 * 60 * 60 * 24));
        }).filter(d => d >= 0 && d < 365);
        const promedioAnticipacion = anticipaciones.length > 0 ? Math.round(anticipaciones.reduce((s, d) => s + d, 0) / anticipaciones.length) : 0;

        const porOrigen = {};
        conFecha.forEach(r => {
          const cli = clientes.find(c => c.id === r.clienteId);
          const origen = cli?.origen || "Sin definir";
          porOrigen[origen] = (porOrigen[origen] || 0) + 1;
        });
        const origenEntries = Object.entries(porOrigen).sort((a, b) => b[1] - a[1]);
        const maxOrigen = origenEntries.length > 0 ? origenEntries[0][1] : 1;

        return <>
          <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
            <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 10}}>🔍 Filtrar por fecha de creación</div>
            <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
              <input type="date" value={captDesde} onChange={e => setCaptDesde(e.target.value)}
                style={{flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--qb-border)", fontSize: 13, fontFamily: "inherit", background: "var(--qb-input-bg)", color: "var(--qb-text)"}} />
              <span style={{fontSize: 12, color: "var(--qb-text2)"}}>→</span>
              <input type="date" value={captHasta} onChange={e => setCaptHasta(e.target.value)}
                style={{flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--qb-border)", fontSize: 13, fontFamily: "inherit", background: "var(--qb-input-bg)", color: "var(--qb-text)"}} />
            </div>
            {hayFiltro && (
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8}}>
                <span style={{fontSize: 11, color: "var(--qb-accent)", fontWeight: 600}}>{conFecha.length} reserva{conFecha.length !== 1 ? "s" : ""} creada{conFecha.length !== 1 ? "s" : ""} en este período</span>
                <button onClick={() => { setCaptDesde(""); setCaptHasta(""); }} style={{fontSize: 11, color: "var(--qb-text2)", background: "var(--qb-muted)", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600}}>Limpiar</button>
              </div>
            )}
          </div>

          <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
            <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 12}}>📊 Resumen de captación{hayFiltro ? " (filtrado)" : ""}</div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12}}>
              <div style={{background: "#EFF6FF", borderRadius: 10, padding: "12px", textAlign: "center", border: "1px solid #BFDBFE"}}>
                <div style={{fontSize: 22, fontWeight: 800, color: "#2563EB"}}>{conFecha.length}</div>
                <div style={{fontSize: 10, color: "#2563EB", fontWeight: 600}}>Reservas con fecha</div>
              </div>
              <div style={{background: "var(--qb-cobro-bg)", borderRadius: 10, padding: "12px", textAlign: "center", border: "1px solid var(--qb-cobro-border)"}}>
                <div style={{fontSize: 22, fontWeight: 800, color: "#16A34A"}}>{promedioAnticipacion} días</div>
                <div style={{fontSize: 10, color: "#16A34A", fontWeight: 600}}>Anticipación promedio</div>
              </div>
            </div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8}}>
              <div style={{background: "var(--qb-bg-card-alt)", borderRadius: 10, padding: "12px", textAlign: "center", border: "1px solid var(--qb-border)"}}>
                <div style={{fontSize: 16, fontWeight: 800, color: "var(--qb-accent)"}}>{DIAS_SEMANA[mejorDia]}</div>
                <div style={{fontSize: 10, color: "var(--qb-text2)", fontWeight: 600}}>Mejor día para publicar</div>
              </div>
              <div style={{background: "var(--qb-bg-card-alt)", borderRadius: 10, padding: "12px", textAlign: "center", border: "1px solid var(--qb-border)"}}>
                <div style={{fontSize: 16, fontWeight: 800, color: "var(--qb-accent)"}}>{mejorHora}:00 hs</div>
                <div style={{fontSize: 10, color: "var(--qb-text2)", fontWeight: 600}}>Mejor hora para publicar</div>
              </div>
            </div>
          </div>

          <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
            <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 10}}>📅 Día que más reservan</div>
            <div style={{fontSize: 11, color: "var(--qb-text2)", marginBottom: 12}}>¿Qué día de la semana la gente hace más reservas?</div>
            {DIAS_SEMANA.map((dia, i) => {
              const pct = Math.round((porDia[i] / maxDia) * 100);
              const esMejor = i === mejorDia && porDia[i] > 0;
              return (
                <div key={dia} style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
                  <div style={{width: 70, fontSize: 12, fontWeight: esMejor ? 800 : 500, color: esMejor ? "var(--qb-accent)" : "var(--qb-text)"}}>{dia.slice(0,3)}</div>
                  <div style={{flex: 1, height: 18, background: "var(--qb-border)", borderRadius: 4, overflow: "hidden"}}>
                    <div style={{height: "100%", width: pct + "%", background: esMejor ? "var(--qb-accent)" : "var(--qb-accent-light)", borderRadius: 4, transition: "width 0.3s"}} />
                  </div>
                  <div style={{width: 30, fontSize: 12, fontWeight: 700, color: esMejor ? "var(--qb-accent)" : "var(--qb-text2)", textAlign: "right"}}>{porDia[i]}</div>
                </div>
              );
            })}
          </div>

          <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
            <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 10}}>🕐 Hora que más reservan</div>
            <div style={{fontSize: 11, color: "var(--qb-text2)", marginBottom: 12}}>¿A qué hora del día la gente crea la reserva?</div>
            <div style={{display: "flex", alignItems: "flex-end", gap: 2, height: 100}}>
              {porHora.map((count, h) => {
                const pct = maxHora > 0 ? (count / maxHora) * 100 : 0;
                const esMejor = h === mejorHora && count > 0;
                return (
                  <div key={h} style={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2}}>
                    <div style={{width: "100%", height: Math.max(pct, 2), background: esMejor ? "var(--qb-accent)" : count > 0 ? "var(--qb-accent-light)" : "var(--qb-border)", borderRadius: "3px 3px 0 0", transition: "height 0.3s"}} />
                  </div>
                );
              })}
            </div>
            <div style={{display: "flex", gap: 2, marginTop: 4}}>
              {porHora.map((_, h) => (
                <div key={h} style={{flex: 1, textAlign: "center", fontSize: 7, color: h === mejorHora ? "var(--qb-accent)" : "var(--qb-text2)", fontWeight: h === mejorHora ? 800 : 400}}>{h % 3 === 0 ? h : ""}</div>
              ))}
            </div>
          </div>

          {(()=>{
            const tercios = [{label:"Principio (1-10)",count:0},{label:"Mediados (11-20)",count:0},{label:"Fin (21-31)",count:0}];
            conFecha.forEach(r => {
              const d = new Date(r.creadoEn || r.fechaCreacion + "T12:00:00");
              if (isNaN(d)) return;
              const day = d.getDate();
              if (day <= 10) tercios[0].count++;
              else if (day <= 20) tercios[1].count++;
              else tercios[2].count++;
            });
            const maxT = Math.max(...tercios.map(t=>t.count), 1);
            const mejorTercio = tercios.reduce((best, t) => t.count > best.count ? t : best, tercios[0]);
            return conFecha.length > 0 ? (
              <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
                <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 10}}>📆 Momento del mes</div>
                <div style={{fontSize: 11, color: "var(--qb-text2)", marginBottom: 12}}>¿En qué parte del mes la gente reserva más?</div>
                {tercios.map(t => {
                  const pct = Math.round((t.count / maxT) * 100);
                  const esMejor = t === mejorTercio && t.count > 0;
                  return (
                    <div key={t.label} style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 8}}>
                      <div style={{width: 110, fontSize: 12, fontWeight: esMejor ? 800 : 500, color: esMejor ? "var(--qb-accent)" : "var(--qb-text)"}}>{t.label}</div>
                      <div style={{flex: 1, height: 22, background: "var(--qb-border)", borderRadius: 4, overflow: "hidden"}}>
                        <div style={{height: "100%", width: pct + "%", background: esMejor ? "var(--qb-accent)" : "var(--qb-accent-light)", borderRadius: 4, transition: "width 0.3s"}} />
                      </div>
                      <div style={{width: 30, fontSize: 13, fontWeight: 700, color: esMejor ? "var(--qb-accent)" : "var(--qb-text2)", textAlign: "right"}}>{t.count}</div>
                    </div>
                  );
                })}
                <div style={{marginTop: 8, padding: "8px 12px", background: "var(--qb-bg-card-alt)", borderRadius: 8, border: "1px solid var(--qb-border)", fontSize: 12, color: "var(--qb-text3)"}}>
                  💡 La gente reserva más a <strong style={{color: "var(--qb-accent)"}}>{mejorTercio.label.toLowerCase()}</strong> de mes
                </div>
              </div>
            ) : null;
          })()}

          <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
            <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 10}}>📈 Reservas creadas por mes</div>
            <div style={{display: "flex", alignItems: "flex-end", gap: 6, height: 100}}>
              {mesesData.map((m, i) => {
                const pct = maxMes > 0 ? (m.count / maxMes) * 100 : 0;
                return (
                  <div key={i} style={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4}}>
                    <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-accent)"}}>{m.count}</div>
                    <div style={{width: "100%", height: Math.max(pct, 4), background: "var(--qb-accent)", borderRadius: 4, transition: "height 0.3s"}} />
                    <div style={{fontSize: 10, color: "var(--qb-text2)", fontWeight: 600}}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {origenEntries.length > 0 && (
            <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
              <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 10}}>📣 Canal de origen</div>
              <div style={{fontSize: 11, color: "var(--qb-text2)", marginBottom: 12}}>¿De dónde vienen los clientes que reservan?</div>
              {origenEntries.map(([origen, count]) => {
                const pct = Math.round((count / maxOrigen) * 100);
                return (
                  <div key={origen} style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
                    <div style={{width: 100, fontSize: 12, fontWeight: 600, color: "var(--qb-text)"}}>{origen}</div>
                    <div style={{flex: 1, height: 18, background: "var(--qb-border)", borderRadius: 4, overflow: "hidden"}}>
                      <div style={{height: "100%", width: pct + "%", background: "#7C3AED", borderRadius: 4}} />
                    </div>
                    <div style={{width: 30, fontSize: 12, fontWeight: 700, color: "#7C3AED", textAlign: "right"}}>{count}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Publicidad: formulario de carga mensual ── */}
          <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: pubFormOpen ? 12 : 0}}>
              <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase"}}>📣 Conversaciones publicitarias</div>
              <button onClick={() => setPubFormOpen(v => !v)} style={{
                border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                background: pubFormOpen ? "var(--qb-border)" : "var(--qb-accent)", color: pubFormOpen ? "var(--qb-text2)" : "#fff",
                padding: "5px 12px", borderRadius: 6,
              }}>{pubFormOpen ? "Cerrar" : "Cargar datos"}</button>
            </div>
            {pubFormOpen && (
              <div>
                <div style={{marginBottom: 10}}>
                  <label style={{fontSize: 11, color: "var(--qb-text2)", fontWeight: 600}}>Mes</label>
                  <input type="month" value={pubMes} onChange={e => setPubMes(e.target.value)}
                    style={{display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--qb-border)", background: "var(--qb-bg)", color: "var(--qb-text)", fontFamily: "inherit", fontSize: 13}} />
                </div>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10}}>
                  {[
                    {key: "conv_meta", label: "Conv. Meta", prefix: ""},
                    {key: "conv_marketplace", label: "Conv. Marketplace", prefix: ""},
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{fontSize: 10, color: "var(--qb-text2)", fontWeight: 600}}>{f.label}</label>
                      <input type="number" min="0" value={pubForm[f.key] || ""} onChange={e => setPubForm(p => ({...p, [f.key]: Number(e.target.value) || 0}))}
                        placeholder={f.prefix ? "0" : "0"}
                        style={{display: "block", width: "100%", marginTop: 2, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--qb-border)", background: "var(--qb-bg)", color: "var(--qb-text)", fontFamily: "inherit", fontSize: 13}} />
                    </div>
                  ))}
                </div>
                <button onClick={guardarPub} disabled={pubSaving} style={{
                  width: "100%", padding: "10px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 700, background: "var(--qb-accent)", color: "#fff", opacity: pubSaving ? 0.6 : 1,
                }}>{pubSaving ? "Guardando..." : "Guardar"}</button>
              </div>
            )}
          </div>

          {/* ── Análisis de rendimiento publicitario ── */}
          {(() => {
            const enRangoGasto = (f) => {
              if (!f) return false;
              if (!hayFiltro) return true;
              return (!captDesde || f >= captDesde) && (!captHasta || f <= captHasta);
            };
            const gastoMeta = gastos.filter(g => g.categoria === "Publicidad Meta" && enRangoGasto(g.fecha)).reduce((s, g) => s + (g.monto || 0), 0);
            const gastoMkt = gastos.filter(g => g.categoria === "Publicidad Marketplace" && enRangoGasto(g.fecha)).reduce((s, g) => s + (g.monto || 0), 0);
            const gastoTotal = gastoMeta + gastoMkt;

            const mesesEnRango = new Set();
            if (hayFiltro) {
              const desde = captDesde ? captDesde.slice(0,7) : "0000-00";
              const hasta = captHasta ? captHasta.slice(0,7) : "9999-99";
              pubData.forEach(p => { if (p.mes >= desde && p.mes <= hasta) mesesEnRango.add(p.mes); });
            } else {
              pubData.forEach(p => mesesEnRango.add(p.mes));
            }
            const pubEnRango = pubData.filter(p => mesesEnRango.has(p.mes));
            const convMeta = pubEnRango.reduce((s, p) => s + (p.conv_meta_insta || 0) + (p.conv_meta_face || 0), 0);
            const convMkt = pubEnRango.reduce((s, p) => s + (p.conv_marketplace || 0), 0);
            const convTotal = convMeta + convMkt;

            if (gastoTotal === 0 && convTotal === 0) return null;

            const isAdOrigin = (r) => { const cli = clientes.find(c => c.id === r.clienteId); const o = cli?.origen || ""; return ["Publicidad Meta Insta","Publicidad Meta Face","Marketplace"].includes(o); };
            const isMetaO = (r) => { const cli = clientes.find(c => c.id === r.clienteId); return cli?.origen === "Publicidad Meta Insta" || cli?.origen === "Publicidad Meta Face"; };
            const isMktO = (r) => { const cli = clientes.find(c => c.id === r.clienteId); return cli?.origen === "Marketplace"; };

            const allConVisitas = reservas.filter(r => {
              if (!(r.creadoEn || r.fechaCreacion)) return false;
              if (r.estado === "cancelada" && !r.fechaVisita) return false;
              if (!hayFiltro) return true;
              const creado = (r.creadoEn || r.fechaCreacion || "").slice(0, 10);
              if (captDesde && creado < captDesde) return false;
              if (captHasta && creado > captHasta) return false;
              return true;
            });

            const visitasPub = allConVisitas.filter(r => isAdOrigin(r) && (r.estado === "visita" || r.fechaVisita));
            const visitasMeta = visitasPub.filter(r => isMetaO(r));
            const visitasMkt = visitasPub.filter(r => isMktO(r));

            const resPub = conFecha.filter(r => isAdOrigin(r));
            const resMeta = conFecha.filter(r => isMetaO(r));
            const resMkt = conFecha.filter(r => isMktO(r));

            const ingresosPub = resPub.reduce((s, r) => {
              const extras = extrasReserva.filter(e => e.reservaId === r.id).reduce((a, e) => a + (e.precioFinal || e.precio || 0), 0);
              return s + (r.montoPactado || 0) + extras;
            }, 0);

            const fmt = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
            const rangoLabel = hayFiltro ? (captDesde && captHasta ? `${captDesde} al ${captHasta}` : "Filtrado") : "Total acumulado";

            const canales = [
              {nombre: "Meta", gasto: gastoMeta, conv: convMeta, visitas: visitasMeta.length, reservas: resMeta.length, color: "#1877F2"},
              {nombre: "Marketplace", gasto: gastoMkt, conv: convMkt, visitas: visitasMkt.length, reservas: resMkt.length, color: "#00C853"},
            ];

            return (
              <div style={{...card, padding: "14px 16px", marginBottom: 10}}>
                <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 4}}>📈 Rendimiento publicitario</div>
                <div style={{fontSize: 12, color: "var(--qb-text2)", marginBottom: 12}}>{rangoLabel}</div>

                {/* Funnel */}
                <div style={{display: "flex", gap: 4, marginBottom: 14}}>
                  {[
                    {label: "Invertido", value: fmt(gastoTotal), color: "#EF4444"},
                    {label: "Conversaciones", value: String(convTotal), color: "#F59E0B"},
                    {label: "Visitas", value: String(visitasPub.length), color: "#EC4899"},
                    {label: "Reservas", value: String(resPub.length), color: "#10B981"},
                    {label: "Facturado", value: fmt(ingresosPub), color: "#7C3AED"},
                  ].map((step, i) => (
                    <div key={i} style={{flex: 1, textAlign: "center", position: "relative"}}>
                      <div style={{fontSize: 14, fontWeight: 800, color: step.color}}>{step.value}</div>
                      <div style={{fontSize: 8, color: "var(--qb-text2)", fontWeight: 600, marginTop: 2}}>{step.label}</div>
                      {i < 4 && <div style={{position: "absolute", right: -4, top: 4, fontSize: 9, color: "var(--qb-text2)"}}>→</div>}
                    </div>
                  ))}
                </div>

                {/* KPIs */}
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14}}>
                  {[
                    {label: "Costo x conv.", value: convTotal > 0 ? fmt(gastoTotal / convTotal) : "—"},
                    {label: "Conv→Visita", value: convTotal > 0 ? (visitasPub.length / convTotal * 100).toFixed(1) + "%" : "—"},
                    {label: "Visita→Reserva", value: visitasPub.length > 0 ? (resPub.length / visitasPub.length * 100).toFixed(1) + "%" : "—"},
                    {label: "Costo x reserva", value: resPub.length > 0 ? fmt(gastoTotal / resPub.length) : "—"},
                    {label: "Conv. total", value: convTotal > 0 ? (resPub.length / convTotal * 100).toFixed(1) + "%" : "—"},
                    {label: "ROI", value: gastoTotal > 0 ? ((ingresosPub - gastoTotal) / gastoTotal * 100).toFixed(0) + "%" : "—"},
                  ].map((kpi, i) => (
                    <div key={i} style={{background: "var(--qb-bg)", borderRadius: 8, padding: "8px 10px"}}>
                      <div style={{fontSize: 9, color: "var(--qb-text2)", fontWeight: 600}}>{kpi.label}</div>
                      <div style={{fontSize: 14, fontWeight: 800, color: "var(--qb-text)", marginTop: 2}}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Por canal */}
                <div style={{fontSize: 10, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase", marginBottom: 6}}>Detalle por canal</div>
                {canales.map((ch, i) => (
                  <div key={i} style={{padding: "8px 0", borderTop: i > 0 ? "1px solid var(--qb-border)" : "none", display: "flex", alignItems: "center", gap: 8}}>
                    <div style={{width: 8, height: 8, borderRadius: "50%", background: ch.color, flexShrink: 0}} />
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: 12, fontWeight: 700, color: "var(--qb-text)"}}>{ch.nombre}</div>
                      <div style={{fontSize: 10, color: "var(--qb-text2)"}}>
                        {ch.conv} conv → {ch.visitas} visitas → {ch.reservas} reservas
                      </div>
                      <div style={{fontSize: 9, color: "var(--qb-text2)", marginTop: 1}}>
                        {ch.conv > 0 && ch.visitas > 0 ? `${(ch.visitas/ch.conv*100).toFixed(0)}% conv→vis` : ""}
                        {ch.visitas > 0 && ch.reservas > 0 ? ` · ${(ch.reservas/ch.visitas*100).toFixed(0)}% vis→res` : ""}
                      </div>
                    </div>
                    <div style={{textAlign: "right", flexShrink: 0}}>
                      <div style={{fontSize: 12, fontWeight: 700, color: ch.color}}>{fmt(ch.gasto)}</div>
                      {ch.reservas > 0 && <div style={{fontSize: 10, color: "var(--qb-text2)"}}>{fmt(ch.gasto / ch.reservas)}/res</div>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {conFecha.length > 0 && (
            <div style={{...card, overflow: "hidden", marginBottom: 10}}>
              <button onClick={() => setCaptListaOpen(v => !v)} style={{
                width: "100%", padding: "14px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                background: "var(--qb-bg-card)", color: "var(--qb-text)", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{fontSize: 11, fontWeight: 700, color: "var(--qb-text2)", textTransform: "uppercase"}}>📋 Detalle de reservas{hayFiltro ? " (filtrado)" : ""}</span>
                <span style={{fontSize: 12, color: "var(--qb-text2)", fontWeight: 600}}>{captListaOpen ? "▲ Ocultar" : `▼ Ver ${conFecha.length} reserva${conFecha.length !== 1 ? "s" : ""}`}</span>
              </button>
              {captListaOpen && (
                <div style={{padding: "0 16px 14px"}}>
                  {conFecha.sort((a, b) => (b.creadoEn || b.fechaCreacion || "").localeCompare(a.creadoEn || a.fechaCreacion || "")).map(r => {
                    const cli = clientes.find(c => c.id === r.clienteId);
                    const nombre = cli ? ((cli.nombre || "") + " " + (cli.apellido || "")).trim() || "Sin nombre" : "—";
                    const creado = (r.creadoEn || r.fechaCreacion || "").slice(0, 10);
                    const turnoLabel = r.turnoId ? ((turnosRecurso || []).find(t => t.id === r.turnoId)?.nombre || TURNOS[r.turno]?.label || "—") : (TURNOS[r.turno]?.label || "—");
                    const recurso = (recursos || []).find(x => x.id === r.recursoId);
                    return (
                      <div key={r.id} style={{padding: "10px 0", borderTop: "1px solid var(--qb-border)", display: "flex", gap: 10, alignItems: "flex-start"}}>
                        <div style={{minWidth: 54, textAlign: "center"}}>
                          <div style={{fontSize: 11, fontWeight: 700, color: "var(--qb-accent)"}}>{fmtDate(creado)}</div>
                          <div style={{fontSize: 9, color: "var(--qb-text2)", marginTop: 2}}>creada</div>
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{fontWeight: 700, fontSize: 13, color: "var(--qb-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{nombre}</div>
                          <div style={{fontSize: 11, color: "var(--qb-text2)", marginTop: 2}}>
                            📅 {fmtDate(r.fecha)} · {turnoLabel}
                            {r.cantInvitados > 0 ? ` · ${r.cantInvitados} pers.` : ""}
                          </div>
                          {r.tipoEvento && <div style={{fontSize: 11, color: "var(--qb-text2)"}}>🎉 {r.tipoEvento}</div>}
                          {recurso && <div style={{fontSize: 10, color: "var(--qb-text2)"}}>📍 {recurso.nombre}</div>}
                        </div>
                        <div style={{textAlign: "right", flexShrink: 0}}>
                          {cli?.origen && <div style={{fontSize: 10, color: "#7C3AED", fontWeight: 600, background: "rgba(124,58,237,0.08)", padding: "2px 6px", borderRadius: 4}}>{cli.origen}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {conFecha.length === 0 && (
            <div style={{...card, padding: "40px 20px", textAlign: "center"}}>
              <div style={{fontSize: 36, marginBottom: 8}}>📊</div>
              <div style={{fontWeight: 600, color: "var(--qb-text2)"}}>Aún no hay datos de captación</div>
              <div style={{fontSize: 12, color: "var(--qb-text2)", marginTop: 4}}>Las reservas creadas irán apareciendo acá</div>
            </div>
          )}
        </>;
      })()}

      {subtab==="portal" && (
        portalLoading ? (
          <div style={{...card,padding:"40px 20px",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>📱</div>
            <div style={{fontSize:14,color:"var(--qb-text2)",fontWeight:600}}>Cargando datos del portal...</div>
          </div>
        ) : (()=>{
          const portalRes = reservas.filter(r => r.shareToken && r.estado !== "cancelada");
          const totalPortales = portalRes.length;
          const allNoCancel = reservas.filter(r => r.estado !== "cancelada");
          const pctAdopcion = allNoCancel.length > 0 ? Math.round((totalPortales / allNoCancel.length) * 100) : 0;

          const portalIds = new Set(portalRes.map(r => r.id));
          const rsvpData = (portalData?.rsvp || []).filter(r => portalIds.has(r.reserva_id));
          const fotosData = (portalData?.fotos || []).filter(f => portalIds.has(f.reserva_id));
          const eventosData = (portalData?.eventos || []).filter(e => portalIds.has(e.reserva_id));
          const totalRsvps = rsvpData.length;
          const rsvpConfirmados = rsvpData.filter(r => r.estado === "confirmado").length;
          const totalFotos = fotosData.length;

          const countEvento = (tipo) => eventosData.filter(e => e.evento === tipo).length;
          const visitasCliente = countEvento("vista_cliente");
          const visitasInvitado = countEvento("vista_invitado");
          const clicksInstagram = countEvento("click_instagram");
          const sobresAbiertos = countEvento("abrir_sobre");
          const mensajesMural = countEvento("enviar_mural");
          const pwaInstaladas = countEvento("pwa_instalada");
          const pwaAbiertas = countEvento("pwa_abierta");

          const pedidosData = (portalData?.pedidos || []).filter(p => portalIds.has(p.reserva_id));
          const totalPedidos = pedidosData.length;
          const ingresosMercado = pedidosData.reduce((s, p) => s + (p.total || 0), 0);

          const parseSobre = (r) => { try { return typeof r.sobreDigital === "string" ? JSON.parse(r.sobreDigital) : r.sobreDigital; } catch { return null; } };
          const sobresActivos = portalRes.filter(r => parseSobre(r)?.activo).length;

          const secciones = [
            {key:"rsvp",label:"RSVP"},{key:"countdown",label:"Cuenta regresiva"},{key:"mensaje",label:"Mensaje"},
            {key:"amenities",label:"Amenities"},{key:"wifi",label:"WiFi"},{key:"fotos_lugar",label:"Fotos del lugar"},
            {key:"fotos_evento",label:"Fotos del evento"},{key:"sobre_digital",label:"Sobre digital"},
          ];
          const sectionCounts = {};
          secciones.forEach(s => {
            sectionCounts[s.key] = portalRes.filter(r => {
              const ss = r.shareSections;
              if (!ss) return s.key !== "sobre_digital";
              return !!ss[s.key];
            }).length;
          });

          const conFoto = portalRes.filter(r => r.shareHeroUrl).length;
          const conMensaje = portalRes.filter(r => r.shareMessage && r.shareMessage.trim()).length;
          const conNombre = portalRes.filter(r => r.nombreEvento && r.nombreEvento.trim()).length;

          const solicitudes = (tareas || []).filter(t => t.descripcion && t.descripcion.startsWith("📦 Solicitud:"));
          const solicPendientes = solicitudes.filter(t => t.estado === "pendiente");
          const solicPorServicio = {};
          solicitudes.forEach(t => {
            const match = t.descripcion.match(/📦 Solicitud: (.+?) —/);
            if (match) solicPorServicio[match[1]] = (solicPorServicio[match[1]] || 0) + 1;
          });

          const eventosConPortal = portalRes.map(r => {
            const c = clientes.find(x => x.id === r.clienteId);
            const rsvps = rsvpData.filter(rv => rv.reserva_id === r.id);
            const fotos = fotosData.filter(f => f.reserva_id === r.id);
            const evts = eventosData.filter(e => e.reserva_id === r.id);
            const rsvpConf = rsvps.filter(rv => rv.estado === "confirmado").reduce((s, rv) => s + (rv.cantidad || 1), 0);
            const sd = parseSobre(r);
            const visitasInv = evts.filter(e => e.evento === "vista_invitado").length;
            const visitasCli = evts.filter(e => e.evento === "vista_cliente").length;
            const pedidos = pedidosData.filter(p => p.reserva_id === r.id);
            const pedidosTotal = pedidos.reduce((s, p) => s + (p.total || 0), 0);
            const score = visitasInv + visitasCli + rsvps.length + fotos.length + (sd?.activo ? 1 : 0) + (r.shareHeroUrl ? 1 : 0) + (r.shareMessage ? 1 : 0) + pedidos.length;
            return { id:r.id, nombre:r.nombreEvento||r.tipoEvento||"Evento", fecha:r.fecha, cliente:c?(c.nombre+" "+c.apellido).trim():"—", cantInvitados:r.cantInvitados||0, rsvpTotal:rsvps.length, rsvpConfirmados:rsvpConf, fotosCount:fotos.length, sobreActivo:!!sd?.activo, visitasInv, visitasCli, pedidosCount:pedidos.length, pedidosTotal, score };
          }).sort((a, b) => b.score - a.score);

          if (totalPortales === 0) return (
            <div style={{...card,padding:"40px 20px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>📱</div>
              <div style={{fontSize:16,fontWeight:700,color:"var(--qb-text)",marginBottom:8}}>Sin portales activos</div>
              <div style={{fontSize:13,color:"var(--qb-text2)"}}>Cuando generes portales para tus reservas, acá vas a ver las métricas de uso</div>
            </div>
          );

          return <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Portales activos</div>
                <div style={{fontSize:28,fontWeight:800,color:"var(--qb-accent)",fontFamily:"'Playfair Display',serif"}}>{totalPortales}</div>
                <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>{pctAdopcion}% de reservas</div>
              </div>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Visitas clientes</div>
                <div style={{fontSize:28,fontWeight:800,color:"#059669",fontFamily:"'Playfair Display',serif"}}>{visitasCliente}</div>
                <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>aperturas mi-evento</div>
              </div>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Visitas invitados</div>
                <div style={{fontSize:28,fontWeight:800,color:"#7C3AED",fontFamily:"'Playfair Display',serif"}}>{visitasInvitado}</div>
                <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>aperturas link compartido</div>
              </div>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Clicks Instagram</div>
                <div style={{fontSize:28,fontWeight:800,color:"#E1306C",fontFamily:"'Playfair Display',serif"}}>{clicksInstagram}</div>
                <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>desde portales</div>
              </div>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>RSVPs recibidos</div>
                <div style={{fontSize:28,fontWeight:800,color:"#3B82F6",fontFamily:"'Playfair Display',serif"}}>{totalRsvps}</div>
                <div style={{fontSize:11,color:"#16A34A",marginTop:2}}>{rsvpConfirmados} confirmados</div>
              </div>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Fotos subidas</div>
                <div style={{fontSize:28,fontWeight:800,color:"#3B82F6",fontFamily:"'Playfair Display',serif"}}>{totalFotos}</div>
                <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>por invitados</div>
              </div>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Sobres abiertos</div>
                <div style={{fontSize:28,fontWeight:800,color:"#D97706",fontFamily:"'Playfair Display',serif"}}>{sobresAbiertos}</div>
                <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>de {sobresActivos} activos</div>
              </div>
              <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Mensajes mural</div>
                <div style={{fontSize:28,fontWeight:800,color:"#9333EA",fontFamily:"'Playfair Display',serif"}}>{mensajesMural}</div>
                <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>desde sobre digital</div>
              </div>
            </div>

            {(pwaInstaladas > 0 || pwaAbiertas > 0 || totalPedidos > 0) && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                {pwaInstaladas > 0 && (
                  <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>PWA instalada</div>
                    <div style={{fontSize:28,fontWeight:800,color:"#059669",fontFamily:"'Playfair Display',serif"}}>{pwaInstaladas}</div>
                    <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>clientes la guardaron</div>
                  </div>
                )}
                {pwaAbiertas > 0 && (
                  <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>PWA aperturas</div>
                    <div style={{fontSize:28,fontWeight:800,color:"#0891B2",fontFamily:"'Playfair Display',serif"}}>{pwaAbiertas}</div>
                    <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>desde acceso directo</div>
                  </div>
                )}
                {totalPedidos > 0 && (
                  <>
                    <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Pedidos mercado</div>
                      <div style={{fontSize:28,fontWeight:800,color:"var(--qb-accent)",fontFamily:"'Playfair Display',serif"}}>{totalPedidos}</div>
                      <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>desde portales</div>
                    </div>
                    <div style={{...card,padding:"14px 16px",textAlign:"center"}}>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:6}}>Ingresos mercado</div>
                      <div style={{fontSize:28,fontWeight:800,color:"#16A34A",fontFamily:"'Playfair Display',serif"}}>{fmtCurrency(ingresosMercado)}</div>
                      <div style={{fontSize:11,color:"var(--qb-text2)",marginTop:2}}>facturado day-of</div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{...card,padding:"14px 16px",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:12}}>📊 Adopción de funciones</div>
              {secciones.map(s => {
                const cnt = sectionCounts[s.key];
                const pct = Math.round((cnt / totalPortales) * 100);
                return (
                  <div key={s.key} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,color:"var(--qb-text)"}}>{s.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:pct>=50?"#16A34A":pct>=20?"#D97706":"#DC2626"}}>{pct}% ({cnt})</span>
                    </div>
                    <div style={{height:6,background:"var(--qb-border)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:pct+"%",background:pct>=50?"#16A34A":pct>=20?"#D97706":"#DC2626",borderRadius:3,transition:"width .3s"}} />
                    </div>
                  </div>
                );
              })}
              <div style={{borderTop:"1px solid var(--qb-border)",paddingTop:10,marginTop:4}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",marginBottom:8}}>PERSONALIZACIÓN</div>
                {[{l:"Foto de portada",c:conFoto},{l:"Mensaje personalizado",c:conMensaje},{l:"Nombre del evento",c:conNombre}].map(it => {
                  const pct = Math.round((it.c / totalPortales) * 100);
                  return (
                    <div key={it.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:12,color:"var(--qb-text)"}}>{it.l}</span>
                      <span style={{fontSize:12,fontWeight:700,color:pct>=50?"#16A34A":"#D97706"}}>{pct}% ({it.c})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {eventosConPortal.length > 0 && (
              <div style={{...card,padding:"14px 16px",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:12}}>📱 Engagement por evento</div>
                {eventosConPortal.slice(0, 10).map(ev => (
                  <div key={ev.id} style={{padding:"10px 0",borderBottom:"1px solid var(--qb-border)"}}>
                    <div style={{marginBottom:4}}>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--qb-text)"}}>{ev.nombre}</div>
                      <div style={{fontSize:11,color:"var(--qb-text2)"}}>{fmtDate(ev.fecha)} · {ev.cliente}</div>
                    </div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#059669",fontWeight:600}}>👁 {ev.visitasInv + ev.visitasCli} visitas</span>
                      <span style={{fontSize:11,color:"#7C3AED",fontWeight:600}}>📋 {ev.rsvpConfirmados}/{ev.cantInvitados} RSVP</span>
                      <span style={{fontSize:11,color:"#3B82F6",fontWeight:600}}>📸 {ev.fotosCount} fotos</span>
                      {ev.sobreActivo && <span style={{fontSize:11,color:"#D97706",fontWeight:600}}>💝 Sobre activo</span>}
                      {ev.pedidosCount > 0 && <span style={{fontSize:11,color:"var(--qb-accent)",fontWeight:600}}>🛒 {ev.pedidosCount} pedidos · {fmtCurrency(ev.pedidosTotal)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {solicitudes.length > 0 && (
              <div style={{...card,padding:"14px 16px",marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--qb-text2)",textTransform:"uppercase",marginBottom:10}}>📦 Extras solicitados desde portal</div>
                <div style={{display:"flex",gap:10,marginBottom:12}}>
                  <div style={{flex:1,background:"#EFF6FF",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid #BFDBFE"}}>
                    <div style={{fontSize:18,fontWeight:800,color:"#2563EB"}}>{solicitudes.length}</div>
                    <div style={{fontSize:10,color:"#2563EB",fontWeight:600}}>Total solicitudes</div>
                  </div>
                  <div style={{flex:1,background:solicPendientes.length>0?"#FEF3C7":"var(--qb-cobro-bg)",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid "+(solicPendientes.length>0?"#FDE68A":"var(--qb-cobro-border)")}}>
                    <div style={{fontSize:18,fontWeight:800,color:solicPendientes.length>0?"#D97706":"#16A34A"}}>{solicPendientes.length}</div>
                    <div style={{fontSize:10,color:solicPendientes.length>0?"#D97706":"#16A34A",fontWeight:600}}>Pendientes</div>
                  </div>
                </div>
                {Object.entries(solicPorServicio).sort((a,b)=>b[1]-a[1]).map(([srv,cnt]) => (
                  <div key={srv} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--qb-border)"}}>
                    <span style={{fontSize:13,color:"var(--qb-text)"}}>{srv}</span>
                    <span style={{fontWeight:700,color:"var(--qb-accent)",fontSize:14}}>{cnt}x</span>
                  </div>
                ))}
              </div>
            )}
          </>;
        })()
      )}

    </div>
  );
}
