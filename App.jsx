import { useState, useEffect, useRef, Component, Fragment } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── ERROR BOUNDARY ───────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:"40px 24px",textAlign:"center",color:"#DC2626"}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>Error en esta sección</div>
          <div style={{fontSize:12,color:"#8B7355",wordBreak:"break-word",background:"#FDF8F3",padding:"12px",borderRadius:8,textAlign:"left",marginTop:8}}>
            {String(this.state.error?.message || this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── CONSTANTS ────────────────────────────────────────────

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DAYS_SHORT = ["D","L","M","X","J","V","S"];

const STATUS = {
  pendiente:  { label:"Pendiente",  color:"#6B7280", bg:"#F3F4F6", border:"#D1D5DB" },
  senada:     { label:"Señada",     color:"#0284C7", bg:"#E0F2FE", border:"#7DD3FC" },
  confirmada: { label:"Confirmada", color:"#16A34A", bg:"#DCFCE7", border:"#86EFAC" },
  finalizada: { label:"Finalizada", color:"#1D4ED8", bg:"#DBEAFE", border:"#93C5FD" },
  cancelada:  { label: "Cancelada",  color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

const TURNOS = {
  dia:      { label: "Día",          icon: "☀️", color: "#D97706", bg: "#FEF3C7" },
  noche:    { label: "Tarde/Noche",  icon: "🌙", color: "#4F46E5", bg: "#EEF2FF" },
  completo: { label: "Día Completo", icon: "⭐", color: "#059669", bg: "#D1FAE5" },
};

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta"];
const TURNO_HORARIOS = {
  dia:      { horario: "11:00", horarioFin: "17:00" },
  noche:    { horario: "19:00", horarioFin: "23:59" },
  completo: { horario: "11:00", horarioFin: "23:00" },
};
const EXPENSE_CATS = ["Mantenimiento", "Limpieza", "Servicios", "Insumos","Otros"];
const CAT_COLORS = { Mantenimiento: "#6366F1", Limpieza: "#06B6D4", Servicios: "#F59E0B", Insumos: "#8B5CF6" };

const DEFAULT_USUARIOS = [];

const DEFAULT_CONFIG = {
  precios: {
    dia_semana:    { dia: 80000,  noche: 100000, completo: 160000 },
    dia_finde:     { dia: 120000, noche: 150000, completo: 250000 },
  },
};

const DEFAULT_SERVICIOS = [];

// ─── PLAN LIMITS ─────────────────────────────────────────
const PLAN_LIMITS = {
  basico:       { reservasMes: 50,  colaboradores: 0, espacios: 1, recordatorios: false, serviciosExtras: false },
  profesional:  { reservasMes: 100, colaboradores: 1, espacios: 3, recordatorios: true,  serviciosExtras: true  },
  premium:      { reservasMes: null,colaboradores: 3, espacios: 5, recordatorios: true,  serviciosExtras: true  },
  sincargo:     { reservasMes: null,colaboradores: 3, espacios: 5, recordatorios: true,  serviciosExtras: true  },
  demo:         { reservasMes: 100, colaboradores: 1, espacios: 3, recordatorios: true,  serviciosExtras: true  },
};
const getPlanLimits = (plan) => PLAN_LIMITS[plan] || PLAN_LIMITS.basico;

// ─── UTILS ────────────────────────────────────────────────

const genId = () => crypto.randomUUID();
const escHtml = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const fmtCurrency = (n = 0) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const toDateStr = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const clientName = (c) => c ? `${c.nombre||""} ${c.apellido||""}`.trim() || "Sin nombre" : "Sin cliente";
const monthKey = (d) => d ? d.slice(0,7) : "";

// ─── VIRTUAL COLUMN HELPERS ───────────────────────────────

const getTotalExtras  = (rid, extrasReserva) => extrasReserva.filter(e=>e.reservaId===rid).reduce((s,e)=>s+(e.precioHistorico*e.cantidad),0);
const getTotalPagado  = (rid, pagos)         => pagos.filter(p=>p.reservaId===rid).reduce((s,p)=>s+p.monto,0);
const getSaldo        = (res, extrasReserva, pagos) => (res.montoPactado + getTotalExtras(res.id, extrasReserva)) - getTotalPagado(res.id, pagos);

// ─── SUPABASE CLIENTS ────────────────────────────────────

// Supabase propio (data del negocio)
const SUPA_URL = "https://pmohyepcqfvkwijmljee.supabase.co";
const SUPA_KEY = "sb_publishable_syUaThUY-PaE_8fNcR4e6w_azyDZryB";
const supabase = createClient(SUPA_URL, SUPA_KEY);

// Supabase central (verifica suscripciones)
const CENTRAL_URL = "https://ngymvfvlknaltsvsrvjm.supabase.co";
const CENTRAL_KEY = "sb_publishable_XhsLlwmbDz5ne7JoeEoVHw_Qo56KJmd";
const supabaseCentral = createClient(CENTRAL_URL, CENTRAL_KEY);

// org_id activo — se setea al login, lo usan todos los métodos de sb
let currentOrgId = null;

const sb = {
  async getAll(table) {
    let q = supabase.from(table).select("*").order("creado_en", { ascending: true });
    if (currentOrgId) q = q.eq("org_id", currentOrgId);
    const { data } = await q;
    return data || [];
  },
  async upsert(table, rows) {
    const arr = Array.isArray(rows) ? rows : [rows];
    if (!arr.length) return true;
    const { error } = await supabase.from(table).upsert(arr);
    if (error) { console.error("SB upsert error:", table, error); return null; }
    return true;
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { console.error("SB remove error:", table, error); return null; }
    return true;
  },
};




function AccesoDenegado() {
  return (
    <div style={{padding:"60px 24px",textAlign:"center",color:"#8B7355"}}>
      <div style={{fontSize:44,marginBottom:12}}>🔒</div>
      <div style={{fontWeight:700,fontSize:16,color:"#1C1C1E",marginBottom:8}}>Acceso restringido</div>
      <div style={{fontSize:13}}>Solo los administradores pueden ver esta sección.</div>
    </div>
  );
}

function LogoSVG({ size=48, color="#C4602B" }) {
  return (
    <svg width={size} height={size*0.85} viewBox="0 0 60 51" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="3,32 30,6 57,32" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="39" y="19" width="9" height="13" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M48.5 8.5 C48.5 6 50.5 4 52.5 4 C54.5 4 56 5.8 56 7.8 C56 11.5 52.5 14.5 48.5 17.5 C44.5 14.5 41 11.5 41 7.8 C41 5.8 42.5 4 44.5 4 C46.5 4 48.5 6 48.5 8.5Z" fill={color} opacity="0.85"/>
    </svg>
  );
}

// ─── PDF HELPERS ─────────────────────────────────────────

const PDF_CSS =
  "*{box-sizing:border-box;margin:0;padding:0}" +
  "body{font-family:Arial,sans-serif;color:#1C1C1E;padding:40px;max-width:760px;margin:0 auto;font-size:14px;line-height:1.5}" +
  ".hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #C4602B;padding-bottom:14px;margin-bottom:20px}" +
  ".logo{font-size:20px;font-weight:800;color:#C4602B}" +
  ".logo-img{height:52px;width:52px;border-radius:50%;object-fit:cover;margin-right:12px}" +
  ".hdr-left{display:flex;align-items:center}" +
  ".sub{font-size:12px;color:#8B7355;margin-top:3px}" +
  "h2{font-size:13px;font-weight:700;color:#5C4033;border-bottom:1px solid #EDE0D0;padding-bottom:5px;margin:18px 0 8px}" +
  ".row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F5EDE4;font-size:13px}" +
  ".lbl{color:#8B7355}.val{font-weight:600}" +
  ".pos{color:#16A34A}.neg{color:#DC2626}" +
  ".total{display:flex;justify-content:space-between;padding:10px 0;font-weight:800;font-size:15px;border-top:2px solid #C4602B;margin-top:6px;color:#C4602B}" +
  ".box{background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:18px 22px;margin:16px 0;font-size:14px;line-height:1.8}" +
  ".firma{display:flex;justify-content:space-between;margin-top:40px;border-top:1px dashed #EDE0D0;padding-top:14px}" +
  ".fitem{text-align:center;width:45%}" +
  ".fline{border-top:1px solid #1C1C1E;margin-top:36px;padding-top:5px;font-size:11px;color:#8B7355}" +
  ".footer{margin-top:28px;padding-top:10px;border-top:1px solid #EDE0D0;font-size:11px;color:#8B7355;text-align:center}" +
  "@media print{body{padding:20px}}";

function pRow(l,v,c){return '<div class="row"><span class="lbl">'+l+'</span><span class="val'+(c?' '+c:'')+'">' +v+'</span></div>';}
function pH2(t){return '<h2>'+t+'</h2>';}
function pDiv(c,i){return '<div class="'+c+'">'+i+'</div>';}

function buildDoc(title,body){
  var footer=pDiv('footer','Mi Quincho - '+new Date().toLocaleDateString('es-AR'));
  var html='<style>'+PDF_CSS+'</style>'+body+footer;
  return {title:title, html:html};
}

function pLogoHdr(negocio,subtitulo,derecha){
  var nombreNeg=escHtml((negocio&&negocio.nombreNegocio)||'Mi Negocio');
  var logoImg=(negocio&&negocio.logoUrl)?'<img class="logo-img" src="'+negocio.logoUrl+'" alt="logo" crossorigin="anonymous">':'';
  var izq='<div class="hdr-left">'+logoImg+'<div><div class="logo">'+nombreNeg+'</div><div class="sub">'+escHtml((negocio&&negocio.ciudad)||'')+' · '+subtitulo+'</div></div></div>';
  return pDiv('hdr',izq+'<div style="text-align:right">'+derecha+'</div>');
}

function printReserva(reserva,cliente,recurso,resExtras,resPagos,negocio){
  var te=resExtras.reduce(function(s,e){return s+(e.precioHistorico*e.cantidad);},0);
  var tp=resPagos.reduce(function(s,p){return s+p.monto;},0);
  var saldo=(reserva.montoPactado+te)-tp;
  var hdr=pLogoHdr(negocio,'Ficha de Evento','ID: '+reserva.id.slice(-8).toUpperCase());
  var body=hdr+pH2('Cliente')+pRow('Nombre',escHtml(clientName(cliente)));
  if(cliente&&cliente.whatsapp)body+=pRow('WhatsApp',escHtml(cliente.whatsapp));
  if(cliente&&cliente.email)body+=pRow('Email',escHtml(cliente.email));
  if(cliente&&cliente.localidad)body+=pRow('Localidad',escHtml(cliente.localidad));
  body+=pH2('Evento')+pRow('Fecha',fmtDate(reserva.fecha));
  if(TURNOS[reserva.turno])body+=pRow('Turno',escHtml(TURNOS[reserva.turno].label));
  if(reserva.horario)body+=pRow('Inicio',escHtml(reserva.horario)+' hs');
  if(reserva.horarioFin)body+=pRow('Fin',escHtml(reserva.horarioFin)+' hs');
  if(reserva.cantInvitados>0)body+=pRow('Invitados',reserva.cantInvitados+' personas');
  if(recurso)body+=pRow('Espacio',escHtml(recurso.nombre));
  if(reserva.notas)body+=pRow('Notas',escHtml(reserva.notas));
  if(resExtras.length>0){body+=pH2('Extras');resExtras.forEach(function(e){body+=pRow(escHtml(e.descripcion)+' x'+e.cantidad,fmtCurrency(e.cantidad*e.precioHistorico));});}
  body+=pH2('Resumen')+pRow('Monto pactado',fmtCurrency(reserva.montoPactado));
  if(te>0)body+=pRow('+ Extras',fmtCurrency(te));
  body+=pRow('Total',fmtCurrency(reserva.montoPactado+te))+pRow('Cobrado',fmtCurrency(tp),'pos')+'<div class="total"><span>'+(saldo>0?'Saldo pendiente':'Pagado')+'</span><span class="'+(saldo>0?'neg':'pos')+'">'+fmtCurrency(Math.abs(saldo))+'</span></div>';
  if(resPagos.length>0){body+=pH2('Cobros');resPagos.forEach(function(p){body+=pRow(fmtDate(p.fecha)+' - '+escHtml(p.metodo),'+'+fmtCurrency(p.monto),'pos');});}
  return buildDoc('Ficha '+escHtml(clientName(cliente)),body);
}

function printRecibo(pago,reserva,cliente,negocio){
  var hdr=pLogoHdr(negocio,'Comprobante de Pago','<b>N° '+pago.id.slice(-6).toUpperCase()+'</b><br>'+new Date().toLocaleDateString('es-AR'));
  var texto='Recibi de '+escHtml(clientName(cliente))+' la suma de '+fmtCurrency(pago.monto)+' en concepto de pago para la reserva del dia '+fmtDate(reserva?reserva.fecha:'-')+' en '+nombreNeg+'. Metodo: '+escHtml(pago.metodo)+'.';
  if(pago.notas)texto+=' Ref: '+escHtml(pago.notas);
  var firma=pDiv('firma',pDiv('fitem',pDiv('fline','Firma prestador'))+pDiv('fitem',pDiv('fline','Conformidad cliente')));
  return buildDoc('Recibo '+escHtml(clientName(cliente)),hdr+pDiv('box',texto)+pH2('Detalle')+pRow('Cliente',escHtml(clientName(cliente)))+pRow('Monto',fmtCurrency(pago.monto),'pos')+pRow('Metodo',escHtml(pago.metodo))+pRow('Fecha',fmtDate(pago.fecha))+firma);
}

function printReporte(month,year,ingresos,gastos,ganancia,catData,confirmadas,porCobrar,negocio){
  var hdr=pLogoHdr(negocio,'Reporte Financiero','<b>'+MONTHS[month]+' '+year+'</b>');
  var body=hdr+pH2('Resumen del mes')+pRow('Ingresos cobrados',fmtCurrency(ingresos),'pos')+pRow('Gastos operacionales',fmtCurrency(gastos),'neg')+'<div class="total"><span>Ganancia Neta</span><span class="'+(ganancia>=0?'pos':'neg')+'">'+fmtCurrency(Math.abs(ganancia))+'</span></div>'+pH2('Ocupacion')+pRow('Eventos activos',String(confirmadas))+pRow('Por cobrar',fmtCurrency(porCobrar),'neg');
  if(catData.length>0){body+=pH2('Gastos por categoria');catData.forEach(function(c){body+=pRow(c.name,fmtCurrency(c.value));});}
  return buildDoc('Reporte '+MONTHS[month]+' '+year,body);
}


// ─── FIELD MAPPERS (camelCase -> snake_case for Supabase) ─
function mapReserva(r){ return {id:r.id,org_id:r.orgId||currentOrgId,cliente_id:r.clienteId,recurso_id:r.recursoId,turno_id:r.turnoId||null,fecha:r.fecha,turno:r.turno,horario:r.horario||"",horario_fin:r.horarioFin||"",cant_invitados:r.cantInvitados||35,monto_pactado:r.montoPactado||0,estado:r.estado||"pendiente",notas:r.notas||"",creado_por:r.creadoPor||"",creado_en:r.creadoEn||new Date().toISOString(),fecha_creacion:r.fechaCreacion||null,recordatorio_enviado:!!r.recordatorioEnviado,post_evento_procesado:!!r.postEventoProcesado,calificacion:r.calificacion||null}; }
function mapCliente(c){ return {id:c.id,org_id:c.orgId||currentOrgId,nombre:c.nombre||"",apellido:c.apellido||"",whatsapp:c.whatsapp||"",email:c.email||"",localidad:c.localidad||"",notas_internas:c.notasInternas||"",creado_en:c.creadoEn||new Date().toISOString()}; }
function mapPago(p){ return {id:p.id,org_id:p.orgId||currentOrgId,reserva_id:p.reservaId,monto:p.monto||0,fecha:p.fecha,metodo:p.metodo||"Transferencia",notas:p.notas||"",comprobante:p.comprobante||"",creado_por:p.creadoPor||"",creado_en:p.creadoEn||new Date().toISOString()}; }
function mapGasto(g){ return {id:g.id,org_id:g.orgId||currentOrgId,concepto:g.concepto||"",monto:g.monto||0,fecha:g.fecha,categoria:g.categoria||"Otros",metodo:g.metodo||"Efectivo",creado_por:g.creadoPor||"",creado_en:g.creadoEn||new Date().toISOString()}; }
function mapExtra(e){ return {id:e.id,org_id:e.orgId||currentOrgId,reserva_id:e.reservaId,servicio_id:e.servicioId||null,descripcion:e.descripcion||"",cantidad:e.cantidad||1,precio_historico:e.precioHistorico||0,creado_en:e.creadoEn||new Date().toISOString()}; }
function mapBloqueo(b){ return {id:b.id,org_id:b.orgId||currentOrgId,fecha:b.fecha,turno:b.turno,motivo:b.motivo||"",creado_por:b.creadoPor||"",creado_en:b.creadoEn||new Date().toISOString()}; }
function mapTarea(t){ return {id:t.id,org_id:t.orgId||currentOrgId,descripcion:t.descripcion||"",estado:t.estado||"pendiente",fecha_registro:t.fechaRegistro||null,creado_por:t.creadoPor||"",creado_en:t.creadoEn||new Date().toISOString()}; }
function mapRecordatorio(r){ return {id:r.id,org_id:r.orgId||currentOrgId,reserva_id:r.reservaId||null,cliente_id:r.clienteId||null,tipo:r.tipo||"",nota:r.nota||"",fecha_alerta:r.fechaAlerta,hora_alerta:r.horaAlerta||"09:00",estado:r.estado||"Pendiente",creado_en:r.creadoEn||new Date().toISOString()}; }
function mapUsuario(u){ return {id:u.id,nombre:u.nombre||"",apellido:u.apellido||"",email:u.email||"",whatsapp:u.whatsapp||"",puesto:u.puesto||"",rol:u.rol||"Personal",estado:u.estado||"Activo",permiso_root:!!u.permisoRoot,ver_finanzas:!!u.verFinanzas,modificar_caja:!!u.modificarCaja,gestion_operativa:!!u.gestionOperativa}; }


// ─── SHARED STYLES ────────────────────────────────────────

const card       = { background:"#FFF", borderRadius:12, border:"1px solid #EDE0D0", boxShadow:"0 2px 8px rgba(196,96,43,0.05)" };
const inputStyle = { width:"100%", padding:"10px 12px", borderRadius:8, fontSize:14, border:"1.5px solid #EDE0D0", background:"#FFF", outline:"none", color:"#1C1C1E", boxSizing:"border-box", fontFamily:"inherit" };
const lbl = { fontSize:11, fontWeight:700, color:"#5C4033", textTransform:"uppercase", letterSpacing:0.6 };
const labelStyle = { display:"block", fontSize:11, fontWeight:700, color:"#5C4033", marginBottom:5, textTransform:"uppercase", letterSpacing:0.6 };

// ─── BASE COMPONENTS ──────────────────────────────────────

function Field({ label, children }) {
  return <div style={{marginBottom:14}}><label style={labelStyle}>{label}</label>{children}</div>;
}
function Input({ label, value, onChange, type="text", placeholder, min, required, readOnly }) {
  return (
    <Field label={label}>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        min={min} required={required} readOnly={readOnly}
        style={{...inputStyle, background: readOnly?"#F9F6F2":"#FFF"}} />
    </Field>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={inputStyle}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}
function TextArea({ label, value, onChange, placeholder, rows=3 }) {
  return (
    <Field label={label}>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        rows={rows} style={{...inputStyle, resize:"vertical"}} />
    </Field>
  );
}
function Btn({ onClick, children, variant="primary", small, fullWidth, disabled }) {
  const vs = {
    primary:   { background:"#C4602B", color:"#FFF", border:"none" },
    secondary: { background:"#FDF8F3", color:"#C4602B", border:"1.5px solid #C4602B" },
    ghost:     { background:"transparent", color:"#8B7355", border:"1.5px solid #EDE0D0" },
    danger:    { background:"#FEF2F2", color:"#DC2626", border:"1.5px solid #FECACA" },
    green:     { background:"#F0FDF4", color:"#16A34A", border:"1.5px solid #86EFAC" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...(vs[variant]||vs.primary), borderRadius:8, padding: small?"6px 14px":"10px 20px",
      fontSize: small?12:14, fontWeight:600, cursor: disabled?"not-allowed":"pointer",
      opacity: disabled?0.5:1, fontFamily:"inherit", width: fullWidth?"100%":"auto",
      display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
    }}>{children}</button>
  );
}
function BottomModal({ title, onClose, children }) {
  useEffect(() => { document.body.style.overflow="hidden"; return ()=>{ document.body.style.overflow=""; }; }, []);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,14,8,0.55)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:2000}} onClick={onClose}>
      <div style={{background:"#FFF",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
        <div style={{position:"sticky",top:0,background:"#FFF",zIndex:1,padding:"10px 20px 14px",borderBottom:"1px solid #EDE0D0"}}>
          <div style={{width:36,height:4,background:"#D4C5B5",borderRadius:2,margin:"0 auto 14px"}} />
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display', serif"}}>{title}</h2>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#8B7355",lineHeight:1}}>✕</button>
          </div>
        </div>
        <div style={{padding:"20px 20px 40px"}}>{children}</div>
      </div>
    </div>
  );
}
function StatusBadge({ estado }) {
  const s = STATUS[estado]||STATUS.pendiente;
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:s.color,background:s.bg,border:`1px solid ${s.border}`}}>{s.label}</span>;
}
function TurnoBadge({ turno }) {
  const t = TURNOS[turno]||TURNOS.dia;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:t.color,background:t.bg}}>{t.icon} {t.label}</span>;
}
function Avatar({ nombre }) {
  return (
    <div style={{width:44,height:44,borderRadius:22,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:18,flexShrink:0,fontFamily:"'Playfair Display', serif"}}>
      {nombre?.[0]?.toUpperCase()||"?"}
    </div>
  );
}

// ─── MODALS ───────────────────────────────────────────────

function ReservaModal({ onClose, onSave, clientes, recursos, reserva, reservas, initialDate, initialTurno, config, saving, turnosRecurso }) {
  const isEdit = !!reserva;

  const esFinde = (fecha) => {
    try { const d=new Date(fecha+"T12:00:00"); const dow=d.getDay(); return dow===0||dow===6; } catch(e){ return false; }
  };

  const getTurnosEspacio = (recursoId) =>
    (turnosRecurso||[]).filter(t=>t.recursoId===recursoId && t.activo!==false);

  const getPrecioFromTurnos = (turnoId, fecha, recursoId) => {
    const ts = getTurnosEspacio(recursoId);
    const t = ts.find(x=>x.id===turnoId);
    if(!t) return "";
    return esFinde(fecha) ? (t.precioFinde||"") : (t.precioSemana||"");
  };

  // Si initialTurno es un UUID de turno custom, detectar el espacio automáticamente
  const turnoDeInitial = initialTurno ? (turnosRecurso||[]).find(t=>t.id===initialTurno) : null;
  const initRecursoId = reserva?.recursoId || turnoDeInitial?.recursoId || recursos[0]?.id || "";
  const initTurnosEspacio = getTurnosEspacio(initRecursoId);
  const initTurnoId = reserva?.turnoId || initialTurno || (initTurnosEspacio[0]?.id) || "";

  const getInitMonto = () => {
    if(reserva?.montoPactado) return reserva.montoPactado;
    const fecha = initialDate || toDateStr(new Date());
    if(initTurnoId && initTurnosEspacio.length>0) return getPrecioFromTurnos(initTurnoId, fecha, initRecursoId);
    return "";
  };

  const getInitHorario = () => {
    if(reserva) return {horario: reserva.horario||"", horarioFin: reserva.horarioFin||""};
    const t = initTurnosEspacio.find(x=>x.id===initTurnoId);
    return t ? {horario: t.horaInicio, horarioFin: t.horaFin} : {horario:"", horarioFin:""};
  };
  const initH = getInitHorario();

  const [f, setF] = useState({
    clienteId:    reserva?.clienteId    || "",
    recursoId:    initRecursoId,
    fecha:        reserva?.fecha        || initialDate || toDateStr(new Date()),
    turnoId:      initTurnoId,
    turno:        reserva?.turno        || initialTurno || "dia",
    horario:      initH.horario,
    horarioFin:   initH.horarioFin,
    cantInvitados:reserva?.cantInvitados||1,
    montoPactado: getInitMonto(),
    estado:       reserva?.estado       || "pendiente",
    notas:        reserva?.notas        || "",
  });

  // Si initialTurno llega después del primer render (batching), sincronizar
  useEffect(() => {
    if(!initialTurno) return;
    const t = (turnosRecurso||[]).find(x=>x.id===initialTurno);
    if(!t) return;
    const fecha = f.fecha;
    const esFin = esFinde(fecha);
    const precio = esFin ? (t.precioFinde||"") : (t.precioSemana||"");
    setF(p => {
      if(p.turnoId === t.id) return p; // ya está bien, no hacer nada
      return {...p, recursoId:t.recursoId, turnoId:t.id, horario:t.horaInicio, horarioFin:t.horaFin, montoPactado:precio||p.montoPactado};
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTurno]);

  const turnosDelEspacio = getTurnosEspacio(f.recursoId);
  const usaTurnosCustom = turnosDelEspacio.length > 0;

  const set = k => v => setF(p => {
    if(k==="recursoId") {
      const ts = getTurnosEspacio(v);
      const primerTurno = ts[0];
      const precio = primerTurno ? (esFinde(p.fecha) ? primerTurno.precioFinde : primerTurno.precioSemana) : "";
      return {...p, recursoId:v, turnoId:primerTurno?.id||"", horario:primerTurno?.horaInicio||"", horarioFin:primerTurno?.horaFin||"", montoPactado:precio||""};
    }
    if(k==="turnoId") {
      const ts = getTurnosEspacio(p.recursoId);
      const t = ts.find(x=>x.id===v);
      const precio = t ? (esFinde(p.fecha) ? t.precioFinde : t.precioSemana) : "";
      return {...p, turnoId:v, horario:t?.horaInicio||p.horario, horarioFin:t?.horaFin||p.horarioFin, montoPactado:precio||p.montoPactado};
    }
    if(k==="fecha") {
      const precio = getPrecioFromTurnos(p.turnoId, v, p.recursoId);
      return {...p, fecha:v, montoPactado:precio||p.montoPactado||""};
    }
    return {...p, [k]:v};
  });

  return (
    <BottomModal title={isEdit?"Editar Reserva":"Nueva Reserva"} onClose={onClose}>
      <Select label="Cliente" value={f.clienteId} onChange={set("clienteId")}
        options={[{value:"",label:"— Seleccionar cliente —"},...clientes.map(c=>({value:c.id,label:clientName(c)+(c.whatsapp?` · ${c.whatsapp}`:"")}))]} />
      {f.clienteId && (()=>{
        const avg = reservas ? getClientAvg(f.clienteId, reservas) : null;
        if(avg!==null && Number(avg)<=2) return (
          <div style={{padding:"10px 14px",background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:8,marginTop:-8,marginBottom:8,display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:18}}>⚠️</span>
            <span style={{fontSize:13,fontWeight:700,color:"#DC2626"}}>ATENCIÓN: Este cliente tiene malas calificaciones previas. Promedio: {avg}/5</span>
          </div>
        );
        return null;
      })()}
      <Select label="Espacio" value={f.recursoId} onChange={set("recursoId")}
        options={recursos.map(r=>({value:r.id,label:r.nombre}))} />
      <Input label="Fecha del evento" type="date" value={f.fecha} onChange={set("fecha")} required />

      {/* Selector de turno: custom si hay turnos configurados, genérico si no */}
      {usaTurnosCustom ? (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#5C4033",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Turno</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {turnosDelEspacio.map(t=>{
              const precio = esFinde(f.fecha) ? t.precioFinde : t.precioSemana;
              const sel = f.turnoId===t.id;
              return (
                <button key={t.id} onClick={()=>set("turnoId")(t.id)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${sel?"#C4602B":"#EDE0D0"}`,background:sel?"#FEF3EC":"#FFF",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:sel?"#C4602B":"#1C1C1E"}}>{t.nombre}</div>
                    <div style={{fontSize:11,color:"#8B7355"}}>{t.horaInicio} – {t.horaFin}</div>
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:sel?"#C4602B":"#5C4033"}}>{fmtCurrency(precio||0)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <Select label="Turno" value={f.turno} onChange={v=>setF(p=>({...p,turno:v}))}
          options={Object.entries(TURNOS).map(([k,v])=>({value:k,label:`${v.icon} ${v.label}`}))} />
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Hora inicio" type="time" value={f.horario} onChange={set("horario")} />
        <Input label="Hora fin" type="time" value={f.horarioFin} onChange={set("horarioFin")} />
        {turnosDelEspacio.length <= 4 && (
          <Input label="Cant. personas" type="number" value={f.cantInvitados} onChange={set("cantInvitados")} min="1" placeholder="0" onFocus={e=>e.target.select()} />
        )}
      </div>
      <Input label="Monto pactado ($)" type="number" value={f.montoPactado} onChange={set("montoPactado")} required placeholder="0" />
      <div style={{padding:"8px 12px",background:"#F3F4F6",borderRadius:8,marginBottom:14,fontSize:12,color:"#6B7280"}}>
        🔒 Estado: <strong>{STATUS[f.estado]?.label||"Pendiente"}</strong> — cambia automáticamente con los cobros
      </div>
      <TextArea label="Notas" value={f.notas} onChange={set("notas")} placeholder="Detalles del evento, requerimientos especiales..." />
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={saving} onClick={()=>{
          if(saving) return;
          if(!f.clienteId) return alert("Seleccioná un cliente.");
          if(!f.fecha||!f.montoPactado) return alert("Completá fecha y monto pactado.");
          if(Number(f.montoPactado)<=0) return alert("El monto pactado debe ser mayor a cero.");
          if(!isEdit&&f.fecha < toDateStr(new Date())) return alert("No podés registrar una reserva en una fecha pasada.");
          onSave({...f, turnoId:f.turnoId||null, montoPactado:Number(f.montoPactado), cantInvitados:Number(f.cantInvitados)||1});
        }}>{saving?"Guardando...":(isEdit?"Guardar cambios":"Crear reserva")}</Btn>
      </div>
    </BottomModal>
  );
}

function ClienteModal({ onClose, onSave, cliente }) {
  const [f, setF] = useState({
    nombre: cliente?.nombre||"", apellido: cliente?.apellido||"",
    whatsapp: cliente?.whatsapp||"", localidad: cliente?.localidad||"Mar del Plata",
    email: cliente?.email||"", notasInternas: cliente?.notasInternas||"",
  });
  const set = k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <BottomModal title={cliente?"Editar Cliente":"Nuevo Cliente"} onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Nombre *" value={f.nombre} onChange={set("nombre")} required />
        <Input label="Apellido" value={f.apellido} onChange={set("apellido")} />
      </div>
      <Input label="WhatsApp" value={f.whatsapp} onChange={set("whatsapp")} placeholder="+54 11 1234-5678" />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Email (opcional)" type="email" value={f.email} onChange={set("email")} placeholder="email@ejemplo.com" />
        <Input label="Localidad" value={f.localidad} onChange={set("localidad")} placeholder="Ciudad / Barrio" />
      </div>
      <TextArea label="Notas internas" value={f.notasInternas} onChange={set("notasInternas")} placeholder="Comportamiento, preferencias..." rows={2} />
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{
          if(!f.nombre)return alert("El nombre es obligatorio.");
          if(f.whatsapp&&!/^[\d\s+\-().]{7,20}$/.test(f.whatsapp))return alert("El WhatsApp ingresado no parece válido. Ejemplo: +54 223 1234567");
          onSave(f);
        }}>
          {cliente?"Guardar":"Agregar cliente"}
        </Btn>
      </div>
    </BottomModal>
  );
}

function PagoModal({ onClose, onSave, reservas, clientes, pagos, extrasReserva, initialReservaId }) {
  const initId = initialReservaId||reservas.filter(r=>r.estado!=="cancelada")[0]?.id||"";
  const calcSaldo = (rid) => {
    const res = reservas.find(r=>r.id===rid);
    if(!res) return "";
    return String(Math.max(0, getSaldo(res, extrasReserva, pagos)));
  };
  const [f, setF] = useState({
    reservaId: initId, monto: calcSaldo(initId),
    fecha: toDateStr(new Date()), metodo:"Transferencia", notas:"",
  });
  const [comprobante, setComprobante] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleResChange = (rid) => {
    setF(p=>({...p, reservaId:rid, monto: calcSaldo(rid)}));
  };
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 3*1024*1024) return alert("La imagen no puede superar 3MB.");
    const ALLOWED_TYPES = ["image/jpeg","image/png","image/webp","image/gif","application/pdf"];
    if(!ALLOWED_TYPES.includes(file.type)) return alert("Solo se permiten imágenes (JPG, PNG, WEBP) o PDF.");
    setUploadingFile(true);
    const EXT_MAP = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","application/pdf":"pdf"};
    const ext = EXT_MAP[file.type] || 'jpg';
    const fileName = `${genId()}.${ext}`;
    const { data: upData, error: upErr } = await supabase.storage
      .from('comprobantes')
      .upload(fileName, file, { cacheControl:'3600', upsert:false });
    if(!upErr && upData) {
      const { data:{ publicUrl } } = supabase.storage.from('comprobantes').getPublicUrl(fileName);
      setComprobante(publicUrl);
    } else {
      // Fallback a base64 si el bucket no existe todavía
      const reader = new FileReader();
      reader.onload = ev => setComprobante(ev.target.result);
      reader.readAsDataURL(file);
    }
    setUploadingFile(false);
  };

  const resOpts = [{value:"",label:"— Seleccionar reserva —"},
    ...reservas.filter(r=>{
      if(r.estado==="cancelada"||r.estado==="finalizada") return false;
      return getSaldo(r, extrasReserva, pagos) > 0;
    }).map(r=>{
      const c=clientes.find(x=>x.id===r.clienteId);
      const saldo = getSaldo(r, extrasReserva, pagos);
      return {value:r.id, label:`${clientName(c)} · ${fmtDate(r.fecha)} · ${TURNOS[r.turno]?.icon} · Saldo: ${fmtCurrency(saldo)}`};
    })];

  const doSave = (print) => {
    if(!f.reservaId||!f.monto) return alert("Seleccioná una reserva e ingresá el monto.");
    if(Number(f.monto)<=0) return alert("El monto debe ser mayor a cero.");
    onSave({...f, monto:Number(f.monto), comprobante:comprobante||null}, print);
  };

  return (
    <BottomModal title="Registrar Cobro" onClose={onClose}>
      <Select label="Reserva" value={f.reservaId} onChange={handleResChange} options={resOpts} />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:"#5C4033",marginBottom:5,textTransform:"uppercase",letterSpacing:0.6}}>Monto ($)</label>
          <input type="number" value={f.monto} onChange={e=>setF(p=>({...p,monto:e.target.value}))} onFocus={e=>e.target.select()}
            style={{width:"100%",padding:"10px 12px",borderRadius:8,fontSize:14,border:"1.5px solid #EDE0D0",background:"#FFF",outline:"none",color:"#1C1C1E",boxSizing:"border-box",fontFamily:"inherit"}} />
        </div>
        <Input label="Fecha del pago" type="date" value={f.fecha} onChange={v=>setF(p=>({...p,fecha:v}))} required />
      </div>
      <Select label="Método de pago" value={f.metodo} onChange={v=>setF(p=>({...p,metodo:v}))}
        options={PAYMENT_METHODS.map(m=>({value:m,label:m}))} />
      <TextArea label="Notas" value={f.notas} onChange={v=>setF(p=>({...p,notas:v}))} rows={2} placeholder="Referencia, número de comprobante..." />
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:"#5C4033",marginBottom:8,textTransform:"uppercase",letterSpacing:0.6}}>📎 Foto del comprobante (opcional)</label>
        <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:10,cursor:uploadingFile?"not-allowed":"pointer",opacity:uploadingFile?0.6:1}}>
          <span style={{fontSize:22}}>{uploadingFile?"⏳":"📷"}</span>
          <span style={{fontSize:13,color:"#C4602B",fontWeight:600}}>{uploadingFile?"Subiendo imagen...":"Sacar foto o elegir imagen"}</span>
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}} disabled={uploadingFile} />
        </label>
        {comprobante && (
          <div style={{marginTop:10,position:"relative"}}>
            <img src={comprobante} alt="Comprobante" style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:8,border:"1px solid #EDE0D0"}} />
            <button onClick={()=>setComprobante(null)} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.6)",border:"none",color:"#FFF",borderRadius:20,width:24,height:24,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8,flexWrap:"wrap"}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="secondary" onClick={()=>doSave(true)}>🖨️ + Recibo</Btn>
        <Btn onClick={()=>doSave(false)}>Registrar cobro</Btn>
      </div>
    </BottomModal>
  );
}

function GastoModal({ onClose, onSave }) {
  const [f,setF] = useState({fecha:toDateStr(new Date()),concepto:"",monto:"",categoria:"Insumos",metodo:"Efectivo"});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <BottomModal title="Registrar Gasto" onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Fecha" type="date" value={f.fecha} onChange={set("fecha")} required />
        <Select label="Categoría" value={f.categoria} onChange={set("categoria")}
          options={EXPENSE_CATS.map(c=>({value:c,label:c}))} />
      </div>
      <Input label="Concepto / descripción" value={f.concepto} onChange={set("concepto")} placeholder="Limpieza post-evento, repuestos..." required />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Monto ($)" type="number" value={f.monto} onChange={set("monto")} required placeholder="0" />
        <Select label="Método de pago" value={f.metodo} onChange={set("metodo")}
          options={[{value:"Efectivo",label:"💵 Efectivo"},{value:"Transferencia",label:"🏦 Transferencia"}]} />
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{
          if(!f.concepto||!f.monto)return alert("Completá concepto y monto.");
          if(Number(f.monto)<=0)return alert("El monto debe ser mayor a cero.");
          onSave({...f,monto:Number(f.monto)});
        }}>Registrar gasto</Btn>
      </div>
    </BottomModal>
  );
}

function ExtrasModal({ onClose, onSave, servicios, reservaId }) {
  const [f, setF] = useState({
    servicioId: servicios[0]?.id||"custom",
    descripcion:"", cantidad:"1",
    precioHistorico: servicios[0]?.precioActual||"",
  });
  const set = k=>v=>setF(p=>({...p,[k]:v}));
  const handleSrvChange = (id) => {
    const srv = servicios.find(s=>s.id===id);
    setF(p=>({...p, servicioId:id, precioHistorico: srv?.precioActual||"", descripcion:""}));
  };
  const subtotal = Number(f.cantidad||0)*Number(f.precioHistorico||0);
  return (
    <BottomModal title="Agregar Extra" onClose={onClose}>
      <Select label="Servicio del catálogo" value={f.servicioId} onChange={handleSrvChange}
        options={[...servicios.map(s=>({value:s.id,label:`${s.descripcion} · ${fmtCurrency(s.precioActual)}`})),{value:"custom",label:"✏️ Personalizado"}]} />
      {f.servicioId==="custom" && (
        <Input label="Descripción del extra" value={f.descripcion} onChange={set("descripcion")} placeholder="Nombre del servicio o item" />
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Cantidad" type="number" value={f.cantidad} onChange={set("cantidad")} min="1" />
        <Input label="Precio unitario ($)" type="number" value={f.precioHistorico} onChange={set("precioHistorico")} />
      </div>
      {subtotal>0 && (
        <div style={{padding:"10px 14px",background:"#FEF0E8",borderRadius:8,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,color:"#8B7355"}}>Subtotal del extra</span>
          <span style={{fontWeight:800,color:"#C4602B",fontSize:16}}>{fmtCurrency(subtotal)}</span>
        </div>
      )}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{
          const srv = servicios.find(s=>s.id===f.servicioId);
          const desc = f.servicioId==="custom"?f.descripcion:srv?.descripcion;
          if(!desc||!f.cantidad||!f.precioHistorico)return alert("Completá todos los campos.");
          if(Number(f.cantidad)<=0) return alert("La cantidad debe ser mayor a cero.");
          if(Number(f.precioHistorico)<=0) return alert("El precio debe ser mayor a cero.");
          onSave({reservaId,servicioId:f.servicioId!=="custom"?f.servicioId:null,descripcion:desc,cantidad:Number(f.cantidad),precioHistorico:Number(f.precioHistorico)});
        }}>Agregar Extra</Btn>
      </div>
    </BottomModal>
  );
}

// ─── DETAIL PANELS ────────────────────────────────────────

function ReservaDetail({ reserva, clientes, recursos, pagos, extrasReserva, serviciosExtras, onClose, onEdit, onDelete, onCancel, onNewPago, onNewExtra, onShowPDF, onDeletePago, onEditPago, canModifyCaja, negocio }) {
  const [editingPago, setEditingPago] = useState(null);
  const [cancelStep, setCancelStep] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDelPagoId, setConfirmDelPagoId] = useState(null); // null | "confirm" | "refund"
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const cliente = clientes.find(c=>c.id===reserva.clienteId);
  const recurso = recursos.find(r=>r.id===reserva.recursoId);
  const resPagos = pagos.filter(p=>p.reservaId===reserva.id).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const resExtras = extrasReserva.filter(e=>e.reservaId===reserva.id);
  const totalExtras  = getTotalExtras(reserva.id, extrasReserva);
  const totalPagado  = getTotalPagado(reserva.id, pagos);
  const totalEvento  = reserva.montoPactado + totalExtras;
  const saldo        = totalEvento - totalPagado;

  return (
    <BottomModal title="Detalle de Reserva" onClose={onClose}>
      {/* Badges */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <TurnoBadge turno={reserva.turno} />
        <StatusBadge estado={reserva.estado} />
        {saldo>0 && <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:"#DC2626",background:"#FEF2F2",border:"1px solid #FECACA"}}>⚠️ Saldo pendiente</span>}
      </div>

      {/* Info */}
      <div style={{...card,padding:16,marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <div style={labelStyle}>Cliente</div>
            <div style={{fontWeight:700,fontSize:16,color:"#1C1C1E"}}>{clientName(cliente)}</div>
            {cliente?.whatsapp && (
              <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g,"")}?text=Hola%20${encodeURIComponent(cliente.nombre||"")}%2C%20te%20contacto%20por%20tu%20reserva.`}
                target="_blank" rel="noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:13,color:"#25D366",textDecoration:"none",marginTop:6,fontWeight:600}}>
                💬 {cliente.whatsapp}
              </a>
            )}
          </div>
          <div>
            <div style={labelStyle}>Fecha del evento</div>
            <div style={{fontWeight:700,fontSize:16,color:"#1C1C1E"}}>{fmtDate(reserva.fecha)}</div>
            {(reserva.horario||reserva.horarioFin) && <div style={{fontSize:13,color:"#8B7355",marginTop:4}}>⏰ {reserva.horario||"—"} → {reserva.horarioFin||"—"}</div>}
          </div>
          {recurso && <div><div style={labelStyle}>Espacio</div><div style={{fontSize:14,color:"#1C1C1E"}}>🏠 {recurso.nombre}</div></div>}
          {reserva.cantInvitados>0 && <div><div style={labelStyle}>Invitados</div><div style={{fontSize:14,color:"#1C1C1E"}}>👥 {reserva.cantInvitados} personas</div></div>}
        </div>
        {reserva.notas && <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #EDE0D0",fontSize:13,color:"#5C4033"}}>📝 {reserva.notas}</div>}
      </div>

      {/* Financial breakdown */}
      <div style={{...card,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,color:"#8B7355"}}>Monto pactado</span>
          <span style={{fontWeight:600}}>{fmtCurrency(reserva.montoPactado)}</span>
        </div>
        {totalExtras>0 && (
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,color:"#8B7355"}}>+ Extras contratados</span>
            <span style={{fontWeight:600,color:"#D97706"}}>+{fmtCurrency(totalExtras)}</span>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,paddingTop:8,borderTop:"1px solid #EDE0D0"}}>
          <span style={{fontSize:13,fontWeight:700,color:"#1C1C1E"}}>Total del evento</span>
          <span style={{fontWeight:800,color:"#1C1C1E"}}>{fmtCurrency(totalEvento)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:saldo!==0?8:0}}>
          <span style={{fontSize:13,color:"#8B7355"}}>Total cobrado</span>
          <span style={{fontWeight:600,color:"#16A34A"}}>{fmtCurrency(totalPagado)}</span>
        </div>
        {saldo!==0 && (
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid #EDE0D0"}}>
            <span style={{fontSize:13,fontWeight:700,color:saldo>0?"#DC2626":"#16A34A"}}>
              {saldo>0?"⚠️ Saldo pendiente":"✅ Excedente"}
            </span>
            <span style={{fontWeight:800,color:saldo>0?"#DC2626":"#16A34A"}}>{fmtCurrency(Math.abs(saldo))}</span>
          </div>
        )}
      </div>

      {/* Extras section */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={labelStyle}>🎉 Extras contratados</div>
          <Btn small variant="secondary" onClick={onNewExtra}>+ Extra</Btn>
        </div>
        {resExtras.length===0 ? (
          <div style={{...card,padding:"12px 14px",textAlign:"center",color:"#8B7355",fontSize:13}}>Sin extras aún</div>
        ) : resExtras.map(e=>(
          <div key={e.id} style={{...card,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:"#1C1C1E"}}>{e.descripcion}</div>
              <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>x{e.cantidad} · {fmtCurrency(e.precioHistorico)} c/u</div>
            </div>
            <span style={{fontWeight:700,color:"#D97706",fontSize:14}}>{fmtCurrency(e.cantidad*e.precioHistorico)}</span>
          </div>
        ))}
      </div>

      {/* Payments timeline */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={labelStyle}>💰 Historial de cobros</div>
          <Btn small onClick={onNewPago}>+ Cobro</Btn>
        </div>
        {resPagos.length===0 ? (
          <div style={{...card,padding:"12px 14px",textAlign:"center",color:"#8B7355",fontSize:13}}>Sin cobros registrados</div>
        ) : (
          <div style={{position:"relative",paddingLeft:18}}>
            <div style={{position:"absolute",left:6,top:8,bottom:8,width:2,background:"#EDE0D0",borderRadius:1}} />
            {resPagos.map((p,i)=>(
              <div key={p.id} style={{position:"relative",paddingBottom:12}}>
                <div style={{position:"absolute",left:-14,top:4,width:10,height:10,borderRadius:5,background:"#16A34A",border:"2px solid #FFF",boxShadow:"0 0 0 2px #86EFAC"}} />
                <div style={{...card,padding:"10px 12px",marginLeft:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13,color:"#1C1C1E"}}>{p.metodo}</div>
                      <div style={{fontSize:12,color:"#8B7355",marginTop:1}}>{fmtDate(p.fecha)}{p.notas?` · ${p.notas}`:""}{p.creadoPor?<span style={{fontSize:10,color:"#C4C4C4",marginLeft:6}}>· {p.creadoPor}</span>:""}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontWeight:800,color:"#16A34A",fontSize:15}}>+{fmtCurrency(p.monto)}</span>
                      {canModifyCaja&&(
                        <>
                          <button onClick={()=>setEditingPago(p)} style={{background:"#EFF6FF",border:"1px solid #93C5FD",color:"#2563EB",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>✏️</button>
                          {confirmDelPagoId===p.id ? (
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>setConfirmDelPagoId(null)} style={{background:"#F3F4F6",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit",color:"#6B7280"}}>No</button>
                              <button onClick={()=>{onDeletePago(p.id);setConfirmDelPagoId(null);}} style={{background:"#DC2626",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",color:"#FFF"}}>Sí</button>
                            </div>
                          ) : (
                            <button onClick={()=>setConfirmDelPagoId(p.id)} style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>🗑️</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingPago&&<EditPagoModal pago={editingPago} onClose={()=>setEditingPago(null)} onSave={p=>{onEditPago(p);setEditingPago(null);}} />}

      {/* Reprogramar */}
      {showReschedule&&(
        <div style={{background:"#EFF6FF",border:"1.5px solid #93C5FD",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"#1D4ED8",marginBottom:8}}>📅 Reprogramar evento</div>
          <div style={{fontSize:12,color:"#3B82F6",marginBottom:10}}>Fecha original: <b>{fmtDate(reserva.fecha)}</b> — quedará asentada en las notas.</div>
          <input type="date" value={rescheduleDate} onChange={e=>setRescheduleDate(e.target.value)}
            min={toDateStr(new Date())}
            style={{...inputStyle,marginBottom:10}} />
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" onClick={()=>{setShowReschedule(false);setRescheduleDate("");}}>Cancelar</Btn>
            <Btn onClick={()=>{
              if(!rescheduleDate) return alert("Seleccioná la nueva fecha.");
              if(rescheduleDate===reserva.fecha) return alert("La nueva fecha es igual a la actual.");
              const nota="📌 Reprogramado desde: "+fmtDate(reserva.fecha)+(reserva.notas?"\n"+reserva.notas:"");
              onEdit({...reserva, fecha:rescheduleDate, notas:nota, _fromReschedule:true});
              setShowReschedule(false);setRescheduleDate("");
            }}>✅ Confirmar reprogramación</Btn>
          </div>
        </div>
      )}

      {/* Cancelación — Step 1: confirmación */}
      {cancelStep==="confirm"&&(
        <div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"#DC2626",marginBottom:6}}>⚠️ ¿Cancelar este evento?</div>
          <div style={{fontSize:12,color:"#5C4033",marginBottom:12}}>Esta acción cambiará el estado a "Cancelada". No se puede deshacer fácilmente.</div>
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" onClick={()=>setCancelStep(null)}>No, volver</Btn>
            <Btn variant="danger" onClick={()=>{ if(totalPagado>0){ setCancelStep("refund"); } else { onCancel(false); setCancelStep(null); } }}>Sí, cancelar</Btn>
          </div>
        </div>
      )}

      {/* Cancelación — Step 2: devolución de seña */}
      {cancelStep==="refund"&&(
        <div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"#DC2626",marginBottom:6}}>💰 Seña cobrada: {fmtCurrency(totalPagado)}</div>
          <div style={{fontSize:12,color:"#5C4033",marginBottom:12}}>¿Se reintegra la seña al cliente?</div>
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" onClick={()=>{ onCancel(false); setCancelStep(null); }}>No reintegrar</Btn>
            <Btn onClick={()=>{ onCancel(true); setCancelStep(null); }}>✅ Sí, reintegrar {fmtCurrency(totalPagado)}</Btn>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn small onClick={()=>onShowPDF(printReserva(reserva,cliente,recurso,resExtras,resPagos,negocio))}>🖨️ PDF</Btn>
        <Btn small variant="secondary" onClick={onEdit}>✏️ Editar</Btn>
        {canModifyCaja&&reserva.estado!=="cancelada"&&reserva.estado!=="finalizada"&&(
          <Btn small variant="secondary" onClick={()=>setShowReschedule(v=>!v)}>📅 Reprogramar</Btn>
        )}
        {onCancel&&canModifyCaja&&reserva.estado!=="cancelada"&&reserva.estado!=="finalizada"&&(
          <Btn small variant="danger" onClick={()=>setCancelStep("confirm")}>🚫 Cancelar</Btn>
        )}
        {!confirmDelete
          ? <Btn small variant="danger" onClick={()=>setConfirmDelete(true)}>🗑️</Btn>
          : <div style={{display:"flex",gap:6,alignItems:"center",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"4px 8px"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#DC2626"}}>¿Eliminar?</span>
              <Btn small variant="danger" onClick={onDelete}>Sí</Btn>
              <Btn small variant="ghost" onClick={()=>setConfirmDelete(false)}>No</Btn>
            </div>
        }
        <Btn small variant="ghost" onClick={onClose}>Cerrar</Btn>
      </div>
    </BottomModal>
  );
}

function ClienteDetail({ cliente, reservas, onClose, onEdit }) {
  const cr = reservas.filter(r=>r.clienteId===cliente.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const totalMonto = cr.reduce((s,r)=>s+r.montoPactado,0);
  const avg = getClientAvg(cliente.id, reservas);
  const notas = cr.filter(r=>r.calificacion?.nota).map(r=>({...r.calificacion,fecha:r.fecha}));
  return (
    <BottomModal title="Ficha de Cliente" onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
        <div style={{width:56,height:56,borderRadius:28,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:24,fontFamily:"'Playfair Display', serif"}}>
          {cliente.nombre?.[0]?.toUpperCase()||"?"}
        </div>
        <div>
          <div style={{fontWeight:800,fontSize:20,color:"#1C1C1E",fontFamily:"'Playfair Display', serif"}}>{clientName(cliente)}</div>
          {cliente.localidad && <div style={{fontSize:13,color:"#8B7355",marginTop:2}}>📍 {cliente.localidad}</div>}
          {cliente.email && <div style={{fontSize:13,color:"#8B7355",marginTop:2}}>✉️ {cliente.email}</div>}
        </div>
      </div>
      {cliente.whatsapp && (
        <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g,"")}?text=Hola%20${encodeURIComponent(cliente.nombre||"")}%2C%20te%20contacto%20por%20tu%20reserva%20en%20el%20quincho.`}
          target="_blank" rel="noreferrer"
          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#FFF",textDecoration:"none",padding:"12px 16px",borderRadius:10,fontWeight:700,fontSize:15,marginBottom:16}}>
          💬 Abrir WhatsApp · {cliente.whatsapp}
        </a>
      )}
      {avg!==null&&(
        <div style={{...card,padding:"14px 16px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Calificación promedio</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <StarRating value={Math.round(Number(avg))} readOnly />
            <span style={{fontSize:20,fontWeight:800,color:"#F59E0B",fontFamily:"'Playfair Display',serif"}}>{avg}/5</span>
          </div>
          {Number(avg)<=2&&<div style={{marginTop:8,padding:"8px 10px",background:"#FEF2F2",color:"#DC2626",borderRadius:8,fontSize:12,fontWeight:700}}>⚠️ Cliente con malas calificaciones previas</div>}
        </div>
      )}
      {notas.length>0&&(
        <div style={{...card,padding:"14px 16px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Historial de comportamiento</div>
          {notas.map((n,i)=>(
            <div key={i} style={{padding:"8px 0",borderBottom:i<notas.length-1?"1px solid #EDE0D0":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <StarRating value={n.estrellas} readOnly />
                <span style={{fontSize:11,color:"#8B7355"}}>{fmtDate(n.fecha)}</span>
              </div>
              {n.nota&&<div style={{fontSize:12,color:"#5C4033"}}>{n.nota}</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div style={{...card,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display', serif"}}>{cr.length}</div>
          <div style={{fontSize:11,color:"#8B7355"}}>Reservas totales</div>
        </div>
        <div style={{...card,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display', serif"}}>{fmtCurrency(totalMonto)}</div>
          <div style={{fontSize:11,color:"#8B7355"}}>Monto acumulado</div>
        </div>
      </div>
      {cr.slice(0,4).map(r=>(
        <div key={r.id} style={{...card,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{fmtDate(r.fecha)}</div>
            <TurnoBadge turno={r.turno} />
          </div>
          <StatusBadge estado={r.estado} />
        </div>
      ))}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
        <Btn small variant="secondary" onClick={onEdit}>✏️ Editar</Btn>
        <Btn small variant="ghost" onClick={onClose}>Cerrar</Btn>
      </div>
    </BottomModal>
  );
}


function EditPagoModal({ pago, onClose, onSave }) {
  const [monto, setMonto] = useState(String(pago.monto));
  const [metodo, setMetodo] = useState(pago.metodo);
  const [notas, setNotas] = useState(pago.notas||"");
  return (
    <BottomModal title="Editar Cobro" onClose={onClose}>
      <div style={{marginBottom:12,padding:"10px 14px",background:"#F9F6F2",borderRadius:8,fontSize:12,color:"#8B7355"}}>
        Cobro del {fmtDate(pago.fecha)}
      </div>
      <Input label="Monto ($)" type="number" value={monto} onChange={setMonto} required onFocus={e=>e.target.select()} />
      <Select label="Método de pago" value={metodo} onChange={setMetodo}
        options={PAYMENT_METHODS.map(m=>({value:m,label:m}))} />
      <TextArea label="Notas" value={notas} onChange={setNotas} rows={2} placeholder="Referencia, comprobante..." />
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{
          if(!monto||Number(monto)<=0) return alert("El monto debe ser mayor a 0.");
          onSave({...pago, monto:Number(monto), metodo, notas});
        }}>Guardar cambios</Btn>
      </div>
    </BottomModal>
  );
}

function DayModal({ date, dayRes, clientes, onClose, onNewReserva, onReservaClick, bloqueosDia, onBloquear, canBloquear, turnosRecurso, espacioFiltro }) {
  const bloqueosDiaArr = bloqueosDia||[];
  const hayBloqueoCompleto = bloqueosDiaArr.some(b=>b.turno==="completo");
  // Para compatibilidad con código viejo que usa bloqueo singular
  const bloqueo = bloqueosDiaArr.find(b=>b.turno==="completo") || bloqueosDiaArr[0] || null;

  const [mode, setMode] = useState(bloqueosDiaArr.length>0 ? "bloqueo" : "reserva");
  const [bTurno, setBTurno] = useState("completo");
  const [bMotivo, setBMotivo] = useState("");
  const [confirmUnblockId, setConfirmUnblockId] = useState(null);

  const todosLosTurnos = turnosRecurso||[];
  const espacioEfectivo = (()=>{
    if(espacioFiltro && espacioFiltro !== "all" && espacioFiltro !== "todos") return espacioFiltro;
    const idsConTurnos = [...new Set(todosLosTurnos.map(t=>t.recursoId))];
    if(idsConTurnos.length===1) return idsConTurnos[0];
    return null;
  })();
  const turnosDelEspacio = espacioEfectivo
    ? todosLosTurnos.filter(t=>t.recursoId===espacioEfectivo && t.activo!==false)
    : [];
  const usaTurnosCustom = turnosDelEspacio.length > 0;
  const modoAgenda = turnosDelEspacio.length > 4;

  // Slot bloqueado: reserva con ese turnoId O bloqueo con ese turnoId O bloqueo completo
  const isSlotBloqueado = (turnoId) =>
    hayBloqueoCompleto || bloqueosDiaArr.some(b=>b.turno===turnoId);
  const isOccCustom = (turnoId) =>
    dayRes.some(r=>r.turnoId===turnoId);

  const isBlocked = t => hayBloqueoCompleto || bloqueosDiaArr.some(b=>b.turno===t);
  const isOcc = t => {
    if(t==="completo") return dayRes.some(r=>r.turno!==undefined) || hayBloqueoCompleto;
    return dayRes.some(r=>r.turno===t||r.turno==="completo") || isBlocked(t);
  };

  return (
    <BottomModal title={`📅 ${fmtDate(date)}`} onClose={onClose}>

      {/* Reservas existentes del día */}
      {dayRes.length > 0 && (
        <div style={{marginBottom:14}}>
          {dayRes.map(r => {
            const c = clientes.find(x=>x.id===r.clienteId);
            return (
              <div key={r.id} onClick={()=>{onReservaClick(r);onClose();}}
                style={{...card,padding:"10px 14px",marginBottom:6,cursor:"pointer",
                  borderLeft:`3px solid ${TURNOS[r.turno]?.color||"#C4602B"}`,borderRadius:"0 10px 10px 0",
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>{clientName(c)}</div>
                  <TurnoBadge turno={r.turno} />
                </div>
                <StatusBadge estado={r.estado} />
              </div>
            );
          })}
        </div>
      )}

      {/* Bloqueos activos del día */}
      {bloqueosDiaArr.length>0 && mode !== "bloqueo" && (
        <div style={{marginBottom:12}}>
          {bloqueosDiaArr.map(bl=>{
            const turnoNombre = turnosDelEspacio.find(t=>t.id===bl.turno)?.nombre || TURNOS[bl.turno]?.label || (bl.turno==="completo"?"Día completo":bl.turno);
            return (
              <div key={bl.id} style={{background:"#1F2937",color:"#D1D5DB",padding:"10px 14px",borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:2}}>🚫 {turnoNombre} bloqueado</div>
                  <div style={{fontSize:11}}>{bl.motivo}</div>
                </div>
                {canBloquear && (
                  <button onClick={()=>onBloquear(bl)}
                    style={{padding:"5px 10px",background:"#DC2626",border:"none",borderRadius:7,color:"#FFF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:10}}>
                    🔓
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selector de modo (solo si tiene permiso de bloqueo) */}
      {canBloquear && (
        <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:10,overflow:"hidden",border:"1.5px solid #EDE0D0"}}>
          <button onClick={()=>setMode("reserva")} style={{
            flex:1,padding:"10px 6px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer",
            fontFamily:"inherit",transition:"all 0.15s",
            background:mode==="reserva"?"#C4602B":"#FDF8F3",
            color:mode==="reserva"?"#FFF":"#8B7355",
          }}>📅 Registrar Reserva</button>
          <button onClick={()=>setMode("bloqueo")} style={{
            flex:1,padding:"10px 6px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer",
            fontFamily:"inherit",transition:"all 0.15s",
            background:mode==="bloqueo"?"#1F2937":"#FDF8F3",
            color:mode==="bloqueo"?"#FFF":"#6B7280",
          }}>⚠️ Bloquear Fecha</button>
        </div>
      )}

      {/* MODO RESERVA */}
      {mode === "reserva" && (
        <div>
          {/* Resumen del día — solo en modo agenda (cancha/slots) */}
          {modoAgenda && usaTurnosCustom && (()=>{
            const esFinde=(()=>{try{const d=new Date(date+"T12:00:00");const dow=d.getDay();return dow===0||dow===6;}catch(e){return false;}})();
            const ocupados = turnosDelEspacio.filter(t=>isOccCustom(t.id)).length;
            const libres = turnosDelEspacio.length - ocupados;
            const potencialDia = turnosDelEspacio.reduce((s,t)=>s+(esFinde?t.precioFinde:t.precioSemana),0);
            const cobradoDia = dayRes.reduce((s,r)=>s+(r.montoPactado||0),0);
            const pct = turnosDelEspacio.length>0 ? Math.round((ocupados/turnosDelEspacio.length)*100) : 0;
            const barColor = pct===100?"#DC2626":pct>=60?"#D97706":"#16A34A";
            return (
              <div style={{background:"#F9F6F2",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #EDE0D0"}}>
                {/* Barra de ocupación */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#1C1C1E"}}>{ocupados} ocupados · {libres} libres</span>
                  <span style={{fontSize:11,fontWeight:700,color:barColor}}>{pct}%</span>
                </div>
                <div style={{background:"#E5E7EB",borderRadius:4,height:6,marginBottom:10,overflow:"hidden"}}>
                  <div style={{width:pct+"%",height:"100%",background:barColor,borderRadius:4,transition:"width 0.3s"}} />
                </div>
                {/* Números clave */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{background:"#FFF",borderRadius:8,padding:"8px 10px",border:"1px solid #EDE0D0"}}>
                    <div style={{fontSize:10,color:"#8B7355",marginBottom:2}}>Reservas cobradas</div>
                    <div style={{fontSize:15,fontWeight:800,color:"#16A34A"}}>{fmtCurrency(cobradoDia)}</div>
                  </div>
                  <div style={{background:"#FFF",borderRadius:8,padding:"8px 10px",border:"1px solid #EDE0D0"}}>
                    <div style={{fontSize:10,color:"#8B7355",marginBottom:2}}>Potencial del día</div>
                    <div style={{fontSize:15,fontWeight:800,color:"#C4602B"}}>{fmtCurrency(potencialDia)}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{...lbl, marginBottom:8}}>Turnos del día</div>

          {/* Turnos configurados del espacio */}
          {usaTurnosCustom ? (
            <div style={modoAgenda
              ? {maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}
              : {display:"flex",gap:8,flexWrap:"wrap"}}>
              {turnosDelEspacio.map(t=>{
                const busy = isOccCustom(t.id);
                const res = dayRes.find(r=>r.turnoId===t.id);
                const bloqueado = isSlotBloqueado(t.id); // incluye bloqueo completo Y por slot
                const finalBusy = busy || bloqueado;
                const esFinde = (()=>{try{const d=new Date(date+"T12:00:00");const dow=d.getDay();return dow===0||dow===6;}catch(e){return false;}})();
                const precio = esFinde ? t.precioFinde : t.precioSemana;

                if(modoAgenda) {
                  const cli = res ? clientes.find(c=>c.id===res.clienteId) : null;
                  return (
                    <button key={t.id}
                      onClick={()=>{ if(busy&&res){onReservaClick(res);onClose();}else if(!finalBusy){onNewReserva(date,t.id,t);onClose();} }}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:7,
                        border:`1px solid ${bloqueado?"#374151":busy?"#FECACA":"#EDE0D0"}`,
                        background:bloqueado?"#1F2937":busy?"#FEF2F2":"#FFF",
                        cursor:(busy&&res)||!finalBusy?"pointer":"default",fontFamily:"inherit",textAlign:"left"}}>
                      <div style={{fontSize:11,fontWeight:700,color:bloqueado?"#9CA3AF":"#8B7355",width:90,flexShrink:0}}>{t.horaInicio} – {t.horaFin}</div>
                      {busy ? (
                        <div style={{flex:1,fontSize:12,fontWeight:700,color:"#DC2626"}}>{cli?clientName(cli):"🔴 Ocupado"}</div>
                      ) : bloqueado ? (
                        <div style={{flex:1,fontSize:12,color:"#6B7280"}}>🚫 Bloqueado</div>
                      ) : (
                        <div style={{flex:1,fontSize:12,color:"#16A34A",fontWeight:600}}>✅ Disponible</div>
                      )}
                      <div style={{fontSize:11,color:busy?"#DC2626":bloqueado?"#6B7280":"#C4602B",fontWeight:700,flexShrink:0}}>{fmtCurrency(precio||0)}</div>
                    </button>
                  );
                }

                // Vista botones grandes (≤4 turnos)
                const cli = res ? clientes.find(c=>c.id===res.clienteId) : null;
                const h = parseInt((t.horaInicio||"12").split(":")[0]);
                const icon = bloqueado?"🚫":busy?"🔒":h<12?"☀️":h<18?"🌤️":h<21?"🌆":"🌙";
                const bgColor = bloqueado?"#1F2937":busy?"#F3F4F6":"#FFF8F5";
                const borderColor = bloqueado?"#374151":busy?"#E5E7EB":"#C4602B66";
                const textColor = bloqueado?"#6B7280":busy?"#9CA3AF":"#1C1C1E";
                return (
                  <button key={t.id}
                    onClick={()=>{ if(busy&&res){onReservaClick(res);onClose();}else if(!finalBusy){onNewReserva(date,t.id,t);onClose();} }}
                    disabled={bloqueado}
                    style={{flex:"1 1 calc(33% - 8px)",minWidth:80,padding:"14px 8px",borderRadius:10,
                      fontSize:13,fontWeight:600,cursor:bloqueado?"not-allowed":"pointer",
                      background:bgColor,color:textColor,
                      border:`1.5px solid ${borderColor}`,
                      fontFamily:"inherit",textAlign:"center",
                      opacity:bloqueado?0.6:1}}>
                    <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
                    <div style={{fontWeight:700,fontSize:12}}>{t.nombre}</div>
                    <div style={{fontSize:10,color:busy?"#9CA3AF":"#8B7355",marginTop:2}}>{t.horaInicio}–{t.horaFin}</div>
                    {busy ? (
                      <div style={{marginTop:4,fontSize:10,fontWeight:700,color:"#DC2626"}}>{cli?clientName(cli):"Ocupado"}</div>
                    ) : bloqueado ? (
                      <div style={{marginTop:4,fontSize:10,color:"#6B7280"}}>Bloqueado</div>
                    ) : (
                      <div style={{marginTop:4,fontSize:10,fontWeight:700,color:"#C4602B"}}>{fmtCurrency(precio||0)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Turnos genéricos (fallback cuando no hay turnos configurados en el espacio) */
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {Object.entries(TURNOS).map(([k,v]) => {
                const busy = isOcc(k);
                return (
                  <button key={k} onClick={()=>{ if(!busy){ onNewReserva(date,k); onClose(); }}}
                    disabled={busy}
                    style={{flex:"1 1 calc(33% - 8px)",padding:"14px 8px",borderRadius:10,fontSize:13,
                      fontWeight:600,cursor:busy?"not-allowed":"pointer",
                      background:isBlocked(k)?"#1F2937":busy?"#F5F5F5":v.bg,
                      color:isBlocked(k)?"#6B7280":busy?"#CCC":v.color,
                      border:`1.5px solid ${isBlocked(k)?"#374151":busy?"#EEE":v.color+"66"}`,
                      fontFamily:"inherit",textAlign:"center",opacity:busy?0.7:1}}>
                    <div style={{fontSize:22,marginBottom:4}}>{v.icon}</div>
                    <div>{v.label}</div>
                    {busy && <div style={{fontSize:10,marginTop:2,fontWeight:700}}>{isBlocked(k)?"🚫 Bloqueado":"Ocupado"}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODO BLOQUEO */}
      {mode === "bloqueo" && (
        <div>
          {/* Bloqueos existentes con confirmación de desbloqueo */}
          {bloqueosDiaArr.length>0 && (
            <div style={{marginBottom:16}}>
              {bloqueosDiaArr.map(bl=>{
                const turnoNombre = turnosDelEspacio.find(t=>t.id===bl.turno)?.nombre || TURNOS[bl.turno]?.label || (bl.turno==="completo"?"Día completo":bl.turno);
                return (
                  <div key={bl.id} style={{background:"#1F2937",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"#FFF"}}>🚫 {turnoNombre}</div>
                      <div style={{fontSize:11,color:"#9CA3AF",fontStyle:"italic"}}>"{bl.motivo}"</div>
                    </div>
                    {confirmUnblockId===bl.id ? (
                      <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                        <button onClick={()=>setConfirmUnblockId(null)} style={{padding:"5px 8px",background:"#374151",border:"none",borderRadius:6,color:"#FFF",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>No</button>
                        <button onClick={()=>{onBloquear(bl);setConfirmUnblockId(null);}} style={{padding:"5px 8px",background:"#DC2626",border:"none",borderRadius:6,color:"#FFF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Sí</button>
                      </div>
                    ) : (
                      <button onClick={()=>setConfirmUnblockId(bl.id)} style={{padding:"5px 10px",background:"#DC2626",border:"none",borderRadius:7,color:"#FFF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:8}}>🔓</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Si hay bloqueo completo, no tiene sentido agregar más */}
          {hayBloqueoCompleto ? (
            <div style={{fontSize:12,color:"#8B7355",textAlign:"center",padding:"8px 0"}}>El día completo está bloqueado. Desbloquealo para agregar turnos individuales.</div>
          ) : (
            /* Nuevo bloqueo */
            <div>
              <div style={{...lbl, marginBottom:10}}>Alcance del bloqueo</div>

              {usaTurnosCustom ? (
                /* Turnos del espacio + opción día completo */
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                  {/* Día completo siempre disponible */}
                  <button onClick={()=>setBTurno("completo")}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${bTurno==="completo"?"#374151":"#EDE0D0"}`,background:bTurno==="completo"?"#1F2937":"#FDF8F3",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                    <span style={{fontSize:20}}>🚫</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:bTurno==="completo"?"#FFF":"#1C1C1E"}}>Día completo</div>
                      <div style={{fontSize:11,color:bTurno==="completo"?"#9CA3AF":"#8B7355"}}>Bloquea todos los turnos del día</div>
                    </div>
                  </button>
                  {/* Turnos individuales — todos los modos */}
                  {modoAgenda ? (
                    /* Cancha: lista compacta scrollable */
                    <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:3,marginTop:6}}>
                      {turnosDelEspacio.map(t=>{
                        const sel = bTurno===t.id;
                        const yaBloqueado = bloqueosDiaArr.some(b=>b.turno===t.id);
                        return (
                          <button key={t.id} onClick={()=>!yaBloqueado&&setBTurno(t.id)} disabled={yaBloqueado}
                            style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",borderRadius:6,border:`1px solid ${sel?"#374151":"#EDE0D0"}`,background:yaBloqueado?"#374151":sel?"#1F2937":"#FFF",cursor:yaBloqueado?"default":"pointer",fontFamily:"inherit",opacity:yaBloqueado?0.6:1}}>
                            <span style={{fontSize:12,fontWeight:700,color:sel||yaBloqueado?"#FFF":"#1C1C1E"}}>{t.horaInicio} – {t.horaFin}</span>
                            {yaBloqueado && <span style={{fontSize:10,color:"#9CA3AF"}}>🚫 ya bloqueado</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Quincho ≤4: botones grandes */
                    turnosDelEspacio.map(t=>{
                      const sel = bTurno===t.id;
                      const h = parseInt((t.horaInicio||"12").split(":")[0]);
                      const icon = h<12?"☀️":h<18?"🌤️":h<21?"🌆":"🌙";
                      return (
                        <button key={t.id} onClick={()=>setBTurno(t.id)}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${sel?"#374151":"#EDE0D0"}`,background:sel?"#1F2937":"#FDF8F3",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                          <span style={{fontSize:20}}>{icon}</span>
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:sel?"#FFF":"#1C1C1E"}}>{t.nombre}</div>
                            <div style={{fontSize:11,color:sel?"#9CA3AF":"#8B7355"}}>{t.horaInicio} – {t.horaFin}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Turnos genéricos */
                <div style={{display:"flex",gap:0,borderRadius:10,overflow:"hidden",border:"1px solid #EDE0D0",marginBottom:14}}>
                  {Object.entries(TURNOS).map(([k,v]) => (
                    <button key={k} onClick={()=>setBTurno(k)} style={{
                      flex:1,padding:"9px 4px",fontWeight:700,fontSize:11,border:"none",cursor:"pointer",
                      fontFamily:"inherit",textAlign:"center",
                      background:bTurno===k?"#374151":"#FDF8F3",
                      color:bTurno===k?"#FFF":"#374151",
                    }}>
                      {v.icon}<div style={{fontSize:9,marginTop:2}}>{v.label}</div>
                    </button>
                  ))}
                </div>
              )}

              <div style={{marginBottom:16}}>
                <div style={{...lbl, marginBottom:6}}>Motivo del bloqueo *</div>
                <input value={bMotivo} onChange={e=>setBMotivo(e.target.value)}
                  placeholder="Ej: Cumple de Bere, Mantenimiento..."
                  style={{...inputStyle}} />
              </div>
              <button onClick={()=>{
                  if(!bMotivo.trim()){alert("El motivo es obligatorio.");return;}
                  onBloquear({turno:bTurno, motivo:bMotivo.trim()});
                }}
                style={{width:"100%",padding:"13px",background:"#1F2937",border:"none",borderRadius:10,color:"#FFF",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                🚫 Confirmar Bloqueo
              </button>
            </div>
          )}
        </div>
      )}
    </BottomModal>
  );
}

function LoginScreen({ usuarios, onLogin }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const active = usuarios.filter(u=>u.estado==="Activo");

  const handlePinLogin = () => {
    if(!selectedUser) return;
    if(pin === selectedUser.pin) {
      onLogin(selectedUser);
    } else {
      setErr("PIN incorrecto. Intentá de nuevo.");
      setPin("");
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"linear-gradient(160deg,#FDF8F3 0%,#F0E8DC 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,zIndex:9999}}>
      <LogoSVG size={72} color="#C4602B" />
      <div style={{marginTop:12,fontSize:10,fontWeight:700,color:"#C4602B",letterSpacing:3,textTransform:"uppercase"}}>El Quincho</div>
      <div style={{fontSize:28,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display',serif",lineHeight:1.1,marginBottom:4}}>de Bere</div>
      <div style={{fontSize:12,color:"#8B7355",marginBottom:28,letterSpacing:0.5}}>Tu lugar de descanso y diversión</div>
      <div style={{width:"100%",maxWidth:360}}>
        {!selectedUser ? (
          <>
            <div style={{fontSize:12,fontWeight:700,color:"#5C4033",textAlign:"center",marginBottom:14,textTransform:"uppercase",letterSpacing:0.5}}>¿Quién está ingresando?</div>
            {active.map(u=>(
              <button key={u.id} onClick={()=>{setSelectedUser(u);setPin("");setErr("");}} style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"14px 18px",background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:12,cursor:"pointer",marginBottom:10,fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,96,43,0.08)"}}>
                <div style={{width:44,height:44,borderRadius:22,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:18,flexShrink:0,fontFamily:"'Playfair Display',serif"}}>{(u.nombre?.charAt(0)||"?").toUpperCase()}</div>
                <div style={{textAlign:"left"}}><div style={{fontWeight:700,fontSize:15,color:"#1C1C1E"}}>{u.nombre} {u.apellido||""}</div><div style={{fontSize:11,color:"#8B7355",marginTop:2}}>{u.puesto||u.rol}</div></div>
                <div style={{marginLeft:"auto",fontSize:18,color:"#C4602B"}}>→</div>
              </button>
            ))}
          </>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:"12px 16px",background:"#FFF",borderRadius:12,border:"1.5px solid #EDE0D0"}}>
              <div style={{width:40,height:40,borderRadius:20,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:16,fontFamily:"'Playfair Display',serif"}}>{(selectedUser.nombre?.charAt(0)||"?").toUpperCase()}</div>
              <div style={{fontWeight:700,fontSize:15,color:"#1C1C1E"}}>{selectedUser.nombre} {selectedUser.apellido||""}</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"#5C4033",textAlign:"center",marginBottom:12,textTransform:"uppercase",letterSpacing:0.5}}>Ingresá tu PIN</div>
            <input value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handlePinLogin()}
              placeholder="••••" type="password" maxLength={4}
              style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"1.5px solid #EDE0D0",fontSize:24,marginBottom:10,outline:"none",fontFamily:"inherit",boxSizing:"border-box",textAlign:"center",letterSpacing:8}} />
            {err&&<div style={{color:"#DC2626",fontSize:12,marginBottom:10,textAlign:"center",fontWeight:600}}>{err}</div>}
            <button onClick={handlePinLogin} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#C4602B,#9E4A1E)",color:"#FFF",border:"none",borderRadius:10,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
              Ingresar
            </button>
            <button onClick={()=>{setSelectedUser(null);setErr("");setPin("");}} style={{width:"100%",padding:"10px",background:"transparent",border:"1.5px solid #EDE0D0",borderRadius:10,color:"#8B7355",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
              ← Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── USUARIOS VIEW ────────────────────────────────────────

function UsuariosView({ usuarios, setUsuarios, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({nombre:"",email:"",rol:"Personal",estado:"Activo",pin:""});
  const save = async d => { setUsuarios(d); await sb.upsert("usuarios", d.map(mapUsuario)); };
  if(currentUser?.rol!=="Administrador") return (
    <div style={{padding:"40px 20px",textAlign:"center",color:"#8B7355"}}>
      <div style={{fontSize:40,marginBottom:12}}>🔒</div>
      <div style={{fontWeight:700,fontSize:16}}>Solo los administradores pueden gestionar usuarios</div>
    </div>
  );
  return (
    <div style={{padding:"16px 16px 100px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>👤 Usuarios del sistema</div>
        <Btn small onClick={()=>setShowForm(true)}>+ Agregar</Btn>
      </div>
      {usuarios.map(u=>(
        <div key={u.id} style={{...card,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:21,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:17,flexShrink:0,fontFamily:"'Playfair Display',serif"}}>{(u.nombre?.charAt(0)||"?").toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{u.nombre}</div>
            <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{u.email} · {u.rol}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,background:u.estado==="Activo"?"#D1FAE5":"#FEE2E2",color:u.estado==="Activo"?"#16A34A":"#DC2626"}}>{u.estado}</span>
            <Btn small variant="secondary" onClick={()=>save(usuarios.map(x=>x.id===u.id?{...x,estado:x.estado==="Activo"?"Inactivo":"Activo"}:x))}>
              {u.estado==="Activo"?"Desactivar":"Activar"}
            </Btn>
            {u.id!=="u1"&&<Btn small variant="danger" onClick={()=>save(usuarios.filter(x=>x.id!==u.id))}>🗑️</Btn>}
          </div>
        </div>
      ))}
      {showForm&&(
        <BottomModal title="Nuevo Usuario" onClose={()=>setShowForm(false)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Nombre" value={form.nombre} onChange={v=>setForm(p=>({...p,nombre:v}))} placeholder="Cristian" />
            <Input label="Apellido" value={form.apellido||""} onChange={v=>setForm(p=>({...p,apellido:v}))} placeholder="Manzo" />
          </div>
          <Input label="Email" value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="correo@ejemplo.com" />
          <Input label="PIN de acceso (4 dígitos)" type="password" value={form.pin||""} onChange={v=>setForm(p=>({...p,pin:v}))} placeholder="ej: 1234" maxLength={4} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="WhatsApp" value={form.whatsapp||""} onChange={v=>setForm(p=>({...p,whatsapp:v}))} placeholder="+54 11..." />
            <Input label="Puesto / Función" value={form.puesto||""} onChange={v=>setForm(p=>({...p,puesto:v}))} placeholder="Administrador" />
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#5C4033",marginBottom:8,textTransform:"uppercase",letterSpacing:0.6}}>Permisos</label>
            {[["permisoRoot","Permiso Root (acceso total)"],["verFinanzas","Ver Reportes y Finanzas"],["modificarCaja","Modificar / Eliminar Cobros y Gastos"],["gestionOperativa","Gestión Operativa (reservas, clientes, bloqueos)"]].map(([k,l])=>(
              <label key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #F5EDE4",cursor:"pointer"}}>
                <input type="checkbox" checked={!!form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.checked}))} style={{width:16,height:16,accentColor:"#C4602B"}} />
                <span style={{fontSize:13,color:"#1C1C1E"}}>{l}</span>
              </label>
            ))}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn onClick={()=>{
              if(!form.nombre||!form.email) return alert("Completá nombre e email.");
              if(!form.pin||form.pin.length!==4) return alert("El PIN debe tener 4 dígitos.");
              save([...usuarios,{id:genId(),...form}]);
              setShowForm(false); setForm({nombre:"",email:"",rol:"Personal",estado:"Activo",pin:""});
            }}>Guardar</Btn>
          </div>
        </BottomModal>
      )}
    </div>
  );
}


// ─── ALERTA RECORDATORIO MODAL ───────────────────────────

function AlertaRecordatorioModal({ alerta, clientes, reservas, onClose, onVerCliente, onVerEvento, onNewPago, onSnooze, onDone, negocio }) {
  const c = clientes.find(x=>x.id===alerta.clienteId);
  const r = reservas.find(x=>x.id===alerta.reservaId);
  const waMsg = c&&c.whatsapp
    ? "Hola "+clientName(c)+"! Te contactamos desde "+(negocio?.nombreNegocio||"nuestro negocio")+". "+alerta.nota
    : null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,14,8,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:20}}>
      <div style={{background:"#FFF",borderRadius:20,width:"100%",maxWidth:420,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:8}}>🔔</div>
          <div style={{fontSize:11,fontWeight:700,color:"#C4602B",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Recordatorio</div>
          <div style={{fontSize:18,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display',serif",marginBottom:4}}>{alerta.tipo}</div>
          {alerta.nota&&<div style={{fontSize:13,color:"#5C4033",background:"#FEF0E8",borderRadius:8,padding:"8px 12px",marginTop:8}}>📝 {alerta.nota}</div>}
          {c&&<div style={{fontSize:13,color:"#8B7355",marginTop:8}}>👤 {clientName(c)}</div>}
          <div style={{fontSize:12,color:"#B5A090",marginTop:4}}>🗓 {fmtDate(alerta.fechaAlerta)} · {alerta.horaAlerta}hs</div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {c&&<button onClick={onVerCliente} style={btnStyle("#EFF6FF","#2563EB")}>👤 Ver Cliente</button>}
          {r&&<button onClick={onVerEvento} style={btnStyle("#FEF0E8","#C4602B")}>📋 Ver Evento</button>}
          {alerta.tipo==="Cobro pendiente"&&r&&(
            <button onClick={onNewPago} style={btnStyle("#F0FDF4","#16A34A")}>💰 Registrar Pago</button>
          )}
          {waMsg&&(
            <a href={"https://wa.me/"+c.whatsapp.replace(/\D/g,"")+"?text="+encodeURIComponent(waMsg)}
              target="_blank" rel="noreferrer"
              style={{...btnStyle("#F0FDF4","#16A34A"),display:"block",textDecoration:"none",textAlign:"center"}}>
              💬 Enviar Mensaje WA
            </a>
          )}

          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>onSnooze(1)} style={{...btnStyle("#FEF3C7","#D97706"),flex:1,fontSize:12}}>⏰ +1 hora</button>
            <button onClick={()=>onSnooze(24)} style={{...btnStyle("#FEF3C7","#D97706"),flex:1,fontSize:12}}>⏰ Mañana</button>
          </div>
          <button onClick={onDone} style={btnStyle("#DCFCE7","#16A34A")}>✅ Marcar como procesado</button>
          <button onClick={onClose} style={{padding:"10px",background:"transparent",border:"1.5px solid #EDE0D0",borderRadius:10,color:"#8B7355",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg,color){
  return {padding:"11px 14px",background:bg,border:"none",borderRadius:10,color:color,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"center"};
}

// ─── PRINT MODAL ─────────────────────────────────────────

function PrintModal({ data, onClose }) {
  const handlePrint = () => {
    const w = window.open("","_blank");
    w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>"+data.title+"</title></head><body>"+data.html+"</body></html>");
    w.document.close();
    setTimeout(()=>{ w.print(); },500);
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#FFF",borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:500}}>
        <div style={{fontWeight:800,fontSize:16,color:"#1C1C1E",marginBottom:16,fontFamily:"'Playfair Display',serif"}}>🖨️ {data.title}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {data.waPhone&&data.waMsg&&(
            <a href={"https://wa.me/"+data.waPhone.replace(/\D/g,"")+"?text="+encodeURIComponent(data.waMsg)}
              target="_blank" rel="noreferrer"
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#FFF",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,textDecoration:"none"}}>
              💬 Enviar Recibo por WhatsApp
            </a>
          )}
          <button onClick={handlePrint} style={{background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,padding:"13px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>🖨️ Imprimir / Guardar PDF</button>
          <button onClick={onClose} style={{background:"#F3F4F6",color:"#1C1C1E",border:"none",borderRadius:10,padding:"13px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}



// ─── STAR RATING ─────────────────────────────────────────

function StarRating({ value, onChange, readOnly }) {
  return (
    <div style={{display:"flex",gap:4}}>
      {[1,2,3,4,5].map(i=>(
        <button key={i} onClick={()=>!readOnly&&onChange&&onChange(i)}
          style={{background:"none",border:"none",fontSize:readOnly?18:30,cursor:readOnly?"default":"pointer",color:i<=value?"#F59E0B":"#D1D5DB",padding:"0 2px",lineHeight:1}}>★</button>
      ))}
    </div>
  );
}

function getClientAvg(clienteId, reservas) {
  const rated = reservas.filter(r=>r.clienteId===clienteId&&r.calificacion?.estrellas);
  if(!rated.length) return null;
  return (rated.reduce((s,r)=>s+r.calificacion.estrellas,0)/rated.length).toFixed(1);
}

function RatingModal({ reserva, clientes, onSave, onSnooze }) {
  const c = clientes.find(x=>x.id===reserva.clienteId);
  const [estrellas, setEstrellas] = useState(0);
  const [nota, setNota] = useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,14,8,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:20}}>
      <div style={{background:"#FFF",borderRadius:20,width:"100%",maxWidth:440,padding:28,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:36,marginBottom:8}}>⭐</div>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Evento finalizado</div>
          <div style={{fontSize:20,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display',serif"}}>{clientName(c)}</div>
          <div style={{fontSize:13,color:"#8B7355",marginTop:4}}>{fmtDate(reserva.fecha)} · {TURNOS[reserva.turno]?.label}</div>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#5C4033",marginBottom:10,textAlign:"center"}}>¿Cómo se portó el cliente?</div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:6}}>
            <StarRating value={estrellas} onChange={setEstrellas} />
          </div>
          {estrellas>0&&<div style={{textAlign:"center",fontSize:12,color:"#8B7355"}}>
            {["","Muy malo","Malo","Regular","Bueno","Excelente"][estrellas]}
          </div>}
        </div>
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:"#5C4033",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Notas de comportamiento</label>
          <textarea value={nota} onChange={e=>setNota(e.target.value)} rows={3} placeholder="Ej: Dejó todo limpio, trajo más gente de la pactada..."
            style={{width:"100%",padding:"10px 12px",borderRadius:8,fontSize:13,border:"1.5px solid #EDE0D0",outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}} />
        </div>
        <button onClick={()=>{
          if(!estrellas) return alert("Por favor seleccioná una calificación de 1 a 5 estrellas.");
          onSave({estrellas, nota, fecha:toDateStr(new Date())});
        }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#C4602B,#9E4A1E)",color:"#FFF",border:"none",borderRadius:10,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
          Guardar calificación
        </button>
        <button onClick={onSnooze} style={{width:"100%",padding:"10px",background:"transparent",color:"#8B7355",border:"1.5px solid #EDE0D0",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Calificar más tarde (recordar mañana)
        </button>
      </div>
    </div>
  );
}


// ─── BLOQUEO MODAL ────────────────────────────────────────

function BloqueoModal({ date, bloqueoExistente, onClose, onBloquear, onDesbloquear }) {
  const [turno, setTurno] = useState("completo");
  const [motivo, setMotivo] = useState("");

  if (bloqueoExistente) {
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(28,14,8,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2500,padding:20}}>
        <div style={{background:"#FFF",borderRadius:16,width:"100%",maxWidth:380,padding:28,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>🔒</div>
          <div style={{fontWeight:800,fontSize:18,color:"#1C1C1E",marginBottom:6}}>Fecha bloqueada</div>
          <div style={{fontSize:13,color:"#8B7355",marginBottom:4}}>{fmtDate(date)}</div>
          <div style={{background:"#F3F4F6",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:13,color:"#374151"}}>
            <b>{TURNOS[bloqueoExistente.turno]?.icon||"🚫"} {TURNOS[bloqueoExistente.turno]?.label||"Día Completo"}</b><br/>
            {bloqueoExistente.motivo}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{flex:1,padding:"11px",background:"#F3F4F6",border:"none",borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit",color:"#6B7280"}}>Cancelar</button>
            <button onClick={()=>onDesbloquear(bloqueoExistente.id)} style={{flex:1,padding:"11px",background:"#DC2626",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",color:"#FFF"}}>🔓 Desbloquear</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BottomModal title={`⚠️ Bloquear ${fmtDate(date)}`} onClose={onClose}>
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:"#5C4033",marginBottom:8,textTransform:"uppercase",letterSpacing:0.6}}>Alcance del bloqueo</label>
        <div style={{display:"flex",gap:0,borderRadius:10,overflow:"hidden",border:"1px solid #EDE0D0"}}>
          {Object.entries(TURNOS).map(([k,v])=>(
            <button key={k} onClick={()=>setTurno(k)} style={{flex:1,padding:"9px 4px",fontWeight:700,fontSize:11,border:"none",cursor:"pointer",fontFamily:"inherit",background:turno===k?"#374151":"#FDF8F3",color:turno===k?"#FFF":"#374151",transition:"all 0.15s"}}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:"#5C4033",marginBottom:6,textTransform:"uppercase",letterSpacing:0.6}}>Motivo del bloqueo *</label>
        <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ej: Cumple de Bere, Mantenimiento..."
          style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} />
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{ if(!motivo.trim()) return alert("El motivo es obligatorio."); onBloquear({turno,motivo:motivo.trim()}); }}>
          🚫 Confirmar bloqueo
        </Btn>
      </div>
    </BottomModal>
  );
}

// ─── RECORDATORIOS VIEW ───────────────────────────────────

const TIPO_RECORDATORIO = ["Cobro pendiente","Llamar al cliente","Confirmar asistencia","Preparar evento","Comprar insumos"];

function RecordatoriosView({ recordatorios, setRecordatorios, reservas, clientes, pagos, extrasReserva, onVerCliente, onVerEvento, onNewPago, negocio }) {
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

// ─── CALENDAR WIDGET ──────────────────────────────────────
// ─── CALENDAR WIDGET ──────────────────────────────────────

function CalendarWidget({ reservas, clientes, bloqueos, calDate, setCalDate, onDayClick, recursos, turnosRecurso }) {
  const year = calDate.year;
  const month = calDate.month;

  const [cells, setCells] = useState([]);
  const multiEspacio = recursos && recursos.length > 1;
  const [espacioFiltro, setEspacioFiltro] = useState("all");

  // Para el espacio filtrado, ¿cuántos turnos tiene configurados?
  const turnosDelFiltro = (()=>{
    const tr = turnosRecurso||[];
    if(espacioFiltro==="all"){
      const idsConTurnos=[...new Set(tr.map(t=>t.recursoId))];
      if(idsConTurnos.length===1) return tr.filter(t=>t.recursoId===idsConTurnos[0]);
      return [];
    }
    return tr.filter(t=>t.recursoId===espacioFiltro);
  })();
  const modoSlot = turnosDelFiltro.length > 4;

  useEffect(() => {
    // Reset absoluto antes de recalcular
    const newCells = [];
    const firstDayOfWeek = (new Date(year + "-" + String(month + 1).padStart(2, "0") + "-01T12:00:00").getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDayOfWeek; i++) newCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) newCells.push(d);
    setCells(newCells);
  }, [year, month]);

  const todayStr = toDateStr(new Date());
  const getDay = (day) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return reservas.filter(r=>r.fecha===ds&&r.estado!=="cancelada"&&(espacioFiltro==="all"||r.recursoId===espacioFiltro));
  };
  const getBloqueo = (day) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return bloqueos.find(b=>b.fecha===ds);
  };

  return (
    <div style={{...card,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:"linear-gradient(135deg,#C4602B,#9E4A1E)",borderRadius:"12px 12px 0 0"}}>
        <button onClick={()=>setCalDate(d=>({year:d.month===0?d.year-1:d.year, month:d.month===0?11:d.month-1}))} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#FFF",cursor:"pointer",padding:"4px 12px",borderRadius:8,fontSize:20}}>‹</button>
        <span style={{fontWeight:800,fontSize:16,fontFamily:"'Playfair Display', serif",color:"#FFF"}}>{MONTHS[month]} {year}</span>
        <button onClick={()=>setCalDate(d=>({year:d.month===11?d.year+1:d.year, month:d.month===11?0:d.month+1}))} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#FFF",cursor:"pointer",padding:"4px 12px",borderRadius:8,fontSize:20}}>›</button>
      </div>
      {multiEspacio && (
        <div style={{padding:"8px 12px",background:"#FDF5EE",borderBottom:"1px solid #EDE0D0",display:"flex",gap:6,overflowX:"auto"}}>
          <button onClick={()=>setEspacioFiltro("all")} style={{flexShrink:0,padding:"4px 12px",borderRadius:16,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"1.5px solid "+(espacioFiltro==="all"?"#C4602B":"#EDE0D0"),background:espacioFiltro==="all"?"#C4602B":"#FFF",color:espacioFiltro==="all"?"#FFF":"#8B7355"}}>Todos</button>
          {recursos.map(r=>(
            <button key={r.id} onClick={()=>setEspacioFiltro(r.id)} style={{flexShrink:0,padding:"4px 12px",borderRadius:16,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"1.5px solid "+(espacioFiltro===r.id?"#C4602B":"#EDE0D0"),background:espacioFiltro===r.id?"#C4602B":"#FFF",color:espacioFiltro===r.id?"#FFF":"#8B7355"}}>🏠 {r.nombre}</button>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#FDF8F3",borderBottom:"1px solid #EDE0D0"}}>
        {DAYS_SHORT.map(d=><div key={`header-${d}-${year}-${month}`} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#8B7355",padding:"6px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"1px",background:"#EDE0D0"}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`empty-${year}-${month}-${i}`} style={{background:"#FAFAF8",minHeight:54}} />;
          const ds2=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const dr=getDay(day), isToday=ds2===todayStr, isPast=ds2<todayStr;
          const bloqueo=getBloqueo(day);
          return (
            <div key={`day-${year}-${month}-${day}`} onClick={()=>onDayClick(ds2,dr,espacioFiltro)}
              style={{background:bloqueo?"#1F2937":isToday&&dr.length===0?"#FEF0E8":"#FFF",minHeight:54,display:"flex",flexDirection:"column",cursor:"pointer",padding:"2px",opacity:isPast?0.4:1,pointerEvents:isPast?"none":"auto"}}>
              <div style={{textAlign:"center",padding:"2px 1px",flexShrink:0}}>
                {isToday ? (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                    <div style={{width:22,height:22,borderRadius:11,background:"#C4602B",color:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800}}>{day}</div>
                    <div style={{fontSize:6,fontWeight:800,color:"#C4602B",letterSpacing:0.5}}>HOY</div>
                  </div>
                ) : (
                  <span style={{fontSize:10,fontWeight:500,color:bloqueo?"#9CA3AF":isPast?"#9CA3AF":"#1C1C1E"}}>{day}</span>
                )}
              </div>
              {bloqueo&&<div style={{padding:"1px 3px",fontSize:7,color:"#6B7280",textAlign:"center"}}>🚫</div>}
              {modoSlot ? (
                /* Modo cancha/slot: barra de ocupación */
                dr.length>0 && (()=>{
                  const total=turnosDelFiltro.length;
                  const ocup=dr.length;
                  const pct=total>0?Math.round((ocup/total)*100):0;
                  const barColor=pct===100?"#DC2626":pct>=60?"#D97706":"#16A34A";
                  return (
                    <div style={{padding:"2px 3px",flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:2}}>
                      <div style={{background:"#E5E7EB",borderRadius:3,height:4,overflow:"hidden"}}>
                        <div style={{width:pct+"%",height:"100%",background:barColor,borderRadius:3,transition:"width 0.3s"}} />
                      </div>
                      <div style={{fontSize:7,fontWeight:800,color:barColor,textAlign:"center",lineHeight:1}}>{ocup}/{total}</div>
                    </div>
                  );
                })()
              ) : (
                /* Modo turnos nombrados: chips con ícono + iniciales */
                dr.map((r,ri)=>{
                  const t=TURNOS[r.turno];
                  const cl=clientes&&clientes.find(x=>x.id===r.clienteId);
                  const ini=cl?(cl.nombre?cl.nombre[0].toUpperCase():"")+(cl.apellido?cl.apellido[0].toUpperCase():""):"?";
                  const turnoCustom=turnosDelFiltro.find(x=>x.id===r.turnoId);
                  var cellBg;
                  if(isPast){ cellBg="#9CA3AF"; }
                  else if(r.estado==="pendiente"){ cellBg="#6B7280"; }
                  else if(r.estado==="senada"||r.estado==="confirmada"){
                    cellBg=turnoCustom?"#C4602B":(t?.color||"#C4602B");
                  } else if(r.estado==="finalizada"){ cellBg="#9CA3AF"; }
                  else { cellBg="#6B7280"; }
                  const icono = turnoCustom?(turnoCustom.icono||"📌"):(t?t.icon:"📌");
                  const label = turnoCustom?(turnoCustom.nombre.length>7?turnoCustom.horaInicio:turnoCustom.nombre):ini;
                  return (
                    <div key={`${year}-${month}-${day}-${ri}`} style={{flex:1,background:cellBg,display:"flex",alignItems:"center",gap:2,padding:"1px 3px",borderRadius:3,marginBottom:1}}>
                      <div style={{fontSize:10,lineHeight:1}}>{icono}</div>
                      <div style={{fontSize:8,fontWeight:800,color:"#FFF",lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
      <div style={{padding:"8px 14px",borderTop:"1px solid #EDE0D0",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        {modoSlot ? (
          <>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#8B7355"}}><div style={{width:12,height:4,borderRadius:2,background:"#16A34A"}} />Baja ocupación</div>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#8B7355"}}><div style={{width:12,height:4,borderRadius:2,background:"#D97706"}} />Media</div>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#8B7355"}}><div style={{width:12,height:4,borderRadius:2,background:"#DC2626"}} />Lleno</div>
          </>
        ) : (
          Object.entries(TURNOS).map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#8B7355"}}>
              <div style={{width:12,height:4,borderRadius:2,background:v.color}} />{v.label}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReportesView({ pagos, gastos, reservas, extrasReserva, serviciosExtras, clientes, negocio, turnosRecurso }) {
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

    // Turno summary
    const porTurno = {};
    reservasMes.forEach(r=>{ const k=getTurnoNombre(r); porTurno[k]=(porTurno[k]||0)+1; });
    const turnoRows = Object.entries(porTurno).map(([t,n])=>"<tr><td>"+escHtml(t)+"</td><td style=\"text-align:center\">"+n+"</td></tr>").join("") || "<tr><td colspan=\"2\" style=\"color:#8B7355\">Sin datos</td></tr>";

    // Extras del mes
    const extrasMap = {};
    reservasMes.forEach(r=>{ extrasReserva.filter(e=>e.reservaId===r.id).forEach(e=>{ extrasMap[e.descripcion]=(extrasMap[e.descripcion]||0)+(e.cantidad||1); }); });
    const extrasRows = Object.entries(extrasMap).map(([d,n])=>"<tr><td>"+d+"</td><td style=\"text-align:center\">"+n+"</td></tr>").join("") || "<tr><td colspan=\"2\" style=\"color:#8B7355\">Sin extras</td></tr>";

    // Gastos por categoria
    const gastosCat = {};
    gastosMes.forEach(g=>{ gastosCat[g.categoria||"Otros"]=(gastosCat[g.categoria||"Otros"]||0)+g.monto; });
    const gastosCatRows = Object.entries(gastosCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,monto])=>"<tr><td>"+cat+"</td><td style=\"text-align:right\">"+fmt(monto)+"</td></tr>").join("");

    // Filas de reservas
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
      +`<div class="hdr"><div class="hdr-left">${logoTag}<div><div class="logo">${negocio?.nombreNegocio||"Mi Negocio"}</div><div class="sub">${negocio?.ciudad||""}</div></div></div><div class="ttl">Reporte Mensual — ${mes} ${anio}</div></div>`
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

    const w=window.open("","_blank");
    if(!w){ alert("Tu navegador bloqueó la ventana emergente. Habilitá los pop-ups para este sitio y volvé a intentarlo."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(),600);
  };

  const now = new Date();
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const selKey = `${selYear}-${String(selMonth+1).padStart(2,"0")}`;
  const todayKey = toDateStr(now).slice(0,7);
  const isFutureMonth = selKey > todayKey;
  const monthRes = reservas.filter(r=>r.fecha&&r.fecha.startsWith(selKey)&&r.estado!=="cancelada");

  // ── Financials ────────────────────────────────────────
  const ingresos = pagos.filter(p=>p.fecha?.startsWith(selKey)).reduce((s,p)=>s+p.monto,0);
  const gastosTotal = gastos.filter(g=>g.fecha?.startsWith(selKey)).reduce((s,g)=>s+g.monto,0);
  const ganancia = ingresos - gastosTotal;

  // Efectivo vs Transferencia
  const ingEfectivo = pagos.filter(p=>p.fecha?.startsWith(selKey)&&p.metodo==="Efectivo").reduce((s,p)=>s+p.monto,0);
  const ingTransf   = pagos.filter(p=>p.fecha?.startsWith(selKey)&&p.metodo==="Transferencia").reduce((s,p)=>s+p.monto,0);
  const gstEfectivo = gastos.filter(g=>g.fecha?.startsWith(selKey)&&g.metodo==="Efectivo").reduce((s,g)=>s+g.monto,0);
  const gstTransf   = gastos.filter(g=>g.fecha?.startsWith(selKey)&&g.metodo==="Transferencia").reduce((s,g)=>s+g.monto,0);
  const cajaFisica  = ingEfectivo - gstEfectivo;
  const cuentas     = ingTransf - gstTransf;

  // Proyección mes futuro
  const proyeccion = isFutureMonth
    ? reservas.filter(r=>r.fecha?.startsWith(selKey)&&r.estado!=="cancelada").reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0)
    : null;

  // Por cobrar (mes actual/pasado)
  const porCobrar = !isFutureMonth
    ? reservas.filter(r=>r.fecha?.startsWith(selKey)&&["pendiente","senada"].includes(r.estado)).reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0)
    : 0;

  // Top 3 categorías de gastos
  const topCats = EXPENSE_CATS.map(cat=>({
    name:cat,
    value:gastos.filter(g=>g.fecha?.startsWith(selKey)&&g.categoria===cat).reduce((s,g)=>s+g.monto,0)
  })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value).slice(0,3);

  // Lead time (días promedio entre creación y evento)
  const withDates = monthRes.filter(r=>r.fechaCreacion&&r.fecha);
  const avgLead = withDates.length>0
    ? Math.round(withDates.reduce((s,r)=>s+Math.round((new Date(r.fecha)-new Date(r.fechaCreacion))/(86400000)),0)/withDates.length)
    : null;

  // Últimos 6 meses para gráfico
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

      {/* PDF Button */}
      <button onClick={generarPDF} style={{width:"100%",padding:"13px",background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>📄 Generar PDF / Imprimir reporte</button>

      {/* Selector mes/año */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <button onClick={()=>{if(selMonth===0){setSelMonth(11);setSelYear(y=>y-1);}else setSelMonth(m=>m-1);}}
          style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>‹</button>
        <div style={{...card,flex:1,padding:"9px 14px",textAlign:"center",fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{MONTHS[selMonth]} {selYear}</div>
        <button onClick={()=>{if(selMonth===11){setSelMonth(0);setSelYear(y=>y+1);}else setSelMonth(m=>m+1);}}
          style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>›</button>
      </div>

      {/* KPI cards */}
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

      {/* Ganancia + Caja física/banco */}
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

      {/* Proyección futura O por cobrar */}
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

      {/* Lead time + Turno ocupación */}
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

      {/* Top 3 categorías de gastos */}
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

      {/* Extras contratados */}
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

      {/* Gráfico últimos 6 meses */}
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

function NextEventoCard({ nextEvento, clientes, extrasReserva, pagos, onReservaClick }) {
  const c = clientes.find(x=>x.id===nextEvento.clienteId);
  const extrasForNext = extrasReserva.filter(e=>e.reservaId===nextEvento.id);
  const saldo = getSaldo(nextEvento, extrasReserva, pagos);
  const t = TURNOS[nextEvento.turno];
  const s = STATUS[nextEvento.estado] || STATUS.pendiente;
  const now2 = new Date();
  const today2 = toDateStr(now2);
  const curMin = now2.getHours()*60+now2.getMinutes();
  const startMin = nextEvento.horario ? parseInt(nextEvento.horario)*60+parseInt((nextEvento.horario.split(':')[1])||0) : 660;
  const endMin = nextEvento.horarioFin ? parseInt(nextEvento.horarioFin)*60+parseInt((nextEvento.horarioFin.split(':')[1])||0) : 1439;
  const enCurso = nextEvento.fecha===today2 && curMin>=startMin && curMin<=endMin;
  return (
    <div onClick={()=>onReservaClick(nextEvento)} style={{
      background:enCurso?"linear-gradient(135deg,#16A34A,#15803D)":"linear-gradient(135deg,#C4602B,#9E4A1E)",
      borderRadius:14,padding:"16px 18px",marginBottom:14,cursor:"pointer",
      boxShadow:enCurso?"0 4px 16px rgba(22,163,74,0.35)":"0 4px 16px rgba(196,96,43,0.35)",
    }}>
      {enCurso && <div style={{fontSize:11,fontWeight:800,color:"#FFF",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>🟢 EVENTO EN CURSO</div>}
      {enCurso&&(nextEvento.estado==="pendiente"||nextEvento.estado==="senada")&&saldo>0&&(
        <div style={{background:"#DC2626",borderRadius:8,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>🚨</span>
          <div>
            <div style={{fontSize:12,fontWeight:800,color:"#FFF"}}>SALDO PENDIENTE: {fmtCurrency(saldo)}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.85)"}}>El cliente aún no abonó el total del evento</div>
          </div>
        </div>
      )}
      {!enCurso && <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>🗓 Próximo evento</div>}
      <div style={{fontWeight:800,fontSize:20,color:"#FFF",fontFamily:"'Playfair Display',serif",marginBottom:4}}>{clientName(c)}</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginBottom:8}}>
        {fmtDate(nextEvento.fecha)}
        {nextEvento.horario ? " · " + nextEvento.horario + (nextEvento.horarioFin ? " → " + nextEvento.horarioFin : "") + "hs" : ""}
        {nextEvento.cantInvitados > 0 ? " · 👥 " + nextEvento.cantInvitados + " pers." : ""}
      </div>
      {extrasForNext&&extrasForNext.length>0&&(
        <div style={{background:"rgba(255,255,255,0.15)",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>✨ Extras</div>
          {extrasForNext.map((e,i)=><div key={i} style={{fontSize:12,color:"rgba(255,255,255,0.9)"}}>· {e.descripcion} x{e.cantidad}</div>)}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{background:"rgba(255,255,255,0.2)",color:"#FFF",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
          {t ? t.icon + " " + t.label : ""}
        </span>
        <div style={{textAlign:"right"}}>
          <span style={{background:s.bg,color:s.color,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,border:"1px solid "+s.border}}>{s.label}</span>
          {saldo > 0 && <div style={{fontSize:11,color:"#FFD97D",fontWeight:700,marginTop:3}}>⚠️ {fmtCurrency(saldo)}</div>}
        </div>
      </div>
    </div>
  );
}

function InicioView({ reservas, clientes, pagos, extrasReserva, serviciosExtras, bloqueos, tareas, saveTareas, saveReservas, calDate, setCalDate, onDayClick, onReservaClick, onNavigate, setModal, currentUser, negocio, recursos, turnosRecurso }) {
  const today=toDateStr(new Date()), now=new Date();
  const monthStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthRes=reservas.filter(r=>r.fecha&&r.fecha.startsWith(monthStr)&&r.estado!=="cancelada");
  const monthRevenue=pagos.filter(p=>p.fecha&&p.fecha.startsWith(monthStr)).reduce((s,p)=>s+p.monto,0);
  const confirmadas=reservas.filter(r=>r.estado==="confirmada"||r.estado==="senada").length;
  const totalPorCobrar=reservas.filter(r=>r.estado!=="cancelada"&&r.estado!=="finalizada")
    .reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0);
  const curTimeDash=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const upcoming=reservas.filter(r=>{
    if(r.estado==="cancelada"||r.estado==="finalizada") return false;
    if(r.fecha<today) return false;
    if(r.fecha===today&&r.horarioFin&&curTimeDash>r.horarioFin) return false;
    return true;
  }).sort((a,b)=>(a.fecha+(a.horario||"00:00")).localeCompare(b.fecha+(b.horario||"00:00")));
  const tomorrowDate=new Date(now); tomorrowDate.setDate(tomorrowDate.getDate()+1);
  const tmStr=toDateStr(tomorrowDate);
  const tmReservas=reservas.filter(r=>r.fecha===tmStr&&(r.estado==="senada"||r.estado==="confirmada")&&!r.recordatorioEnviado);

  const applyTemplate=(template,r)=>{
    const c=clientes.find(x=>x.id===r.clienteId);
    const extList=extrasReserva.filter(e=>e.reservaId===r.id);
    const extrasLines=extList.length>0?"\u2728 Extras contratados:\n"+extList.map(e=>"- "+e.descripcion+(e.cantidad>1?" (x"+e.cantidad+")":"")).join("\n"):null;
    const tp=getTotalPagado(r.id,pagos);
    const montoTotal=r.montoPactado+getTotalExtras(r.id,extrasReserva);
    const saldo=Math.max(0,montoTotal-tp);
    return template
      .replace(/\{nombre\}/g, clientName(c))
      .replace(/\{nombre_negocio\}/g, negocio?.nombreNegocio||"nuestro espacio")
      .replace(/\{fecha\}/g, fmtDate(r.fecha))
      .replace(/\{horario_inicio\}/g, r.horario||"--")
      .replace(/\{horario_fin\}/g, r.horarioFin||"--")
      .replace(/\{extras\}/g, extrasLines||"")
      .replace(/\{monto_total\}/g, fmtCurrency(montoTotal))
      .replace(/\{pagado\}/g, fmtCurrency(tp))
      .replace(/\{saldo\}/g, fmtCurrency(saldo));
  };

  const buildReminderMsg=(r)=>applyTemplate(negocio?.msgRecordatorio||"Hola {nombre}! Te recordamos tu evento ma\u00f1ana {fecha} de {horario_inicio} a {horario_fin} en {nombre_negocio}. Saldo: {saldo}",r);
  const buildPostMsg=(r)=>applyTemplate(negocio?.msgPostEvento||"Hola {nombre}! Gracias por tu evento en {nombre_negocio}. \u00a1Te esperamos nuevamente!",r);
  const nextEvento=upcoming[0]||null;
  const [newTarea,setNewTarea]=useState("");

  const addTarea=()=>{
    if(!newTarea.trim())return;
    const t=[...tareas,{id:genId(),fechaRegistro:today,descripcion:newTarea.trim(),estado:"pendiente"}];
    saveTareas(t.map((x,idx)=>idx===t.length-1?{...x,creadoPor:currentUser?.nombre||""}:x));setNewTarea("");
  };
  const toggleTarea=(id)=>{
    saveTareas(tareas.map(t=>t.id===id?{...t,estado:t.estado==="pendiente"?"completada":"pendiente"}:t));
  };
  const deleteTarea=(id)=>saveTareas(tareas.filter(t=>t.id!==id));

  return (
    <div style={{padding:"16px 16px 100px"}}>

      {/* ── Próximo Evento ── */}
      {nextEvento ? NextEventoCard({nextEvento, clientes, extrasReserva, pagos, onReservaClick}) : (
        <div style={{background:"#F9F6F2",borderRadius:14,padding:"20px 18px",marginBottom:14,border:"1.5px dashed #D4C5B5",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>🗓</div>
          <div style={{fontWeight:700,fontSize:15,color:"#8B7355",marginBottom:4}}>No hay eventos próximos programados</div>
          <div style={{fontSize:13,color:"#B5A090"}}>¡Cargá uno nuevo desde la pestaña Reservas!</div>
        </div>
      )}

      {/* ── Quick buttons ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:14}}>
        {[
          {icon:"👥",label:"Cliente",action:()=>setModal("cliente"),perm:currentUser?.gestionOperativa!==false},
          {icon:"📅",label:"Reserva",action:()=>setModal("reserva"),perm:currentUser?.gestionOperativa!==false},
          {icon:"💸",label:"Gastos",action:()=>onNavigate("gastos"),perm:currentUser?.gestionOperativa!==false},
          {icon:"📈",label:"Reportes",action:()=>onNavigate("reportes"),perm:currentUser?.verFinanzas!==false},
          {icon:"🔔",label:"Alertas",action:()=>getPlanLimits(currentUser?.plan).recordatorios!==false?onNavigate("recordatorios"):alert("Los recordatorios no están disponibles en tu plan. Actualizá a Profesional o superior."),perm:true},
        ].map((b,i)=>(
          <button key={i} onClick={b.perm?b.action:()=>alert("Sin permiso.")} style={{
            display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 4px",
            background:b.perm?"#FFF":"#F3F4F6",border:"1px solid #EDE0D0",borderRadius:10,
            cursor:b.perm?"pointer":"not-allowed",fontFamily:"inherit",opacity:b.perm?1:0.45,
          }}>
            <span style={{fontSize:18}}>{b.icon}</span>
            <span style={{fontSize:9,fontWeight:700,color:b.perm?"#5C4033":"#9CA3AF",textAlign:"center",lineHeight:1.1}}>{b.label}</span>
          </button>
        ))}
      </div>
      {/* ── Stats ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div style={{...card,padding:"14px 16px"}}><div style={{fontSize:22}}>📅</div><div style={{fontSize:28,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display', serif",lineHeight:1.1,marginTop:4}}>{monthRes.length}</div><div style={{fontSize:11,color:"#8B7355",marginTop:3}}>Reservas este mes</div></div>
        <div style={{...card,padding:"14px 16px"}}><div style={{fontSize:22}}>{totalPorCobrar>0?"⚠️":"✅"}</div><div style={{fontSize:22,fontWeight:800,color:totalPorCobrar>0?"#DC2626":"#16A34A",fontFamily:"'Playfair Display', serif",lineHeight:1.1,marginTop:4}}>{fmtCurrency(totalPorCobrar)}</div><div style={{fontSize:11,color:"#8B7355",marginTop:3}}>Por cobrar</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div style={{...card,padding:"14px 16px"}}><div style={{fontSize:22}}>📋</div><div style={{fontSize:28,fontWeight:800,color:"#2563EB",fontFamily:"'Playfair Display', serif",lineHeight:1.1,marginTop:4}}>{confirmadas}</div><div style={{fontSize:11,color:"#8B7355",marginTop:3}}>Eventos activos</div></div>
        <div style={{...card,padding:"14px 16px"}}><div style={{fontSize:22}}>💰</div><div style={{fontSize:20,fontWeight:800,color:"#16A34A",fontFamily:"'Playfair Display', serif",lineHeight:1.1,marginTop:4}}>{fmtCurrency(monthRevenue)}</div><div style={{fontSize:11,color:"#8B7355",marginTop:3}}>Cobrado este mes</div></div>
      </div>

      {/* ── Calendario ── */}
      <div style={{marginBottom:16}}>
        <CalendarWidget reservas={reservas} clientes={clientes} bloqueos={bloqueos} calDate={calDate} setCalDate={setCalDate} onDayClick={onDayClick} recursos={recursos} turnosRecurso={turnosRecurso} />
      </div>

      {/* ── Próximas reservas ── */}
      {/* Post-event fidelization */}
      {negocio?.postEventoActivo!==false&&now.getHours()>=8&&now.getHours()<21&&reservas.filter(r=>{
        const yest=new Date(now); yest.setDate(yest.getDate()-1);
        return r.fecha===toDateStr(yest)&&r.estado==="finalizada"&&!r.postEventoProcesado;
      }).map(r=>{
        const c=clientes.find(x=>x.id===r.clienteId);
        if(!c||!c.whatsapp) return null;
        const msg=buildPostMsg(r);
        return (
          <div key={r.id} style={{...card,padding:"14px 16px",marginBottom:12,border:"2px solid #F59E0B",background:"#FFFBEB"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#D97706",marginBottom:4}}>💌 Mensaje post-evento</div>
            <div style={{fontSize:13,color:"#1C1C1E",marginBottom:10}}>{clientName(c)} · {fmtDate(r.fecha)}</div>
            <div style={{display:"flex",gap:8}}>
              <a href={"https://wa.me/"+c.whatsapp.replace(/\D/g,"")+"?text="+encodeURIComponent(msg)} target="_blank" rel="noreferrer"
                onClick={()=>saveReservas(reservas.map(x=>x.id===r.id?{...x,postEventoProcesado:true}:x))}
                style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"#25D366",color:"#FFF",textDecoration:"none",padding:"9px 12px",borderRadius:8,fontWeight:700,fontSize:13}}>
                💬 Enviar mensaje
              </a>
              <button onClick={()=>saveReservas(reservas.map(x=>x.id===r.id?{...x,postEventoProcesado:true}:x))}
                style={{padding:"9px 14px",background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#8B7355",fontWeight:600}}>
                No enviar
              </button>
            </div>
          </div>
        );
      })}
      {negocio?.recordatorioActivo!==false&&now.getHours()>=8&&now.getHours()<21&&tmReservas.length>0&&(
        <div id="reminders-section" style={{...card,padding:"14px 16px",marginBottom:16,border:"2px solid #25D366"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>📲 Recordatorios de mañana</div>
              <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{tmReservas.length} evento{tmReservas.length!==1?"s":""} · {fmtDate(tmStr)}</div>
            </div>
          </div>
          {tmReservas.map(r=>{
            const c=clientes.find(x=>x.id===r.clienteId);
            const saldo=Math.max(0,getSaldo(r,extrasReserva,pagos));
            return (
              <div key={r.id} style={{background:"#F0FDF4",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{clientName(c)}</div>
                    <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{TURNOS[r.turno]?.icon} {TURNOS[r.turno]?.label} · {r.horario||"--"} → {r.horarioFin||"--"}</div>
                    {saldo>0&&<div style={{fontSize:12,color:"#DC2626",fontWeight:700,marginTop:2}}>⚠️ Saldo: {fmtCurrency(saldo)}</div>}
                  </div>
                  <StatusBadge estado={r.estado} />
                </div>
                {c&&c.whatsapp&&(
                  <a href={"https://wa.me/"+c.whatsapp.replace(/\D/g,"")+"?text="+encodeURIComponent(buildReminderMsg(r))}
                    target="_blank" rel="noreferrer"
                    onClick={()=>saveReservas(reservas.map(x=>x.id===r.id?{...x,recordatorioEnviado:true}:x))}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#FFF",textDecoration:"none",padding:"10px 14px",borderRadius:8,fontWeight:700,fontSize:13}}>
                    💬 Enviar recordatorio
                  </a>
                )}
                {!(c&&c.whatsapp)&&<div style={{fontSize:12,color:"#DC2626"}}>⚠️ Sin número de WhatsApp</div>}
              </div>
            );
          })}
        </div>
      )}
      {upcoming.slice(1,5).length>0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#5C4033",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Próximas reservas</div>
          {upcoming.slice(1,5).map(r=>{
            const c=clientes.find(x=>x.id===r.clienteId);
            const saldo=getSaldo(r,extrasReserva,pagos);
            return (
              <div key={r.id} onClick={()=>onReservaClick(r)} style={{...card,padding:"12px 14px",marginBottom:8,cursor:"pointer",borderLeft:`3px solid ${TURNOS[r.turno]?.color||"#C4602B"}`,borderRadius:"0 12px 12px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{clientName(c)}</div><div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{fmtDate(r.fecha)} · {TURNOS[r.turno]?.icon} {TURNOS[r.turno]?.label}{r.cantInvitados>0?` · 👥 ${r.cantInvitados}`:""}</div></div>
                  <div style={{textAlign:"right"}}><StatusBadge estado={r.estado} />{saldo>0&&<div style={{fontSize:11,color:"#DC2626",fontWeight:700,marginTop:4}}>⚠️ {fmtCurrency(saldo)}</div>}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tareas del Quincho ── */}
      <div style={{...card,padding:"14px 16px"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E",marginBottom:12}}>🔧 Tareas del quincho</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input value={newTarea} onChange={e=>setNewTarea(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addTarea()}
            placeholder="Ej: Arreglar picaporte, comprar lamparas..."
            style={{flex:1,padding:"8px 12px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          <button onClick={addTarea} style={{background:"#C4602B",color:"#FFF",border:"none",borderRadius:8,padding:"8px 14px",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"inherit",whiteSpace:"nowrap"}}>+ Agregar</button>
        </div>
        {tareas.length===0&&<div style={{textAlign:"center",color:"#8B7355",fontSize:13,padding:"12px 0"}}>Sin tareas pendientes ✅</div>}
        {tareas.filter(t=>t.estado==="pendiente").map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #EDE0D0"}}>
            <input type="checkbox" checked={false} onChange={()=>toggleTarea(t.id)} style={{width:16,height:16,cursor:"pointer",accentColor:"#C4602B"}} />
            <span style={{flex:1,fontSize:13,color:"#1C1C1E"}}>{t.descripcion}</span>
            <span style={{fontSize:11,color:"#8B7355"}}>{fmtDate(t.fechaRegistro)}</span>
            <button onClick={()=>deleteTarea(t.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
          </div>
        ))}
        {tareas.filter(t=>t.estado==="completada").length>0&&(
          <div style={{marginTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Completadas</div>
            {tareas.filter(t=>t.estado==="completada").map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #F5EDE4",opacity:0.6}}>
                <input type="checkbox" checked={true} onChange={()=>toggleTarea(t.id)} style={{width:16,height:16,cursor:"pointer",accentColor:"#16A34A"}} />
                <span style={{flex:1,fontSize:12,color:"#8B7355",textDecoration:"line-through"}}>{t.descripcion}</span>
                <button onClick={()=>deleteTarea(t.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}


function ReservasView({ reservas, clientes, pagos, recursos, extrasReserva, onReservaClick, onNewReserva }) {
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

function ClientesView({ clientes, reservas, onClienteClick, onNewCliente }) {
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

function GastosView({ gastos, onNewGasto }) {
  const nowG = new Date();
  const [filterCat,setFilterCat]=useState("all");
  const [filterYear,setFilterYear]=useState(nowG.getFullYear());
  const [filterMonthNum,setFilterMonthNum]=useState(nowG.getMonth());
  const filterKey=`${filterYear}-${String(filterMonthNum+1).padStart(2,"0")}`;
  const sorted=gastos
    .filter(g=>filterCat==="all"||g.categoria===filterCat)
    .filter(g=>g.fecha?.startsWith(filterKey))
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const total=sorted.reduce((s,g)=>s+g.monto,0);
  return (
    <div style={{padding:"16px 16px 100px"}}>
      <div style={{...card,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontSize:11,color:"#8B7355"}}>💸 Total gastos (filtrado)</div>
        <div style={{fontSize:28,fontWeight:800,color:"#DC2626",fontFamily:"'Playfair Display', serif"}}>{fmtCurrency(total)}</div>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:10}}>
        {[{value:"all",label:"Todos"},...EXPENSE_CATS.map(c=>({value:c,label:c}))].map(opt=>(
          <button key={opt.value} onClick={()=>setFilterCat(opt.value)} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,whiteSpace:"nowrap",
            background:filterCat===opt.value?"#DC2626":"#FDF8F3",color:filterCat===opt.value?"#FFF":"#8B7355",
            border:`1px solid ${filterCat===opt.value?"#DC2626":"#EDE0D0"}`,cursor:"pointer",fontFamily:"inherit",
          }}>{opt.label}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
        <button onClick={()=>{ if(filterMonthNum===0){setFilterMonthNum(11);setFilterYear(y=>y-1);}else setFilterMonthNum(m=>m-1); }} style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>‹</button>
        <div style={{...card,flex:1,padding:"9px 14px",textAlign:"center",fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{MONTHS[filterMonthNum]} {filterYear}</div>
        <button onClick={()=>{ if(filterMonthNum===11){setFilterMonthNum(0);setFilterYear(y=>y+1);}else setFilterMonthNum(m=>m+1); }} style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>›</button>
      </div>
      {sorted.length===0 ? (
        <div style={{textAlign:"center",padding:"48px 0",color:"#8B7355"}}>
          <div style={{fontSize:44,marginBottom:10}}>💸</div>
          <div style={{fontWeight:600}}>No hay gastos registrados</div>
        </div>
      ) : sorted.map(g=>(
        <div key={g.id} style={{...card,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:600,fontSize:14,color:"#1C1C1E"}}>{g.concepto}</div>
            <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{fmtDate(g.fecha)} · <span style={{fontWeight:600,color:CAT_COLORS[g.categoria]||"#8B7355"}}>{g.categoria}</span></div>
          </div>
          <div style={{fontWeight:700,fontSize:15,color:"#DC2626"}}>-{fmtCurrency(g.monto)}</div>
        </div>
      ))}
      <div style={{marginTop:20,textAlign:"center"}}><Btn onClick={onNewGasto}>+ Registrar Gasto</Btn></div>
    </div>
  );
}



function AddUsuarioForm({ usuarios, setUsuarios }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({nombre:"",email:"",rol:"Empleado"});
  const [saving, setSaving] = useState(false);
  const roles = ["Empleado","Administrador"];

  const handleSave = async () => {
    if(!form.email||!form.email.includes("@")) return alert("El Gmail es obligatorio.");
    if(!form.nombre) return alert("El nombre es obligatorio.");
    setSaving(true);
    try {
      // Save to perfiles_usuarios (used for Google OAuth access control)
      await sb.upsert("perfiles_usuarios", [{
        email: form.email.toLowerCase().trim(),
        nombre: form.nombre,
        rol: form.rol,
        activo: true,
        creado_en: new Date().toISOString()
      }]);
      setForm({nombre:"",email:"",rol:"Empleado"});
      setShow(false);
      alert("✅ Usuario autorizado. Podrá ingresar con su Gmail de Google.");
    } catch(e) {
      alert("Error al guardar: "+e.message);
    }
    setSaving(false);
  };

  if(!show) return (
    <button onClick={()=>setShow(true)} style={{marginTop:12,width:"100%",padding:"10px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:10,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Autorizar nuevo usuario</button>
  );

  return (
    <div style={{marginTop:12,padding:14,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0"}}>
      <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E",marginBottom:4}}>Autorizar acceso</div>
      <div style={{fontSize:11,color:"#8B7355",marginBottom:12}}>El usuario podrá entrar con su cuenta de Google.</div>
      <input placeholder="Nombre" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none"}} />
      <input placeholder="Gmail (obligatorio)" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none"}} />
      <select value={form.rol} onChange={e=>setForm(p=>({...p,rol:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:10,boxSizing:"border-box",outline:"none",background:"#FFF"}}>
        {roles.map(r=><option key={r} value={r}>{r}</option>)}
      </select>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShow(false)} style={{flex:1,padding:"9px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} style={{flex:2,padding:"9px",background:"#C4602B",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700,opacity:saving?0.6:1}}>{saving?"Guardando...":"Autorizar"}</button>
      </div>
    </div>
  );
}

function ColaboradoresSection({ orgId, plan, embedded }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const limits = getPlanLimits(plan);
  const maxColab = limits.colaboradores;

  useEffect(()=>{
    if(!orgId) return;
    supabaseCentral.from("empleados_organizacion").select("*").eq("org_id",orgId).eq("activo",true)
      .then(({data})=>{ setColaboradores(data||[]); setLoading(false); });
  },[orgId]);

  const handleAdd = async () => {
    if(!email.trim()) return;
    if(colaboradores.length >= maxColab){
      alert(`Tu plan ${plan||"actual"} permite hasta ${maxColab} colaborador${maxColab!==1?"es":""}. Actualizá tu plan para agregar más.`);
      return;
    }
    setSaving(true);
    const nuevo = { id: genId(), org_id: orgId, email: email.trim(), nombre: nombre.trim()||email.trim(), activo: true };
    const { error } = await supabaseCentral.from("empleados_organizacion").insert(nuevo);
    if(error){ alert("Error al agregar colaborador: "+error.message); setSaving(false); return; }
    setColaboradores(prev=>[...prev, nuevo]);
    setEmail(""); setNombre(""); setSaving(false);
  };

  const handleRemove = async (id) => {
    await supabaseCentral.from("empleados_organizacion").update({activo:false}).eq("id",id);
    setColaboradores(prev=>prev.filter(x=>x.id!==id));
  };

  if(maxColab === 0) return (
    <div style={{fontSize:13,color:"#8B7355"}}>🔒 Tu plan actual no incluye colaboradores. Actualizá a Profesional o Premium para agregar accesos adicionales.</div>
  );

  return (
    <div>
      <div style={{fontSize:12,color:"#8B7355",marginBottom:12}}>Tu plan permite hasta <b>{maxColab}</b> colaborador{maxColab!==1?"es":""}. Ingresarán con su Google.</div>
      {loading ? <div style={{fontSize:13,color:"#8B7355"}}>Cargando...</div> : (
        <>
          {colaboradores.length===0 && <div style={{fontSize:13,color:"#8B7355",marginBottom:12}}>No hay colaboradores aún.</div>}
          {colaboradores.map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F5EDE4"}}>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>{c.nombre||c.email}</div>
                <div style={{fontSize:11,color:"#8B7355"}}>{c.email}</div>
              </div>
              <button onClick={()=>handleRemove(c.id)}
                style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>🗑️</button>
            </div>
          ))}
          {colaboradores.length < maxColab && (
            <div style={{marginTop:12,padding:12,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0"}}>
              <input placeholder="Nombre" value={nombre} onChange={e=>setNombre(e.target.value)}
                style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none"}} />
              <input placeholder="Email de Google" value={email} onChange={e=>setEmail(e.target.value)} type="email"
                style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:10,boxSizing:"border-box",outline:"none"}} />
              <button onClick={handleAdd} disabled={saving}
                style={{width:"100%",padding:"9px",background:"#C4602B",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700,opacity:saving?0.7:1}}>
                {saving ? "Guardando..." : "+ Agregar colaborador"}
              </button>
            </div>
          )}
          {colaboradores.length >= maxColab && colaboradores.length > 0 && (
            <div style={{marginTop:10,fontSize:12,color:"#8B7355",textAlign:"center"}}>Límite de colaboradores alcanzado para tu plan.</div>
          )}
        </>
      )}
    </div>
  );
}

function EspacioCard({ espacio, onDelete, onTurnosChange }) {
  const [expanded, setExpanded] = useState(false);
  const [turnos, setTurnos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({nombre:"",horaInicio:"",horaFin:"",precioSemana:"",precioFinde:"",icono:"📌"});
  const ICONOS_TURNO = ["📌","☀️","🌤️","🌆","🌙","⚽","🎾","🏊","🎉","🎪","🍖","🎸","💅","🏋️","🎭","🏠"];
  const [saving, setSaving] = useState(false);
  // modo local del espacio (fijo = manual, slot = generador)
  const [modo, setModo] = useState(espacio.modo||"fijo");
  const [slotForm, setSlotForm] = useState({horaInicio: espacio.slotHoraInicio||"08:00", horaFin: espacio.slotHoraFin||"23:00", duracion: espacio.slotDuracionMin||60, precioSemana:"", precioFinde:""});
  const [generando, setGenerando] = useState(false);

  const inpS = {padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",outline:"none"};

  const loadTurnos = async () => {
    if(loaded) return;
    const {data} = await supabase.from("turnos_recurso").select("*").eq("recurso_id",espacio.id).eq("activo",true).order("hora_inicio");
    setTurnos(data||[]);
    setLoaded(true);
  };

  const handleExpand = () => {
    setExpanded(e=>!e);
    if(!loaded) loadTurnos();
  };

  const handleAddTurno = async () => {
    if(!form.nombre||!form.horaInicio||!form.horaFin) return alert("Completá nombre, hora inicio y hora fin.");
    setSaving(true);
    const nuevo = {recurso_id:espacio.id,org_id:currentOrgId,nombre:form.nombre.trim(),icono:form.icono||"📌",hora_inicio:form.horaInicio,hora_fin:form.horaFin,precio_semana:Number(form.precioSemana)||0,precio_finde:Number(form.precioFinde)||0,activo:true};
    const {data,error} = await supabase.from("turnos_recurso").insert(nuevo).select().single();
    if(error){alert("Error: "+error.message);setSaving(false);return;}
    const mapX=x=>({id:x.id,recursoId:x.recurso_id||x.recursoId,orgId:x.org_id||x.orgId,nombre:x.nombre||"",icono:x.icono||"📌",horaInicio:x.hora_inicio||x.horaInicio||"",horaFin:x.hora_fin||x.horaFin||"",precioSemana:Number(x.precio_semana||x.precioSemana)||0,precioFinde:Number(x.precio_finde||x.precioFinde)||0,activo:true});
    setTurnos(prev=>{const n=[...prev,data];if(onTurnosChange)onTurnosChange(espacio.id,n.map(mapX));return n;});
    setForm({nombre:"",horaInicio:"",horaFin:"",precioSemana:"",precioFinde:""});
    setShowForm(false);setSaving(false);
  };

  const handleRemoveTurno = async (id) => {
    await supabase.from("turnos_recurso").update({activo:false}).eq("id",id);
    setTurnos(prev=>{
      const n=prev.filter(t=>t.id!==id);
      if(onTurnosChange) onTurnosChange(espacio.id, n.map(x=>({id:x.id,recursoId:x.recurso_id||x.recursoId,orgId:x.org_id||x.orgId,nombre:x.nombre||"",icono:x.icono||"📌",horaInicio:x.hora_inicio||x.horaInicio||"",horaFin:x.hora_fin||x.horaFin||"",precioSemana:Number(x.precio_semana||x.precioSemana)||0,precioFinde:Number(x.precio_finde||x.precioFinde)||0,activo:true})));
      return n;
    });
  };

  const handleGenerarSlots = async () => {
    if(!slotForm.horaInicio||!slotForm.horaFin||!slotForm.duracion) return alert("Completá horario de apertura, cierre y duración.");
    const [hI,mI]=slotForm.horaInicio.split(":").map(Number);
    const [hF,mF]=slotForm.horaFin.split(":").map(Number);
    const inicioMin = hI*60+mI;
    const finMin = hF*60+mF;
    const dur = Number(slotForm.duracion);
    if(finMin<=inicioMin||dur<=0||dur>finMin-inicioMin) return alert("Horarios o duración inválidos.");
    const slots=[];
    for(let t=inicioMin;t+dur<=finMin;t+=dur){
      const hh=h=>String(Math.floor(h/60)).padStart(2,"0")+":"+String(h%60).padStart(2,"0");
      slots.push({recurso_id:espacio.id,org_id:currentOrgId,nombre:hh(t)+" – "+hh(t+dur),hora_inicio:hh(t),hora_fin:hh(t+dur),precio_semana:Number(slotForm.precioSemana)||0,precio_finde:Number(slotForm.precioFinde)||0,activo:true});
    }
    if(slots.length===0) return alert("No se generaron turnos. Revisá los horarios.");
    if(turnos.length>0 && !window.confirm(`Esto va a reemplazar los ${turnos.length} turnos actuales de este espacio. ¿Continuar?`)) return;
    setGenerando(true);
    // Desactivar turnos existentes
    await supabase.from("turnos_recurso").update({activo:false}).eq("recurso_id",espacio.id);
    // Guardar parámetros del slot en el espacio
    await supabase.from("recursos").update({modo:"slot",slot_hora_inicio:slotForm.horaInicio,slot_hora_fin:slotForm.horaFin,slot_duracion_min:dur}).eq("id",espacio.id);
    // Insertar nuevos slots
    const {data,error}=await supabase.from("turnos_recurso").insert(slots).select();
    if(error){alert("Error al generar turnos: "+error.message+"\n\nSi dice 'foreign key', corré el SQL de corrección en Supabase (consultá al soporte).");setGenerando(false);return;}
    const mapped=(data||[]).map(x=>({id:x.id,recursoId:x.recurso_id,orgId:x.org_id,nombre:x.nombre||"",horaInicio:x.hora_inicio||"",horaFin:x.hora_fin||"",precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:true}));
    setTurnos(data||[]);
    setLoaded(true);
    if(onTurnosChange) onTurnosChange(espacio.id, mapped);
    setGenerando(false);
    alert(`✅ Se generaron ${slots.length} turnos de ${dur} minutos.`);
  };

  const cambiarModo = async (nuevoModo) => {
    if(nuevoModo===modo) return;
    if(turnos.length>0 && !window.confirm(`Al cambiar de modo se desactivarán los ${turnos.length} turnos actuales. ¿Continuar?`)) return;
    setModo(nuevoModo);
    await supabase.from("recursos").update({modo:nuevoModo}).eq("id",espacio.id);
    await supabase.from("turnos_recurso").update({activo:false}).eq("recurso_id",espacio.id);
    setTurnos([]);
    if(onTurnosChange) onTurnosChange(espacio.id, []);
  };

  return (
    <div style={{borderRadius:10,border:"1.5px solid #EDE0D0",marginBottom:10,overflow:"hidden"}}>
      {/* Header del espacio */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"#FDF8F3"}}>
        <button onClick={handleExpand} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",flex:1,textAlign:"left",padding:0}}>
          <span style={{fontSize:18}}>🏠</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{espacio.nombre}</div>
            {espacio.capacidadMax>0&&<div style={{fontSize:11,color:"#8B7355"}}>Cap. {espacio.capacidadMax} personas</div>}
            {loaded&&<div style={{fontSize:11,color:"#C4602B"}}>{turnos.length} turno{turnos.length!==1?"s":""} configurado{turnos.length!==1?"s":""}</div>}
          </div>
          <span style={{marginLeft:"auto",fontSize:16,color:"#8B7355",transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>⌄</span>
        </button>
        <button onClick={onDelete} style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",marginLeft:8,flexShrink:0}}>🗑️</button>
      </div>

      {/* Turnos expandidos */}
      {expanded && (
        <div style={{padding:"12px 14px",background:"#FFF",borderTop:"1px solid #EDE0D0"}}>

          {/* Selector de tipo de turno */}
          <div style={{display:"flex",gap:0,marginBottom:14,borderRadius:8,overflow:"hidden",border:"1.5px solid #EDE0D0"}}>
            <button onClick={()=>cambiarModo("fijo")} style={{flex:1,padding:"8px 4px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",fontFamily:"inherit",background:modo==="fijo"?"#C4602B":"#FDF8F3",color:modo==="fijo"?"#FFF":"#8B7355"}}>
              🎪 Turnos nombrados
            </button>
            <button onClick={()=>cambiarModo("slot")} style={{flex:1,padding:"8px 4px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",fontFamily:"inherit",background:modo==="slot"?"#C4602B":"#FDF8F3",color:modo==="slot"?"#FFF":"#8B7355"}}>
              ⏰ Por franja horaria
            </button>
          </div>

          {!loaded ? (
            <div style={{fontSize:13,color:"#8B7355"}}>Cargando turnos...</div>
          ) : modo==="slot" ? (
            /* ── MODO SLOT: generador automático ── */
            <div>
              <div style={{fontSize:12,color:"#8B7355",marginBottom:10}}>Definí el horario y la duración de cada turno. La app genera todos los slots automáticamente.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Apertura</div><input type="time" value={slotForm.horaInicio} onChange={e=>setSlotForm(p=>({...p,horaInicio:e.target.value}))} style={inpS} /></div>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Cierre</div><input type="time" value={slotForm.horaFin} onChange={e=>setSlotForm(p=>({...p,horaFin:e.target.value}))} style={inpS} /></div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Duración de cada turno</div>
                <select value={slotForm.duracion} onChange={e=>setSlotForm(p=>({...p,duracion:e.target.value}))} style={inpS}>
                  <option value={30}>30 minutos</option>
                  <option value={60}>60 minutos (1 hora)</option>
                  <option value={90}>90 minutos</option>
                  <option value={120}>120 minutos (2 horas)</option>
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio lun–vie ($)</div><input type="number" value={slotForm.precioSemana} onChange={e=>setSlotForm(p=>({...p,precioSemana:e.target.value}))} style={inpS} placeholder="0" /></div>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio sáb–dom ($)</div><input type="number" value={slotForm.precioFinde} onChange={e=>setSlotForm(p=>({...p,precioFinde:e.target.value}))} style={inpS} placeholder="0" /></div>
              </div>
              <button onClick={handleGenerarSlots} disabled={generando}
                style={{width:"100%",padding:"10px",background:generando?"#EDE0D0":"#C4602B",border:"none",borderRadius:8,color:"#FFF",fontWeight:700,fontSize:13,cursor:generando?"not-allowed":"pointer",fontFamily:"inherit"}}>
                {generando?"Generando...":"⚡ Generar turnos automáticamente"}
              </button>
              {/* Vista previa de turnos generados */}
              {turnos.length>0&&(
                <div style={{marginTop:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:6}}>TURNOS ACTUALES ({turnos.length})</div>
                  <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {turnos.map(t=>(
                      <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:"#F9F6F2",borderRadius:6,fontSize:12}}>
                        <span style={{fontWeight:600,color:"#1C1C1E"}}>{t.hora_inicio} – {t.hora_fin}</span>
                        <span style={{color:"#8B7355"}}>Sem: {fmtCurrency(t.precio_semana)} · Finde: {fmtCurrency(t.precio_finde)}</span>
                        <button onClick={()=>handleRemoveTurno(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#DC2626",fontSize:14,padding:"0 4px"}}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── MODO FIJO: turnos nombrados manuales ── */
            <>
              {turnos.length===0 && <div style={{fontSize:13,color:"#8B7355",marginBottom:10}}>Sin turnos. Agregá al menos uno para poder tomar reservas en este espacio.</div>}
              {turnos.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F5EDE4"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>{t.icono||"📌"}</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>{t.nombre}</div>
                      <div style={{fontSize:11,color:"#8B7355"}}>{t.hora_inicio} – {t.hora_fin} · Sem: {fmtCurrency(t.precio_semana)} · Finde: {fmtCurrency(t.precio_finde)}</div>
                    </div>
                  </div>
                  <button onClick={()=>handleRemoveTurno(t.id)} style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",flexShrink:0}}>🗑️</button>
                </div>
              ))}
              {!showForm ? (
                <button onClick={()=>setShowForm(true)} style={{marginTop:10,width:"100%",padding:"9px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:8,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar turno</button>
              ) : (
                <div style={{marginTop:10,padding:12,background:"#FDF5EE",borderRadius:10,border:"1px solid #EDE0D0"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#8B7355",marginBottom:8}}>Nuevo turno — {espacio.nombre}</div>
                  <input placeholder="Nombre (ej: Tarde, Noche, Turno 20hs)" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} style={{...inpS,marginBottom:8}} />
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:"#8B7355",marginBottom:4}}>Ícono</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {ICONOS_TURNO.map(ic=>(
                        <button key={ic} onClick={()=>setForm(p=>({...p,icono:ic}))}
                          style={{width:34,height:34,fontSize:18,border:`2px solid ${form.icono===ic?"#C4602B":"#EDE0D0"}`,borderRadius:8,background:form.icono===ic?"#FEF3EC":"#FFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora inicio</div><input type="time" value={form.horaInicio} onChange={e=>setForm(p=>({...p,horaInicio:e.target.value}))} style={inpS} /></div>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora fin</div><input type="time" value={form.horaFin} onChange={e=>setForm(p=>({...p,horaFin:e.target.value}))} style={inpS} /></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio lun–vie ($)</div><input type="number" value={form.precioSemana} onChange={e=>setForm(p=>({...p,precioSemana:e.target.value}))} style={inpS} /></div>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio sáb–dom ($)</div><input type="number" value={form.precioFinde} onChange={e=>setForm(p=>({...p,precioFinde:e.target.value}))} style={inpS} /></div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"9px",background:"#FFF",border:"1px solid #EDE0D0",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#8B7355",fontWeight:600}}>Cancelar</button>
                    <button onClick={handleAddTurno} disabled={saving} style={{flex:2,padding:"9px",background:"#C4602B",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700,opacity:saving?0.7:1}}>{saving?"Guardando...":"Guardar turno"}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LogoUploadButton({ orgId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Solo se permiten imágenes.");
    if (file.size > 2 * 1024 * 1024) return alert("La imagen no puede superar 2MB.");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `logos/${orgId || "default"}.${ext}`;
    const { error } = await supabase.storage.from("negocio-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { alert("Error al subir imagen: " + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("negocio-assets").getPublicUrl(path);
    onUploaded(data.publicUrl + "?t=" + Date.now());
    setUploading(false);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile} />
      <button onClick={()=>inputRef.current?.click()} disabled={uploading}
        style={{padding:"8px 14px",background:uploading?"#F3F4F6":"#C4602B",border:"none",borderRadius:8,color:uploading?"#8B7355":"#FFF",fontSize:12,fontWeight:700,cursor:uploading?"not-allowed":"pointer",fontFamily:"inherit"}}>
        {uploading ? "Subiendo..." : "📷 Subir imagen"}
      </button>
    </>
  );
}

function TurnosEspacioSection({ recursos }) {
  const [espacioSel, setEspacioSel] = useState(recursos[0]?.id || "");
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nombre:"", horaInicio:"", horaFin:"", precioSemana:"", precioFinde:"" });
  const [showForm, setShowForm] = useState(false);

  useEffect(()=>{
    if(!espacioSel) return;
    setLoading(true);
    supabase.from("turnos_recurso").select("*").eq("recurso_id",espacioSel).eq("activo",true).order("hora_inicio")
      .then(({data})=>{ setTurnos(data||[]); setLoading(false); });
  },[espacioSel]);

  const handleAdd = async () => {
    if(!form.nombre||!form.horaInicio||!form.horaFin) return alert("Completá nombre, hora inicio y hora fin.");
    const nuevo = { recurso_id: espacioSel, org_id: currentOrgId, nombre: form.nombre.trim(), hora_inicio: form.horaInicio, hora_fin: form.horaFin, precio_semana: Number(form.precioSemana)||0, precio_finde: Number(form.precioFinde)||0, activo: true };
    const { data, error } = await supabase.from("turnos_recurso").insert(nuevo).select().single();
    if(error){ alert("Error: "+error.message); return; }
    setTurnos(prev=>[...prev, data]);
    setForm({ nombre:"", horaInicio:"", horaFin:"", precioSemana:"", precioFinde:"" });
    setShowForm(false);
  };

  const handleRemove = async (id) => {
    await supabase.from("turnos_recurso").update({activo:false}).eq("id",id);
    setTurnos(prev=>prev.filter(t=>t.id!==id));
  };

  const espacio = recursos.find(r=>r.id===espacioSel);
  const inpS = {padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",outline:"none"};

  return (
    <div style={{...card, marginTop:16}}>
      <div style={{fontWeight:800,fontSize:16,color:"#1C1C1E",marginBottom:4,fontFamily:"'Playfair Display',serif"}}>🕐 Turnos por Espacio</div>
      <div style={{fontSize:12,color:"#8B7355",marginBottom:12}}>Configurá los turnos y precios de cada espacio.</div>

      {/* Selector de espacio */}
      {recursos.length > 1 && (
        <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:2}}>
          {recursos.map(r=>(
            <button key={r.id} onClick={()=>setEspacioSel(r.id)} style={{flexShrink:0,padding:"6px 14px",borderRadius:16,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"1.5px solid "+(espacioSel===r.id?"#C4602B":"#EDE0D0"),background:espacioSel===r.id?"#C4602B":"#FFF",color:espacioSel===r.id?"#FFF":"#8B7355"}}>🏠 {r.nombre}</button>
          ))}
        </div>
      )}

      {espacio && <div style={{fontSize:12,fontWeight:700,color:"#C4602B",marginBottom:10}}>📍 {espacio.nombre}</div>}

      {loading ? <div style={{fontSize:13,color:"#8B7355"}}>Cargando...</div> : (
        <>
          {turnos.length===0 && <div style={{fontSize:13,color:"#8B7355",marginBottom:10}}>No hay turnos configurados para este espacio.</div>}
          {turnos.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F5EDE4"}}>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>{t.nombre}</div>
                <div style={{fontSize:11,color:"#8B7355"}}>{t.hora_inicio} – {t.hora_fin} · Sem: {fmtCurrency(t.precio_semana)} · Finde: {fmtCurrency(t.precio_finde)}</div>
              </div>
              <button onClick={()=>handleRemove(t.id)} style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>🗑️</button>
            </div>
          ))}
          {!showForm ? (
            <button onClick={()=>setShowForm(true)} style={{marginTop:12,width:"100%",padding:"9px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:8,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar turno</button>
          ) : (
            <div style={{marginTop:12,padding:12,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#8B7355",marginBottom:8}}>Nuevo turno para {espacio?.nombre}</div>
              <input placeholder="Nombre del turno (ej: Noche, Mañana)" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} style={{...inpS,marginBottom:8}} />
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora inicio</div><input type="time" value={form.horaInicio} onChange={e=>setForm(p=>({...p,horaInicio:e.target.value}))} style={inpS} /></div>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora fin</div><input type="time" value={form.horaFin} onChange={e=>setForm(p=>({...p,horaFin:e.target.value}))} style={inpS} /></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio semana ($)</div><input type="number" value={form.precioSemana} onChange={e=>setForm(p=>({...p,precioSemana:e.target.value}))} style={inpS} /></div>
                <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio fin de semana ($)</div><input type="number" value={form.precioFinde} onChange={e=>setForm(p=>({...p,precioFinde:e.target.value}))} style={inpS} /></div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"9px",background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#8B7355",fontWeight:600}}>Cancelar</button>
                <button onClick={handleAdd} style={{flex:2,padding:"9px",background:"#C4602B",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700}}>Guardar turno</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConfigView({ config, saveConfig, serviciosExtras, setServiciosExtras, recursos, setRecursos, usuarios, setUsuarios, currentUser, removeUsuario, perfilesUsuarios, setPerfilesUsuarios, negocio, setNegocio, turnosRecurso, setTurnosRecurso }) {
  const [negForm, setNegForm] = useState({ nombreNegocio: negocio?.nombreNegocio||"", ciudad: negocio?.ciudad||"", direccion: negocio?.direccion||"", telefono: negocio?.telefono||"", logoUrl: negocio?.logoUrl||"", msgRecordatorio: negocio?.msgRecordatorio||"", msgPostEvento: negocio?.msgPostEvento||"", recordatorioActivo: negocio?.recordatorioActivo!==false, postEventoActivo: negocio?.postEventoActivo!==false });
  const [negSaved, setNegSaved] = useState(false);
  const [showMsgs, setShowMsgs] = useState(false);
  const [open, setOpen] = useState("negocio");
  const planLimits = getPlanLimits(currentUser?.plan);

  const toggle = s => setOpen(o => o===s ? null : s);

  const handleSaveNegocio = async () => {
    const row = { org_id: currentOrgId, nombre_negocio: negForm.nombreNegocio, ciudad: negForm.ciudad, direccion: negForm.direccion, telefono: negForm.telefono, logo_url: negForm.logoUrl, msg_recordatorio: negForm.msgRecordatorio, msg_post_evento: negForm.msgPostEvento, recordatorio_activo: negForm.recordatorioActivo, post_evento_activo: negForm.postEventoActivo };
    const { error } = await supabase.from("config").upsert(row, { onConflict: "org_id" });
    if (error) { alert("Error al guardar: " + error.message); return; }
    setNegocio({ nombreNegocio: negForm.nombreNegocio, ciudad: negForm.ciudad, direccion: negForm.direccion, telefono: negForm.telefono, logoUrl: negForm.logoUrl, msgRecordatorio: negForm.msgRecordatorio, msgPostEvento: negForm.msgPostEvento, recordatorioActivo: negForm.recordatorioActivo, postEventoActivo: negForm.postEventoActivo });
    setNegSaved(true);
    setTimeout(()=>setNegSaved(false), 2000);
  };

  const inpS = {width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const lblS = {display:"block",fontSize:11,fontWeight:700,color:"#5C4033",textTransform:"uppercase",letterSpacing:0.6,marginBottom:5};

  const SectionHeader = ({id, icon, title, subtitle}) => (
    <button onClick={()=>toggle(id)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",textAlign:"left"}}>
      <div>
        <div style={{fontWeight:800,fontSize:15,color:"#1C1C1E",fontFamily:"'Playfair Display',serif"}}>{icon} {title}</div>
        {subtitle && open!==id && <div style={{fontSize:11,color:"#8B7355",marginTop:2}}>{subtitle}</div>}
      </div>
      <span style={{fontSize:18,color:"#8B7355",transform:open===id?"rotate(180deg)":"none",transition:"transform 0.2s"}}>⌄</span>
    </button>
  );

  return (
    <div style={{padding:"16px 16px 100px",display:"flex",flexDirection:"column",gap:10}}>

      {/* ── MI NEGOCIO ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="negocio" icon="🏢" title="Mi Negocio" subtitle={negocio?.nombreNegocio||"Sin configurar"} />
        {open==="negocio" && (
          <div style={{marginTop:16}}>
            <div style={{marginBottom:12}}>
              <label style={lblS}>Nombre del negocio</label>
              <input style={inpS} value={negForm.nombreNegocio} onChange={e=>setNegForm(p=>({...p,nombreNegocio:e.target.value}))} placeholder="Ej: El Quincho de Bere" />
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <div style={{flex:1}}><label style={lblS}>Ciudad</label><input style={inpS} value={negForm.ciudad} onChange={e=>setNegForm(p=>({...p,ciudad:e.target.value}))} placeholder="Ej: Mar del Plata" /></div>
              <div style={{flex:1}}><label style={lblS}>Teléfono</label><input style={inpS} value={negForm.telefono} onChange={e=>setNegForm(p=>({...p,telefono:e.target.value}))} placeholder="Ej: 223-1234567" /></div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={lblS}>Dirección</label>
              <input style={inpS} value={negForm.direccion} onChange={e=>setNegForm(p=>({...p,direccion:e.target.value}))} placeholder="Ej: San Martín 1234, Piso 2" />
            </div>
            <div style={{marginBottom:16}}>
              <label style={lblS}>Logo</label>
              <div style={{display:"flex",alignItems:"center",gap:14,marginTop:4}}>
                <div style={{width:72,height:72,borderRadius:36,background:"#F5EDE4",border:"2px solid #EDE0D0",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {negForm.logoUrl ? <img src={negForm.logoUrl} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"} /> : <span style={{fontSize:28}}>🏠</span>}
                </div>
                <div style={{flex:1}}>
                  <LogoUploadButton orgId={currentOrgId} onUploaded={url=>setNegForm(p=>({...p,logoUrl:url}))} />
                  {negForm.logoUrl && <div style={{fontSize:10,color:"#8B7355",marginTop:4,wordBreak:"break-all"}}>{negForm.logoUrl.split("/").pop()?.split("?")[0]}</div>}
                </div>
              </div>
            </div>
            {/* Mensajes de WhatsApp - colapsable */}
            <div style={{borderTop:"1px solid #EDE0D0",paddingTop:14,marginTop:4}}>
              <button onClick={()=>setShowMsgs(p=>!p)}
                style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:showMsgs?14:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>💬</span>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>Mensajes de WhatsApp</div>
                    <div style={{fontSize:11,color:"#8B7355"}}>Personalizar recordatorio y post-evento</div>
                  </div>
                </div>
                <span style={{fontSize:18,color:"#8B7355",transform:showMsgs?"rotate(180deg)":"none",transition:"transform 0.2s"}}>›</span>
              </button>

              {showMsgs && (
                <div>
                  {/* Recordatorio */}
                  <div style={{marginBottom:12,padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:negForm.recordatorioActivo?10:0}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>📲 Recordatorio pre-evento</div>
                        <div style={{fontSize:11,color:"#8B7355"}}>Se envía el día anterior al evento</div>
                      </div>
                      <button onClick={()=>setNegForm(p=>({...p,recordatorioActivo:!p.recordatorioActivo}))}
                        style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"none",background:negForm.recordatorioActivo?"#16A34A":"#EDE0D0",color:negForm.recordatorioActivo?"#FFF":"#8B7355",flexShrink:0,marginLeft:8}}>
                        {negForm.recordatorioActivo?"✅ Activo":"Inactivo"}
                      </button>
                    </div>
                    {negForm.recordatorioActivo&&<textarea style={{...inpS,height:130,resize:"vertical",fontSize:12}} value={negForm.msgRecordatorio} onChange={e=>setNegForm(p=>({...p,msgRecordatorio:e.target.value}))} />}
                  </div>

                  {/* Post-evento */}
                  <div style={{marginBottom:4,padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:negForm.postEventoActivo?10:0}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>💌 Mensaje post-evento</div>
                        <div style={{fontSize:11,color:"#8B7355"}}>Se envía el día siguiente al evento</div>
                      </div>
                      <button onClick={()=>setNegForm(p=>({...p,postEventoActivo:!p.postEventoActivo}))}
                        style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"none",background:negForm.postEventoActivo?"#16A34A":"#EDE0D0",color:negForm.postEventoActivo?"#FFF":"#8B7355",flexShrink:0,marginLeft:8}}>
                        {negForm.postEventoActivo?"✅ Activo":"Inactivo"}
                      </button>
                    </div>
                    {negForm.postEventoActivo&&<textarea style={{...inpS,height:130,resize:"vertical",fontSize:12}} value={negForm.msgPostEvento} onChange={e=>setNegForm(p=>({...p,msgPostEvento:e.target.value}))} />}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleSaveNegocio} style={{width:"100%",padding:"12px",background:negSaved?"#16A34A":"#C4602B",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"background 0.3s"}}>
              {negSaved ? "✅ Guardado" : "💾 Guardar"}
            </button>
          </div>
        )}
      </div>

      {/* ── ESPACIOS ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="espacios" icon="🏠" title="Espacios" subtitle={`${recursos.length} espacio${recursos.length!==1?"s":""} configurado${recursos.length!==1?"s":""}`} />
        {open==="espacios" && (
          <div style={{marginTop:16}}>
            {recursos.length===0 && <div style={{fontSize:13,color:"#8B7355",marginBottom:12}}>No hay espacios creados. Agregá uno para empezar.</div>}
            {recursos.map(r=>(
              <EspacioCard key={r.id} espacio={r} onDelete={async()=>{
                if(!window.confirm(`¿Eliminás "${r.nombre}"? Esta acción no se puede deshacer.`)) return;
                const {error:delErr} = await supabase.from("recursos").delete().eq("id",r.id);
                if(delErr){ alert("No se pudo eliminar el espacio: "+delErr.message); return; }
                setRecursos(prev=>prev.filter(x=>x.id!==r.id));
                if(setTurnosRecurso) setTurnosRecurso(prev=>prev.filter(t=>t.recursoId!==r.id));
              }} onTurnosChange={(recursoId,nuevos)=>setTurnosRecurso&&setTurnosRecurso(prev=>[...prev.filter(t=>t.recursoId!==recursoId),...nuevos])} />
            ))}
            <AddEspacioForm recursos={recursos} setRecursos={setRecursos} plan={currentUser?.plan} />
          </div>
        )}
      </div>

      {/* ── COLABORADORES ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="colab" icon="👥" title="Colaboradores" subtitle={planLimits.colaboradores===0?"No disponible en tu plan":`Hasta ${planLimits.colaboradores} en tu plan`} />
        {open==="colab" && <div style={{marginTop:16}}><ColaboradoresSection orgId={currentOrgId} plan={currentUser?.plan} embedded /></div>}
      </div>

      {/* ── SERVICIOS EXTRAS ── */}
      <div style={{...card, padding:16, opacity:planLimits.serviciosExtras===false?0.7:1}}>
        <SectionHeader id="extras" icon="✨" title="Servicios Extras" subtitle={planLimits.serviciosExtras===false?"No disponible en tu plan":`${serviciosExtras.length} servicio${serviciosExtras.length!==1?"s":""}`} />
        {open==="extras" && (
          <div style={{marginTop:16}}>
            {planLimits.serviciosExtras===false ? (
              <div style={{fontSize:13,color:"#8B7355"}}>🔒 Tu plan actual no incluye servicios extras. Actualizá a Profesional o Premium para activarlos.</div>
            ) : (
              <>
                {serviciosExtras.length===0 && <div style={{fontSize:13,color:"#8B7355",marginBottom:10}}>No hay servicios extras creados.</div>}
                {serviciosExtras.map(s=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #F5EDE4"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13,color:"#1C1C1E"}}>{s.descripcion}</div>
                      <div style={{fontSize:12,color:"#8B7355"}}>{fmtCurrency(s.precioActual)}</div>
                    </div>
                    <button onClick={async()=>{await sb.remove("servicios_extras",s.id);setServiciosExtras(prev=>prev.filter(x=>x.id!==s.id));}} style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>🗑️</button>
                  </div>
                ))}
                <AddSrvForm serviciosExtras={serviciosExtras} setServiciosExtras={setServiciosExtras} />
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function AddEspacioForm({ recursos, setRecursos, plan }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({nombre:"",capacidadMax:""});
  const limits = getPlanLimits(plan);
  const atLimit = recursos.length >= limits.espacios;
  if(!show) return (
    <button onClick={()=>{ if(atLimit){alert(`Tu plan ${plan||"actual"} permite hasta ${limits.espacios} espacio${limits.espacios!==1?"s":""}. Actualizá tu plan para agregar más.`);return;} setShow(true);}}
      style={{marginTop:12,width:"100%",padding:"10px",background: atLimit?"#F3F4F6":"#FDF8F3",border:`1.5px dashed ${atLimit?"#D1D5DB":"#C4602B"}`,borderRadius:10,color:atLimit?"#9CA3AF":"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
      {atLimit ? `🔒 Límite de espacios (${limits.espacios}) alcanzado` : "+ Agregar espacio"}
    </button>
  );
  return (
    <div style={{marginTop:12,padding:12,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0"}}>
      <input placeholder="Nombre del espacio" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none"}} />
      <input type="number" placeholder="Capacidad máxima" value={form.capacidadMax} onChange={e=>setForm(p=>({...p,capacidadMax:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:10,boxSizing:"border-box",outline:"none"}} />
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShow(false)} style={{flex:1,padding:"9px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Cancelar</button>
        <button onClick={async()=>{
          if(!form.nombre) return;
          const nuevo={id:genId(),nombre:form.nombre,capacidadMax:Number(form.capacidadMax)||0,modo:"fijo",orgId:currentOrgId,org_id:currentOrgId};
          const {error}=await supabase.from("recursos").insert({id:nuevo.id,nombre:nuevo.nombre,capacidad_max:nuevo.capacidadMax,modo:"fijo",org_id:currentOrgId,creado_en:new Date().toISOString()});
          if(error){alert("Error al guardar espacio: "+error.message);return;}
          setRecursos(prev=>[...prev,nuevo]);
          setForm({nombre:"",capacidadMax:""});setShow(false);
        }} style={{flex:2,padding:"9px",background:"#C4602B",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700}}>Guardar</button>
      </div>
    </div>
  );
}

function AddSrvForm({ serviciosExtras, setServiciosExtras }) {
  const [form, setForm] = useState({descripcion:"",precioActual:""});
  const [show, setShow] = useState(false);
  if(!show) return <button onClick={()=>setShow(true)} style={{marginTop:12,width:"100%",padding:"10px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:10,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar servicio</button>;
  return (
    <div style={{marginTop:12,padding:12,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0"}}>
      <input placeholder="Nombre del servicio" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none"}} />
      <input type="number" placeholder="Precio $" value={form.precioActual} onChange={e=>setForm(p=>({...p,precioActual:e.target.value}))}
        onFocus={e=>e.target.select()}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:10,boxSizing:"border-box",outline:"none"}} />
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShow(false)} style={{flex:1,padding:"8px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Cancelar</button>
        <button onClick={async()=>{
          if(!form.descripcion||!form.precioActual)return;
          const newSrv={id:genId(),descripcion:form.descripcion,precioActual:Number(form.precioActual),activo:true};
          const updated=[...serviciosExtras,newSrv];
          setServiciosExtras(updated);
          await sb.upsert("servicios_extras",[{id:newSrv.id,descripcion:newSrv.descripcion,precio_actual:newSrv.precioActual,activo:true,creado_en:new Date().toISOString()}]);
          setForm({descripcion:"",precioActual:""});setShow(false);
        }} style={{flex:2,padding:"8px",background:"#C4602B",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700}}>Guardar</button>
      </div>
    </div>
  );
}


function RecursosView({ recursos, setRecursos, serviciosExtras, setServiciosExtras }) {
  const [showSrvForm,setShowSrvForm]=useState(false);
  const [srvForm,setSrvForm]=useState({descripcion:"",precioActual:""});
  const saveSrv = async d=>{setServiciosExtras(d); await sb.upsert("servicios_extras", d.map(x=>({id:x.id,descripcion:x.descripcion||"",precio_actual:x.precioActual||0,activo:x.activo!==false,creado_en:x.creadoEn||new Date().toISOString()})));};
  return (
    <div style={{padding:"16px 16px 100px"}}>
      {/* Espacios — solo lectura, gestión en Config */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>🏠 Espacios</div>
      </div>
      {recursos.map(r=>(
        <div key={r.id} style={{...card,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:700,fontSize:14}}>🏠 {r.nombre}</div>{r.capacidadMax>0&&<div style={{fontSize:12,color:"#8B7355",marginTop:2}}>Hasta {r.capacidadMax} personas</div>}</div>
        </div>
      ))}
      <div style={{fontSize:12,color:"#8B7355",marginBottom:20,marginTop:4}}>Para agregar o eliminar espacios, andá a Configuración → Espacios.</div>

      {/* Servicios extras catalog */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"24px 0 12px"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>🎉 Catálogo de Extras</div>
        <Btn small onClick={()=>setShowSrvForm(true)}>+ Agregar</Btn>
      </div>
      {serviciosExtras.map(s=>(
        <div key={s.id} style={{...card,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600,fontSize:14}}>{s.descripcion}</div><div style={{fontSize:12,color:"#16A34A",fontWeight:700,marginTop:2}}>{fmtCurrency(s.precioActual)}</div></div>
          <Btn small variant="danger" onClick={async()=>{await sb.remove("servicios_extras",s.id);saveSrv(serviciosExtras.filter(x=>x.id!==s.id));}}>🗑️</Btn>
        </div>
      ))}

      {showSrvForm && (
        <BottomModal title="Nuevo Servicio Extra" onClose={()=>setShowSrvForm(false)}>
          <Input label="Descripción del servicio" value={srvForm.descripcion} onChange={v=>setSrvForm(p=>({...p,descripcion:v}))} placeholder="DJ, Vajilla, Limpieza..." />
          <Input label="Precio actual ($)" type="number" value={srvForm.precioActual} onChange={v=>setSrvForm(p=>({...p,precioActual:v}))} placeholder="0" />
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setShowSrvForm(false)}>Cancelar</Btn>
            <Btn onClick={()=>{if(!srvForm.descripcion||!srvForm.precioActual)return;saveSrv([...serviciosExtras,{id:genId(),descripcion:srvForm.descripcion,precioActual:Number(srvForm.precioActual)}]);setShowSrvForm(false);setSrvForm({descripcion:"",precioActual:""});}}>Guardar</Btn>
          </div>
        </BottomModal>
      )}
    </div>
  );
}

// ─── FAB ─────────────────────────────────────────────────

function FAB({ onNewPago, onNewGasto }) {
  const [open,setOpen]=useState(false);
  return (
    <div style={{position:"fixed",bottom:82,right:20,zIndex:1500}}>
      {open && (
        <>
          <div onClick={()=>{setOpen(false);onNewGasto();}} style={{position:"absolute",bottom:130,right:0,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <span style={{background:"#FFF",padding:"5px 12px",borderRadius:8,fontSize:13,fontWeight:600,color:"#DC2626",boxShadow:"0 2px 10px rgba(0,0,0,0.12)",whiteSpace:"nowrap"}}>Registrar Gasto</span>
            <div style={{width:48,height:48,borderRadius:24,background:"#DC2626",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(220,38,38,0.4)",fontSize:20,flexShrink:0}}>💸</div>
          </div>
          <div onClick={()=>{setOpen(false);onNewPago();}} style={{position:"absolute",bottom:72,right:0,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <span style={{background:"#FFF",padding:"5px 12px",borderRadius:8,fontSize:13,fontWeight:600,color:"#16A34A",boxShadow:"0 2px 10px rgba(0,0,0,0.12)",whiteSpace:"nowrap"}}>Registrar Cobro</span>
            <div style={{width:48,height:48,borderRadius:24,background:"#16A34A",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(22,163,74,0.4)",fontSize:20,flexShrink:0}}>💰</div>
          </div>
          <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:-1}} />
        </>
      )}
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:58,height:58,borderRadius:29,
        background: open?"#1E0E08":"linear-gradient(135deg,#C4602B,#9E4A1E)",
        border:"none",cursor:"pointer",color:"#FFF",fontSize:26,
        boxShadow:"0 4px 18px rgba(196,96,43,0.45)",
        display:"flex",alignItems:"center",justifyContent:"center",
        transform:open?"rotate(45deg)":"none",transition:"all 0.22s",
      }}>+</button>
    </div>
  );
}

// ─── SIDE MENU ────────────────────────────────────────────

function SideMenu({ open, onClose, onNavigate, tab, currentUser, negocio }) {
  const isAdmin = currentUser?.rol==="Administrador";
  const limits = getPlanLimits(currentUser?.plan);
  const tieneRecordatorios = limits.recordatorios !== false;
  const items=[
    {icon:"📊",label:"Inicio",view:"inicio"},
    {icon:"📋",label:"Reservas",view:"reservas"},
    {icon:"👥",label:"Clientes",view:"clientes"},
    ...(isAdmin?[{icon:"📈",label:"Reportes",view:"reportes"}]:[]),
    ...(isAdmin?[{icon:"💸",label:"Gastos",view:"gastos"}]:[]),
    ...(tieneRecordatorios?[{icon:"🔔",label:"Recordatorios",view:"recordatorios"}]:[]),
    ...(isAdmin?[{icon:"⚙️",label:"Configuración",view:"config"}]:[]),
  ];
  return (
    <>
      {open && <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:900}} />}
      <div style={{position:"fixed",top:0,left:0,bottom:0,width:265,background:"#1E0E08",zIndex:1000,transform:open?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s ease",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"52px 20px 24px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          {negocio?.logoUrl
            ? <img src={negocio.logoUrl} alt="logo" style={{width:44,height:44,borderRadius:10,objectFit:"cover"}} />
            : <LogoSVG size={44} color="#F0A882" />
          }
          <div style={{marginTop:8}}>
            <div style={{fontSize:16,fontWeight:800,color:"#FFF",fontFamily:"'Playfair Display',serif",lineHeight:1.2}}>{negocio?.nombreNegocio||"Mi Negocio"}</div>
            {negocio?.ciudad && <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:2}}>{negocio.ciudad}</div>}
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:6}}>Tu lugar de descanso y diversión</div>
        </div>
        {items.map(item=>(
          <button key={item.view} onClick={()=>{onNavigate(item.view);onClose();}} style={{
            display:"flex",alignItems:"center",gap:14,padding:"15px 20px",
            background:tab===item.view?"rgba(196,96,43,0.25)":"none",
            border:"none",borderLeft:tab===item.view?"3px solid #C4602B":"3px solid transparent",
            color:tab===item.view?"#F0A882":"rgba(255,255,255,0.8)",
            cursor:"pointer",fontSize:14,fontWeight:600,textAlign:"left",width:"100%",fontFamily:"inherit",
          }}>
            <span style={{fontSize:20}}>{item.icon}</span>{item.label}
          </button>
        ))}
        <div style={{marginTop:"auto",padding:"20px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>v2.0 · Mi Quincho App</div>
        </div>
      </div>
    </>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────


function IAModal({ onClose, reservas, clientes, pagos, bloqueos, serviciosExtras, config }) {
  const [msgs, setMsgs] = useState([{role:"assistant",content:"¡Hola! Soy tu asistente del Quincho de Bere. Podés preguntarme sobre disponibilidad, reservas, clientes o pedirme que analice tus datos. ¿En qué te ayudo?"}]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  const today = new Date().toISOString().slice(0,10);
  const upcoming = reservas.filter(r=>r.fecha>=today&&r.estado!=="cancelada"&&r.estado!=="finalizada")
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const finesDisponibles = [];
  for(let i=0;i<60;i++){
    const d=new Date(); d.setDate(d.getDate()+i);
    const ds=d.toISOString().slice(0,10);
    const dow=d.getDay();
    if(dow===6||dow===0){
      const ocupado=reservas.some(r=>r.fecha===ds&&r.estado!=="cancelada"&&r.turno==="completo")||
        (reservas.filter(r=>r.fecha===ds&&r.estado!=="cancelada").length>=2)||
        bloqueos.some(b=>b.fecha===ds);
      if(!ocupado)finesDisponibles.push(ds);
    }
  }

  const resumenRes = upcoming.slice(0,10).map(r=>{
    const c=clientes.find(x=>x.id===r.clienteId);
    return "- "+r.fecha+" | "+r.turno+" | "+(c?c.nombre+" "+c.apellido:"Sin cliente")+" | "+r.estado+" | $"+r.montoPactado;
  }).join("\n");
  const systemPrompt = "Sos el asistente del Quincho de Bere en Mar del Plata. Hoy es "+today+".\n\n"+
    "RESERVAS PROXIMAS ("+upcoming.length+"):\n"+resumenRes+"\n\n"+
    "FINES DISPONIBLES: "+finesDisponibles.slice(0,8).join(", ")+"\n"+
    "CLIENTES: "+clientes.length+"\n"+
    "INGRESOS MES: $"+pagos.filter(p=>p.fecha&&p.fecha.startsWith(today.slice(0,7))).reduce((s,p)=>s+p.monto,0)+"\n\n"+
    "Responde conciso y util. Si piden crear algo, explica que datos completar en la app.";

  const send = async () => {
    if(!input.trim()||loading) return;
    const userMsg = {role:"user",content:input};
    setMsgs(m=>[...m,userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:systemPrompt,
          messages:[...msgs,userMsg].filter(m=>m.role!=="assistant").map(m=>({role:m.role,content:m.content}))
        })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error.message||JSON.stringify(data.error));
      const reply = data.content?.[0]?.text || "Sin respuesta.";
      setMsgs(m=>[...m,{role:"assistant",content:reply}]);
    } catch(e) {
      setMsgs(m=>[...m,{role:"assistant",content:"Error: "+e.message}]);
    }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{background:"#FFF",borderRadius:"20px 20px 0 0",height:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid #EDE0D0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#C4602B,#9E4A1E)"}}>
          <div>
            <div style={{fontWeight:800,fontSize:17,color:"#FFF",fontFamily:"'Playfair Display',serif"}}>🤖 Asistente IA</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.8)"}}>Preguntame sobre el quincho</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#FFF",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?"#C4602B":"#F5EDE4",color:m.role==="user"?"#FFF":"#1C1C1E",fontSize:13,lineHeight:1.5,whiteSpace:"pre-wrap"}}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"10px 14px",borderRadius:"16px 16px 16px 4px",background:"#F5EDE4",color:"#8B7355",fontSize:13}}>Pensando...</div></div>}
          <div ref={endRef} />
        </div>
        <div style={{padding:"12px 16px",borderTop:"1px solid #EDE0D0",display:"flex",gap:8,background:"#FFF"}}>
          <button onClick={()=>{
            if(!("webkitSpeechRecognition" in window))return alert("Tu navegador no soporta voz.");
            const rec=new window.webkitSpeechRecognition();
            rec.lang="es-AR";rec.continuous=false;rec.interimResults=false;
            rec.onresult=(e)=>setInput(e.results[0][0].transcript);
            rec.start();
          }} style={{background:"#F3F4F6",border:"none",borderRadius:20,width:44,height:44,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🎤</button>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="¿Qué fines de semana hay libres?" disabled={loading}
            style={{flex:1,padding:"10px 14px",borderRadius:20,border:"1.5px solid #EDE0D0",fontSize:14,fontFamily:"inherit",outline:"none",background:"#FDF8F3"}} />
          <button onClick={send} disabled={loading||!input.trim()} style={{background:"#C4602B",border:"none",color:"#FFF",borderRadius:20,width:44,height:44,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",opacity:loading||!input.trim()?0.5:1}}>➤</button>
        </div>
      </div>
    </div>
  );
}



function PantallaBloqueada({ motivo, negocio }) {
  const msgs = {
    impago:      { icon:"💳", titulo:"Suscripción vencida",    texto:"Tu período de acceso ha finalizado. Para renovar tu suscripción contactá al administrador." },
    suspendido:  { icon:"🔒", titulo:"Acceso suspendido",       texto:"Tu acceso fue suspendido. Contactá al administrador para más información." },
    sin_org:     { icon:"🏢", titulo:"Sin organización",        texto:"Tu cuenta no está asociada a ninguna organización. Contactá al administrador." },
    sin_suscripcion: { icon:"📋", titulo:"Sin suscripción",     texto:"No tenés una suscripción activa para esta app. Contactá al administrador." },
  };
  const m = msgs[motivo] || msgs.sin_suscripcion;
  return (
    <div style={{minHeight:"100vh",background:"#FFF",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:380,textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>{m.icon}</div>
        {negocio?.nombreNegocio && <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,color:"#1C1C1E",marginBottom:20}}>{negocio.nombreNegocio}</div>}
        <div style={{fontWeight:700,fontSize:18,color:"#1C1C1E",marginBottom:12}}>{m.titulo}</div>
        <div style={{fontSize:14,color:"#6B7280",marginBottom:32,lineHeight:1.6}}>{m.texto}</div>
        <button onClick={()=>supabase.auth.signOut()}
          style={{padding:"12px 24px",background:"#F3F4F6",border:"none",borderRadius:10,cursor:"pointer",fontSize:14,color:"#6B7280",fontFamily:"inherit"}}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function BannerDemo({ diasRestantes }) {
  const urgente = diasRestantes <= 3;
  return (
    <div style={{
      background: urgente ? "#FEF2F2" : "#FFFBEB",
      borderBottom: `1px solid ${urgente ? "#FECACA" : "#FDE68A"}`,
      padding:"8px 16px",
      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      fontSize:13,fontWeight:600,
      color: urgente ? "#DC2626" : "#92400E",
    }}>
      <span>{urgente ? "⚠️" : "🕐"}</span>
      <span>
        {diasRestantes > 0
          ? `Período de prueba — quedan ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`
          : "Tu período de prueba venció — contactá al administrador para continuar"}
      </span>
    </div>
  );
}

function GoogleLoginScreen({ onLogin, onBlocked }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if(session?.user) { setLoading(true); await handleUser(session.user); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if(event === "SIGNED_IN" && session?.user) { setLoading(true); await handleUser(session.user); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUser = async (authUser) => {
    try {
      const email = authUser.email;

      // Verificar acceso en Supabase central
      const { data: accesoArr } = await supabaseCentral.rpc("verificar_acceso_email", {
        email_param: email,
        app_id_param: "quincho",
      });
      const acceso = Array.isArray(accesoArr) ? accesoArr[0] : accesoArr;

      if (!acceso?.tiene_acceso) {
        await supabase.auth.signOut();
        onBlocked(acceso?.motivo || "sin_suscripcion");
        return;
      }

      if (acceso.estado === "impago" || acceso.estado === "suspendido") {
        await supabase.auth.signOut();
        onBlocked(acceso.estado);
        return;
      }

      const orgId = acceso.ret_org_id;

      // Registrar mapeo user_id → org_id para RLS
      await supabase.from("user_orgs").upsert({ user_id: authUser.id, org_id: orgId });

      // Refrescar sesión para que el JWT quede sincronizado con los cambios de RLS
      await supabase.auth.refreshSession();

      const user = {
        id: authUser.id,
        nombre: authUser.user_metadata?.full_name || authUser.user_metadata?.name || acceso.nombre_docente || email.split("@")[0],
        avatarUrl: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
        email,
        orgId,
        rol: "Administrador",
        plan: acceso.plan || "basico",
        suscripcionEstado: acceso.estado,
        diasRestantes: acceso.dias_restantes ?? null,
      };
      localStorage.setItem("qb_user", JSON.stringify(user));
      onLogin(user);
    } catch(e) {
      setError("Error al verificar acceso: " + e.message);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://quincho-bere.vercel.app" },
    });
  };

  return (
    <div style={{minHeight:"100vh",background:"#FFF",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:380,textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>🏡</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:800,color:"#1C1C1E",marginBottom:4}}>Gestión de Espacios</div>
        <div style={{fontSize:14,color:"#8B7355",marginBottom:40}}>Iniciá sesión para continuar</div>

        {error && (
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",marginBottom:20,color:"#DC2626",fontSize:13}}>
            {error}
          </div>
        )}

        <button onClick={handleGoogleLogin} disabled={loading}
          style={{width:"100%",padding:"14px 20px",background:loading?"#F3F4F6":"#FFF",border:"1.5px solid #E5E7EB",borderRadius:12,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:15,fontWeight:600,color:"#1C1C1E",fontFamily:"inherit",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",transition:"all 0.2s"}}>
          {loading ? (
            <span style={{color:"#8B7355"}}>Verificando acceso...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Iniciar sesión con Google
            </>
          )}
        </button>

        <div style={{marginTop:16,fontSize:12,color:"#D1D5DB"}}>Solo usuarios autorizados pueden acceder</div>
      </div>
    </div>
  );
}

const ICONOS_OB = ["📌","☀️","🌤️","🌆","🌙","⚽","🎾","🏊","🎉","🎪","🍖","🎸","💅","🏋️","🎭","🏠"];

function OnboardingWizard({ onFinish }) {
  const [step, setStep] = useState(1);
  const [negocio, setNegocio] = useState({ nombreNegocio:"", ciudad:"", direccion:"", telefono:"" });
  const [espacio, setEspacio] = useState({ nombre:"", capacidadMax:"", modo:"fijo" });
  const [turnos, setTurnos] = useState([]);
  const [turnoForm, setTurnoForm] = useState({ nombre:"", horaInicio:"", horaFin:"", precioSemana:"", precioFinde:"", icono:"📌" });
  const [slotCfg, setSlotCfg] = useState({ horaInicio:"08:00", horaFin:"22:00", duracion:60, precioSemana:"", precioFinde:"" });
  const [saving, setSaving] = useState(false);

  const inpS = {padding:"10px 12px",borderRadius:10,border:"1.5px solid #EDE0D0",fontSize:14,fontFamily:"inherit",width:"100%",boxSizing:"border-box",outline:"none",background:"#FFF"};
  const lblS = {fontSize:12,fontWeight:700,color:"#5C4033",textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4};

  const addTurno = () => {
    if(!turnoForm.nombre||!turnoForm.horaInicio||!turnoForm.horaFin) return alert("Completá nombre, hora inicio y hora fin.");
    setTurnos(prev=>[...prev,{...turnoForm}]);
    setTurnoForm({nombre:"",horaInicio:"",horaFin:"",precioSemana:"",precioFinde:"",icono:"📌"});
  };

  const steps = ["Tu negocio","Tu espacio","Turnos"];

  return (
    <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#FDF5EE,#FFF8F3)",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:440}}>

        {/* Logo / título */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:8}}>🏡</div>
          <div style={{fontSize:22,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display',serif"}}>¡Bienvenido!</div>
          <div style={{fontSize:13,color:"#8B7355",marginTop:4}}>Configurá tu espacio en 3 pasos</div>
        </div>

        {/* Steps indicator */}
        <div style={{display:"flex",alignItems:"center",marginBottom:24}}>
          {steps.map((s,i)=>(
            <Fragment key={i}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
                <div style={{width:28,height:28,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,
                  background:step>i+1?"#16A34A":step===i+1?"#C4602B":"#EDE0D0",
                  color:step>=i+1?"#FFF":"#8B7355",transition:"background 0.3s"}}>
                  {step>i+1?"✓":i+1}
                </div>
                <div style={{fontSize:10,fontWeight:600,color:step===i+1?"#C4602B":"#8B7355",marginTop:3}}>{s}</div>
              </div>
              {i<steps.length-1&&<div style={{flex:2,height:2,background:step>i+1?"#16A34A":"#EDE0D0",marginBottom:14,transition:"background 0.3s"}} />}
            </Fragment>
          ))}
        </div>

        {/* Card del paso */}
        <div style={{background:"#FFF",borderRadius:16,padding:24,boxShadow:"0 4px 24px rgba(196,96,43,0.1)",border:"1px solid #EDE0D0"}}>

          {step===1 && (
            <>
              <div style={{fontSize:16,fontWeight:700,color:"#1C1C1E",marginBottom:16}}>¿Cómo se llama tu negocio?</div>
              <div style={{marginBottom:12}}>
                <label style={lblS}>Nombre del negocio *</label>
                <input style={inpS} value={negocio.nombreNegocio} onChange={e=>setNegocio(p=>({...p,nombreNegocio:e.target.value}))} placeholder="Ej: El Quincho de Bere" autoFocus />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <label style={lblS}>Ciudad</label>
                  <input style={inpS} value={negocio.ciudad} onChange={e=>setNegocio(p=>({...p,ciudad:e.target.value}))} placeholder="Ej: Mar del Plata" />
                </div>
                <div>
                  <label style={lblS}>Teléfono</label>
                  <input style={inpS} value={negocio.telefono} onChange={e=>setNegocio(p=>({...p,telefono:e.target.value}))} placeholder="Ej: 223-1234567" />
                </div>
              </div>
              <div style={{marginBottom:20}}>
                <label style={lblS}>Dirección <span style={{fontWeight:400,color:"#8B7355"}}>(opcional)</span></label>
                <input style={inpS} value={negocio.direccion} onChange={e=>setNegocio(p=>({...p,direccion:e.target.value}))} placeholder="Ej: San Martín 1234" />
              </div>
              <button onClick={()=>{ if(!negocio.nombreNegocio.trim()) return alert("Ingresá el nombre de tu negocio."); setStep(2); }}
                style={{width:"100%",padding:13,background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>
                Continuar →
              </button>
            </>
          )}

          {step===2 && (
            <>
              <div style={{fontSize:16,fontWeight:700,color:"#1C1C1E",marginBottom:4}}>Tu primer espacio</div>
              <div style={{fontSize:12,color:"#8B7355",marginBottom:16}}>Podés agregar más espacios después desde Configuración.</div>
              <div style={{marginBottom:12}}>
                <label style={lblS}>Nombre del espacio *</label>
                <input style={inpS} value={espacio.nombre} onChange={e=>setEspacio(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Quincho Principal, Cancha 1" autoFocus />
              </div>
              <div style={{marginBottom:12}}>
                <label style={lblS}>Capacidad máxima <span style={{fontWeight:400,color:"#8B7355"}}>(personas, opcional)</span></label>
                <input style={inpS} type="number" value={espacio.capacidadMax} onChange={e=>setEspacio(p=>({...p,capacidadMax:e.target.value}))} placeholder="Ej: 80" />
              </div>
              <div style={{marginBottom:20}}>
                <label style={lblS}>Tipo de espacio</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{v:"fijo",icon:"🏡",label:"Quincho / Salón",desc:"Turnos fijos (ej: día, noche)"},{v:"slot",icon:"⚽",label:"Cancha / Pista",desc:"Reservas por hora"}].map(o=>(
                    <button key={o.v} onClick={()=>setEspacio(p=>({...p,modo:o.v}))}
                      style={{padding:"12px 10px",borderRadius:10,border:`2px solid ${espacio.modo===o.v?"#C4602B":"#EDE0D0"}`,background:espacio.modo===o.v?"#FEF3EC":"#FFF",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                      <div style={{fontSize:24,marginBottom:4}}>{o.icon}</div>
                      <div style={{fontWeight:700,fontSize:12,color:"#1C1C1E"}}>{o.label}</div>
                      <div style={{fontSize:10,color:"#8B7355",marginTop:2}}>{o.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(1)} style={{flex:1,padding:12,background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit",color:"#8B7355"}}>← Atrás</button>
                <button onClick={()=>{ if(!espacio.nombre.trim()) return alert("Ingresá el nombre del espacio."); setStep(3); }}
                  style={{flex:2,padding:12,background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                  Continuar →
                </button>
              </div>
            </>
          )}

          {step===3 && (
            <>
              <div style={{fontSize:16,fontWeight:700,color:"#1C1C1E",marginBottom:4}}>
                {espacio.modo==="slot" ? `Horarios de ${espacio.nombre}` : `Turnos de ${espacio.nombre}`}
              </div>
              <div style={{fontSize:12,color:"#8B7355",marginBottom:14}}>
                {espacio.modo==="slot" ? "Configurá el rango horario y la duración de cada turno." : "Agregá los turnos disponibles. También podés hacerlo después desde Configuración."}
              </div>

              {espacio.modo==="slot" ? (
                /* ── MODO CANCHA: configuración de slots ── */
                <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora apertura</div><input type="time" style={inpS} value={slotCfg.horaInicio} onChange={e=>setSlotCfg(p=>({...p,horaInicio:e.target.value}))} /></div>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora cierre</div><input type="time" style={inpS} value={slotCfg.horaFin} onChange={e=>setSlotCfg(p=>({...p,horaFin:e.target.value}))} /></div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Duración de cada turno</div>
                    <select style={inpS} value={slotCfg.duracion} onChange={e=>setSlotCfg(p=>({...p,duracion:Number(e.target.value)}))}>
                      {[30,45,60,90,120].map(m=><option key={m} value={m}>{m} minutos</option>)}
                    </select>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio lun–vie ($)</div><input type="number" style={inpS} value={slotCfg.precioSemana} onChange={e=>setSlotCfg(p=>({...p,precioSemana:e.target.value}))} placeholder="0" /></div>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio sáb–dom ($)</div><input type="number" style={inpS} value={slotCfg.precioFinde} onChange={e=>setSlotCfg(p=>({...p,precioFinde:e.target.value}))} placeholder="0" /></div>
                  </div>
                  <div style={{background:"#F0FDF4",borderRadius:8,padding:"10px 12px",border:"1px solid #BBF7D0",fontSize:12,color:"#166534"}}>
                    ✓ Se van a generar turnos de {slotCfg.duracion} min entre las {slotCfg.horaInicio} y las {slotCfg.horaFin}
                  </div>
                </div>
              ) : (
                /* ── MODO QUINCHO: turnos manuales ── */
                <>
                  {turnos.map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",background:"#FDF5EE",borderRadius:8,marginBottom:6,border:"1px solid #EDE0D0"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:18}}>{t.icono}</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{t.nombre}</div>
                          <div style={{fontSize:11,color:"#8B7355"}}>{t.horaInicio} – {t.horaFin}</div>
                        </div>
                      </div>
                      <button onClick={()=>setTurnos(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#DC2626"}}>×</button>
                    </div>
                  ))}
                  <div style={{background:"#FDF5EE",borderRadius:10,padding:12,border:"1px dashed #C4602B",marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:8}}>Agregar turno</div>
                    <input style={{...inpS,marginBottom:8,fontSize:13}} placeholder="Nombre (ej: Noche, Turno 20hs)" value={turnoForm.nombre} onChange={e=>setTurnoForm(p=>({...p,nombre:e.target.value}))} />
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora inicio</div><input type="time" style={inpS} value={turnoForm.horaInicio} onChange={e=>setTurnoForm(p=>({...p,horaInicio:e.target.value}))} /></div>
                      <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Hora fin</div><input type="time" style={inpS} value={turnoForm.horaFin} onChange={e=>setTurnoForm(p=>({...p,horaFin:e.target.value}))} /></div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio lun–vie ($)</div><input type="number" style={inpS} value={turnoForm.precioSemana} onChange={e=>setTurnoForm(p=>({...p,precioSemana:e.target.value}))} placeholder="0" /></div>
                      <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio sáb–dom ($)</div><input type="number" style={inpS} value={turnoForm.precioFinde} onChange={e=>setTurnoForm(p=>({...p,precioFinde:e.target.value}))} placeholder="0" /></div>
                    </div>
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:11,color:"#8B7355",marginBottom:4}}>Ícono</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {ICONOS_OB.map(ic=>(
                          <button key={ic} onClick={()=>setTurnoForm(p=>({...p,icono:ic}))}
                            style={{width:32,height:32,fontSize:16,border:`2px solid ${turnoForm.icono===ic?"#C4602B":"#EDE0D0"}`,borderRadius:7,background:turnoForm.icono===ic?"#FEF3EC":"#FFF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={addTurno} style={{width:"100%",padding:"8px",background:"#FFF",border:"1.5px solid #C4602B",borderRadius:8,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
                  </div>
                  {turnos.length===0&&<div style={{textAlign:"center",marginBottom:10,fontSize:11,color:"#8B7355"}}>Podés saltear los turnos y cargarlos después desde Configuración.</div>}
                </>
              )}

              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(2)} style={{flex:1,padding:12,background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:"#8B7355"}}>← Atrás</button>
                <button onClick={async()=>{
                  setSaving(true);
                  await onFinish({negocio,espacio,turnos,slotCfg});
                  setSaving(false);
                }} disabled={saving} style={{flex:2,padding:12,background:saving?"#9E4A1E":"#C4602B",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {saving?"Guardando...":"¡Empezar! 🎉"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,setTabRaw]=useState("inicio");
  const setTab = (t) => { setTabRaw(t); window.scrollTo(0,0); };
  const [sideOpen,setSideOpen]=useState(false);
  const [modal,setModal]=useState(null);
  const [selectedClientId,setSelectedClientId]=useState(null);
  const now0=new Date(); const [calYear,setCalYear]=useState(now0.getFullYear()); const [calMonth,setCalMonth]=useState(now0.getMonth());

  const [detailReserva,setDetailReserva]=useState(null);
  const [detailCliente,setDetailCliente]=useState(null);
  const [editReserva,setEditReserva]=useState(null);
  const [editCliente,setEditCliente]=useState(null);
  const [dayModal,setDayModal]=useState(null);
  const [espacioPicker,setEspacioPicker]=useState(null); // {date, reservas} — picker de espacio antes de abrir DayModal
  const [initDate,setInitDate]=useState(null);
  const [initTurno,setInitTurno]=useState(null);
  const [pagoReservaId,setPagoReservaId]=useState(null);
  const [extraReservaId,setExtraReservaId]=useState(null);
  const [printData,setPrintData]=useState(null);
  const [ratingQueue,setRatingQueue]=useState([]);
  const [snoozedRatings,setSnoozedRatings]=useState(new Set());
  const lastActivityRef = useRef(Date.now());
  const reservasRef = useRef([]);
  const recordatoriosRef = useRef([]);
  const [checkTick,setCheckTick]=useState(0);
  const [alertaActiva,setAlertaActiva]=useState(null);
  const [shownAlerts,setShownAlerts]=useState(new Set());
  const [showRootMenu,setShowRootMenu]=useState(false);

  const [clientes,setClientes]=useState([]);
  const [reservas,setReservas]=useState([]);
  const [pagos,setPagos]=useState([]);
  const [gastos,setGastos]=useState([]);
  const [recursos,setRecursos]=useState([]);
  const [turnosRecurso,setTurnosRecurso]=useState([]);
  const [extrasReserva,setExtrasReserva]=useState([]);
  const [serviciosExtras,setServiciosExtras]=useState(DEFAULT_SERVICIOS);
  const [config,setConfig]=useState(DEFAULT_CONFIG);
  const MSG_REC_DEFAULT = `Hola {nombre}! 👋
Te contactamos desde {nombre_negocio} para recordarte tu evento mañana {fecha}, de {horario_inicio} a {horario_fin}.

{extras}
💰 Costo total: {monto_total}
✅ Abonado: {pagado}
📌 Saldo para mañana: {saldo}

¡Te esperamos!`;

  const MSG_POST_DEFAULT = `Hola {nombre}! 🎉
Desde {nombre_negocio} queremos agradecerte por haber realizado tu evento con nosotros. ¡Fue un placer recibirte!

Te esperamos nuevamente. Si podés etiquetarnos en tus fotos nos ayudás un montón 🙌

¡Muchas gracias por elegirnos!`;

  const [negocio,setNegocio]=useState({ nombreNegocio:"", ciudad:"", direccion:"", telefono:"", logoUrl:"", msgRecordatorio:"", msgPostEvento:"", recordatorioActivo:true, postEventoActivo:true });
  const [onboarding,setOnboarding]=useState(false); // wizard primer uso
  const [usuarios,setUsuarios]=useState([]);
  const [perfilesUsuarios,setPerfilesUsuarios]=useState([]);
  const [currentUser,setCurrentUser]=useState(null);
  const [bloqueadoMotivo,setBloqueadoMotivo]=useState(null);
  const isAdmin = true; // todos los usuarios tienen acceso completo en el nuevo modelo
  const [tareas,setTareas]=useState([]);
  const [bloqueos,setBloqueos]=useState([]);
  const [recordatorios,setRecordatorios]=useState([]);
  const [bloqueoModal,setBloqueoModal]=useState(null);
  const [loaded,setLoaded]=useState(false);

  // Mostrar onboarding cuando no hay espacios (primer uso o los borró todos)
  useEffect(()=>{ if(loaded && currentUser && !onboarding && recursos.length===0) setOnboarding(true); },[loaded,currentUser,recursos.length]);

  // Detectar sesión expirada mientras la app está abierta
  useEffect(()=>{
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event) => {
      if(event === "SIGNED_OUT") {
        setCurrentUser(prev => {
          if(prev) {
            try{ localStorage.removeItem("qb_user"); }catch(e){}
            alert("Tu sesión expiró. Por favor, iniciá sesión nuevamente.");
          }
          return null;
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(()=>{
    (async()=>{
    try {
      // ── PASO 1: verificar sesión Supabase ──
      const { data:{ session } } = await supabase.auth.getSession();
      var cu=null; try{const s=localStorage.getItem("qb_user");if(s)cu=JSON.parse(s);}catch(e){}

      if(!session?.user){ try{localStorage.removeItem("qb_user");}catch(e){} return; }
      if(cu?.email && cu.email !== session.user.email){ try{localStorage.removeItem("qb_user");}catch(e){} cu=null; }
      if(!cu?.email) return;

      // ── PASO 2: verificar suscripción en central ──
      const { data:accesoArr } = await supabaseCentral.rpc("verificar_acceso_email", {
        email_param: cu.email,
        app_id_param: "quincho",
      });
      const acceso = Array.isArray(accesoArr) ? accesoArr[0] : accesoArr;

      if(!acceso?.tiene_acceso || acceso.estado==="impago" || acceso.estado==="suspendido"){
        localStorage.removeItem("qb_user");
        await supabase.auth.signOut();
        setBloqueadoMotivo(acceso?.motivo || acceso?.estado || "sin_suscripcion");
        setLoaded(true);
        return;
      }

      // ── PASO 3: configurar org y cargar datos ──
      const orgId = acceso.ret_org_id || cu.orgId;
      currentOrgId = orgId;

      const user = { ...cu, orgId, plan: acceso.plan || cu.plan || "basico", suscripcionEstado: acceso.estado, diasRestantes: acceso.dias_restantes ?? null };
      setCurrentUser(user);
      localStorage.setItem("qb_user", JSON.stringify(user));

      const [{data:c},{data:r},{data:p},{data:g},{data:rc},{data:tr},{data:er},{data:se},{data:t},{data:bl},{data:rec}]=await Promise.all([
        supabase.from("clientes").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("reservas").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("pagos").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("gastos").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("recursos").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("turnos_recurso").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("extras_reserva").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("servicios_extras").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("tareas").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("bloqueos").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
        supabase.from("recordatorios").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}),
      ]);

      if(c?.length) setClientes(c.map(x=>({id:x.id,nombre:x.nombre||"",apellido:x.apellido||"",whatsapp:x.whatsapp||"",email:x.email||"",localidad:x.localidad||"",notasInternas:x.notas_internas||"",creadoEn:x.creado_en})));
      if(r?.length) setReservas(r.map(x=>({id:x.id,clienteId:x.cliente_id||"",recursoId:x.recurso_id||"",turnoId:x.turno_id||null,fecha:x.fecha?.slice(0,10)||"",turno:x.turno||"",horario:x.horario||"",horarioFin:x.horario_fin||"",cantInvitados:x.cant_invitados||35,montoPactado:Number(x.monto_pactado)||0,estado:x.estado||"pendiente",notas:x.notas||"",creadoPor:x.creado_por||"",creadoEn:x.creado_en,fechaCreacion:x.fecha_creacion||"",recordatorioEnviado:!!x.recordatorio_enviado,postEventoProcesado:!!x.post_evento_procesado,calificacion:x.calificacion||null})));
      if(p?.length) setPagos(p.map(x=>({id:x.id,reservaId:x.reserva_id||"",monto:Number(x.monto)||0,fecha:x.fecha?.slice(0,10)||"",metodo:x.metodo||"Transferencia",notas:x.notas||"",creadoPor:x.creado_por||"",creadoEn:x.creado_en})));
      if(g?.length) setGastos(g.map(x=>({id:x.id,concepto:x.concepto||"",monto:Number(x.monto)||0,fecha:x.fecha?.slice(0,10)||"",categoria:x.categoria||"Otros",metodo:x.metodo||"Efectivo",creadoPor:x.creado_por||""})));
      if(rc?.length) setRecursos(rc.map(x=>({id:x.id,nombre:x.nombre||"",capacidadMax:x.capacidad_max||0,modo:x.modo||"fijo",slotDuracionMin:x.slot_duracion_min||60,slotHoraInicio:x.slot_hora_inicio||"08:00",slotHoraFin:x.slot_hora_fin||"22:00",orgId:x.org_id})));
      if(tr?.length) setTurnosRecurso(tr.map(x=>({id:x.id,recursoId:x.recurso_id,orgId:x.org_id,nombre:x.nombre||"",icono:x.icono||"📌",horaInicio:x.hora_inicio||"",horaFin:x.hora_fin||"",precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:x.activo!==false})));
      if(er?.length) setExtrasReserva(er.map(x=>({id:x.id,reservaId:x.reserva_id||"",servicioId:x.servicio_id||"",descripcion:x.descripcion||"",cantidad:x.cantidad||1,precioHistorico:Number(x.precio_historico)||0})));
      setServiciosExtras(se?.length ? se.map(x=>({id:x.id,descripcion:x.descripcion||"",precioActual:Number(x.precio_actual)||0,activo:x.activo!==false})) : []);
      if(t?.length) setTareas(t.map(x=>({id:x.id,descripcion:x.descripcion||"",estado:x.estado||"pendiente",fechaRegistro:x.fecha_registro||""})));
      if(bl?.length) setBloqueos(bl.map(x=>({id:x.id,fecha:x.fecha?.slice(0,10)||"",turno:x.turno||"completo",motivo:x.motivo||"",creadoPor:x.creado_por||""})));
      if(rec?.length) setRecordatorios(rec.map(x=>({id:x.id,reservaId:x.reserva_id||"",clienteId:x.cliente_id||"",tipo:x.tipo||"",nota:x.nota||"",fechaAlerta:x.fecha_alerta?.slice(0,10)||"",horaAlerta:x.hora_alerta||"09:00",estado:x.estado||"Pendiente"})));

      // Cargar config (white-label + mensajes)
      const {data:cfgData}=await supabase.from("config").select("*").eq("org_id",orgId).maybeSingle();
      if(cfgData){
        setNegocio({ nombreNegocio:cfgData.nombre_negocio||"", ciudad:cfgData.ciudad||"", direccion:cfgData.direccion||"", telefono:cfgData.telefono||"", logoUrl:cfgData.logo_url||"", msgRecordatorio:cfgData.msg_recordatorio||MSG_REC_DEFAULT, msgPostEvento:cfgData.msg_post_evento||MSG_POST_DEFAULT, recordatorioActivo:cfgData.recordatorio_activo!==false, postEventoActivo:cfgData.post_evento_activo!==false });
      }

      // Mostrar onboarding si no hay espacios configurados
      if(!rc?.length && currentOrgId) setOnboarding(true);

      if(window.location.hash?.includes("access_token")){
        window.history.replaceState(null,"",window.location.pathname);
      }
    } catch(e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoaded(true);
    }
    })();
  },[]);

  // Mantener refs actualizados para el effect de auto-cierre (evita dependencias circulares)
  useEffect(()=>{ reservasRef.current = reservas; }, [reservas]);
  useEffect(()=>{ recordatoriosRef.current = recordatorios; }, [recordatorios]);

  // Auto-close events + detect unrated (runs on load + every minute)
  // Usa refs en lugar de estado directo para evitar loop: saveR → reservas cambia → effect re-corre → saveR → ...
  useEffect(()=>{
    if(!loaded) return;
    const now=new Date();
    const todayStr=toDateStr(now);
    const curTime=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const res=reservasRef.current;
    const recs=recordatoriosRef.current;
    const toClose=res.filter(r=>{
      if(!['confirmada','senada','pendiente'].includes(r.estado)) return false;
      if(r.fecha<todayStr) return true;
      if(r.fecha===todayStr&&r.horarioFin&&curTime>=r.horarioFin) return true;
      return false;
    });
    var current=res;
    if(toClose.length>0){
      current=res.map(r=>toClose.some(x=>x.id===r.id)?{...r,estado:'finalizada'}:r);
      saveR(current);
    }
    const needsRating=current.filter(r=>r.estado==='finalizada'&&!r.calificacion&&r.clienteId&&!snoozedRatings.has(r.id));
    setRatingQueue(needsRating);
    // Check due recordatorios
    const now2=new Date();
    const today2=toDateStr(now2);
    const curT=String(now2.getHours()).padStart(2,'0')+':'+String(now2.getMinutes()).padStart(2,'0');
    const due=recs.find(r=>
      r.estado==='Pendiente'&&
      r.fechaAlerta===today2&&
      r.horaAlerta<=curT&&
      !shownAlerts.has(r.id)
    );
    if(due) setAlertaActiva(due);
  },[loaded,checkTick]);

  // Interval: re-check every 60 seconds
  useEffect(()=>{
    if(!loaded) return;
    const INACTIVITY_MS = 30*60*1000;
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('click', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('keydown', updateActivity);

    // Chequear al volver de background (mobile/tab suspendida)
    const onVisible = () => {
      if(document.visibilityState === 'visible') {
        if(Date.now() - lastActivityRef.current > INACTIVITY_MS) {
          handleLogout();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // Chequeo periódico como fallback (cuando la tab está activa)
    const interval=setInterval(()=>{
      setCheckTick(t=>t+1);
      if(Date.now() - lastActivityRef.current > INACTIVITY_MS) {
        handleLogout();
      }
    }, 60000);

    return ()=>{
      clearInterval(interval);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      document.removeEventListener('visibilitychange', onVisible);
    };
  },[loaded]);

  const handleLogin=(user)=>{ currentOrgId=user.orgId; setCurrentUser(user); try{localStorage.setItem("qb_user",JSON.stringify(user));}catch(e){} };
  const handleLogout=async()=>{
    try{ await supabase.auth.signOut(); }catch(e){}
    setCurrentUser(null);
    try{
      // Limpiar todo rastro de sesión local
      localStorage.removeItem("qb_user");
      localStorage.removeItem("qb_access_token");
      // La SDK de Supabase guarda la sesión bajo esta clave
      localStorage.removeItem(`sb-${SUPA_URL.split("//")[1].split(".")[0]}-auth-token`);
    }catch(e){}
  };
  const saveConfig=async(cfg)=>{
    setConfig(cfg);
    try{localStorage.setItem("quincho_config",JSON.stringify(cfg));}catch(e){}
    await supabase.from("config").upsert({id:"main",precios:cfg.precios,actualizado_en:new Date().toISOString()});
  };
  const removeUsuario = async id => { await sb.remove("usuarios", id); setUsuarios(u=>u.filter(x=>x.id!==id)); };
  const saveC =async d=>{const prev=clientes;setClientes(d);const r=await sb.upsert("clientes",d.map(mapCliente));if(!r){setClientes(prev);alert("Error al guardar cliente. Intentá de nuevo.");}};
  const saveR =async d=>{const prev=reservas;setReservas(d);const r=await sb.upsert("reservas",d.map(mapReserva));if(!r){setReservas(prev);alert("Error al guardar reserva. Intentá de nuevo.");}};
  const saveP =async d=>{const prev=pagos;setPagos(d);const r=await sb.upsert("pagos",d.map(mapPago));if(!r){setPagos(prev);alert("Error al guardar pago. Intentá de nuevo.");}};
  const saveG =async d=>{const prev=gastos;setGastos(d);const r=await sb.upsert("gastos",d.map(mapGasto));if(!r){setGastos(prev);alert("Error al guardar gasto. Intentá de nuevo.");}};
  const saveER=async d=>{const prev=extrasReserva;setExtrasReserva(d);const r=await sb.upsert("extras_reserva",d.map(mapExtra));if(!r){setExtrasReserva(prev);alert("Error al guardar extra. Intentá de nuevo.");}};
  const saveTareas=async d=>{const prev=tareas;setTareas(d);const r=await sb.upsert("tareas",d.map(mapTarea));if(!r){setTareas(prev);alert("Error al guardar tarea. Intentá de nuevo.");}};
  const saveBloqueos=async d=>{const prev=bloqueos;setBloqueos(d);const r=await sb.upsert("bloqueos",d.map(mapBloqueo));if(!r){setBloqueos(prev);alert("Error al guardar bloqueo. Intentá de nuevo.");}};
  const saveRecordatorios=async d=>{const prev=recordatorios;setRecordatorios(d);const r=await sb.upsert("recordatorios",d.map(mapRecordatorio));if(!r){setRecordatorios(prev);alert("Error al guardar recordatorio. Intentá de nuevo.");}};

  const [savingReserva,setSavingReserva]=useState(false);
  const [savingPago,setSavingPago]=useState(false);
  const handleSaveReserva=async(data)=>{
    if(savingReserva) return;
    setSavingReserva(true);
    try{
      if(!editReserva){
        // Chequeo límite de reservas del plan
        const limits = getPlanLimits(currentUser?.plan);
        if(limits.reservasMes !== null){
          const mesActual = toDateStr(new Date()).slice(0,7);
          const reservasMes = reservas.filter(r=>r.fecha?.slice(0,7)===mesActual && r.estado!=="cancelada").length;
          if(reservasMes >= limits.reservasMes){
            return alert(`Tu plan ${currentUser?.plan||"actual"} permite hasta ${limits.reservasMes} reservas por mes. Ya alcanzaste el límite de este mes.\n\nContactá al administrador para actualizar tu plan.`);
          }
        }
        const {data:dbConflicts}=await supabase.from("reservas").select("id,cliente_id,turno,turno_id,recurso_id").eq("fecha",data.fecha).eq("org_id",currentOrgId).neq("estado","cancelada");
        const conflict=dbConflicts?.find(r=>r.recurso_id===data.recursoId&&(
          data.turnoId
            ? (r.turno_id===data.turnoId)
            : (r.turno===data.turno||r.turno==="completo"||data.turno==="completo")
        ));
        if(conflict){const c=clientes.find(x=>x.id===conflict.cliente_id);return alert("Conflicto: ya existe una reserva de "+clientName(c)+" en ese espacio, día y turno.");}
        const bloqueoConflict=bloqueos.find(b=>b.fecha===data.fecha&&(b.turno===data.turno||b.turno==="completo"||data.turno==="completo"));
        if(bloqueoConflict)return alert("Fecha bloqueada: "+bloqueoConflict.motivo+". Desbloqueala primero desde el calendario.");
      }
      if(editReserva) await saveR(reservas.map(r=>r.id===editReserva.id?{...r,...data}:r));
      else await saveR([...reservas,{id:genId(),...data,creadoEn:new Date().toISOString(),fechaCreacion:toDateStr(new Date()),creadoPor:currentUser?.nombre||"",recordatorioEnviado:false,postEventoProcesado:false}]);
      setModal(null);setEditReserva(null);setInitDate(null);setInitTurno(null);
    } finally { setSavingReserva(false); }
  };
  const handleSaveCliente=(data)=>{
    if(editCliente) saveC(clientes.map(c=>c.id===editCliente.id?{...c,...data}:c));
    else saveC([...clientes,{id:genId(),...data,creadoEn:new Date().toISOString()}]);
    setModal(null);setEditCliente(null);
  };
  const handleSavePago=async(data,shouldPrint)=>{
    if(savingPago) return;
    const resCheck=reservas.find(r=>r.id===data.reservaId);
    if(resCheck&&['cancelada','finalizada'].includes(resCheck.estado)){alert("No se puede registrar un pago en una reserva "+resCheck.estado+".");return;}
    setSavingPago(true);
    try{
    const newP={id:genId(),...data,creadoEn:new Date().toISOString(),creadoPor:currentUser?.nombre||""};
    const newPagos=[...pagos,newP];
    await saveP(newPagos);
    const res=reservas.find(r=>r.id===data.reservaId);
    if(res){
      const tot=newPagos.filter(p=>p.reservaId===data.reservaId).reduce((s,p)=>s+p.monto,0);
      const totalEvento=res.montoPactado+getTotalExtras(res.id,extrasReserva);
      if(["pendiente","senada","confirmada"].includes(res.estado)){
        const newEstado=tot===0?"pendiente":tot>=totalEvento?"confirmada":"senada";
        if(newEstado!==res.estado)
          saveR(reservas.map(r=>r.id===data.reservaId?{...r,estado:newEstado}:r));
      }
    }
    if(shouldPrint){
      var res2=reservas.find(r=>r.id===data.reservaId);
      var cli=clientes.find(c=>c.id===res2?.clienteId);
      var docData=printRecibo(newP,res2,cli,negocio);
      if(cli&&cli.whatsapp){
        var negNombre=negocio?.nombreNegocio||"nuestro negocio";
        var waMsg="*Recibo de Pago - "+negNombre+"*\n\n"+
          "Cliente: "+clientName(cli)+"\n"+
          "Evento: "+fmtDate(res2?res2.fecha:"")+" · "+(res2&&res2.turno?res2.turno:"")+"\n"+
          "Monto cobrado: "+fmtCurrency(newP.monto)+"\n"+
          "Método: "+newP.metodo+"\n"+
          "Fecha del cobro: "+fmtDate(newP.fecha)+"\n\n"+
          "_Gracias por tu confianza en "+negNombre+"_ 🏠";
        docData={...docData,waPhone:cli.whatsapp,waMsg:waMsg};
      }
      setPrintData(docData);
    }
    setModal(null);setPagoReservaId(null);
    }finally{setSavingPago(false);}
  };
  const handleSaveGasto=(data)=>{saveG([...gastos,{id:genId(),...data,creadoEn:new Date().toISOString()}]);setModal(null);};
  const handleSaveExtra=(data)=>{
    const res=reservas.find(r=>r.id===data.reservaId);
    if(res&&['cancelada','finalizada'].includes(res.estado)){alert("No se puede agregar un extra a una reserva "+res.estado+".");return;}
    saveER([...extrasReserva,{id:genId(),...data,creadoEn:new Date().toISOString()}]);setModal(null);setExtraReservaId(null);
  };
  const handleDeleteReserva=async(id)=>{
    const prevReservas=reservas; const prevPagos=pagos; const prevExtras=extrasReserva;
    const {error}=await supabase.from("reservas").delete().eq("id",id);
    if(error){ alert("Error al eliminar la reserva. Intentá de nuevo."); return; }
    const [{error:ep},{error:ee}]=await Promise.all([
      supabase.from("pagos").delete().eq("reserva_id",id),
      supabase.from("extras_reserva").delete().eq("reserva_id",id),
    ]);
    if(ep||ee) console.error("Error limpiando datos asociados a reserva eliminada",ep||ee);
    setReservas(prevReservas.filter(r=>r.id!==id));
    setPagos(prevPagos.filter(p=>p.reservaId!==id));
    setExtrasReserva(prevExtras.filter(e=>e.reservaId!==id));
    setDetailReserva(null);
  };
  const handleBloquear=(date,{turno,motivo})=>{
    const conflict=reservas.find(r=>r.fecha===date&&r.estado!=="cancelada"&&(r.turno===turno||turno==="completo"||r.turno==="completo"));
    if(conflict){const c=clientes.find(x=>x.id===conflict.clienteId);return alert("No se puede bloquear: hay una reserva de "+clientName(c)+" en este turno.");}
    saveBloqueos([...bloqueos,{id:genId(),fecha:date,turno,motivo,creadoPor:currentUser?.nombre||"",creadoEn:new Date().toISOString()}]);
    setBloqueoModal(null);setDayModal(null);
  };
  const handleDesbloquear=async(bloqueoId)=>{
    await sb.remove("bloqueos", bloqueoId);
    setBloqueos(bloqueos.filter(b=>b.id!==bloqueoId));
    setBloqueoModal(null);setDayModal(null);
  };
  const handleSaveRating=(reservaId, calificacion)=>{
    saveR(reservas.map(r=>r.id===reservaId?{...r,calificacion}:r));
    setRatingQueue(q=>q.filter(r=>r.id!==reservaId));
  };
  const handleDeleteCliente=async(id)=>{
    const resIds=reservas.filter(r=>r.clienteId===id).map(r=>r.id);
    // 1. Borrar recordatorios del cliente y de sus reservas
    await supabase.from("recordatorios").delete().eq("cliente_id",id);
    if(resIds.length) await supabase.from("recordatorios").delete().in("reserva_id",resIds);
    // 2. Borrar pagos y extras de cada reserva
    for(const rid of resIds){
      await supabase.from("pagos").delete().eq("reserva_id",rid);
      await supabase.from("extras_reserva").delete().eq("reserva_id",rid);
    }
    // 3. Borrar reservas
    if(resIds.length) await supabase.from("reservas").delete().in("id",resIds);
    // 4. Borrar cliente
    const {error}=await supabase.from("clientes").delete().eq("id",id);
    if(error){ alert("Error al eliminar el cliente: "+error.message); return; }
    // 5. Actualizar estado local
    setReservas(prev=>prev.filter(r=>r.clienteId!==id));
    setPagos(prev=>prev.filter(p=>!resIds.includes(p.reservaId)));
    setExtrasReserva(prev=>prev.filter(e=>!resIds.includes(e.reservaId)));
    setRecordatorios(prev=>prev.filter(r=>r.clienteId!==id&&!resIds.includes(r.reservaId)));
    setClientes(prev=>prev.filter(c=>c.id!==id));
    setDetailCliente(null);
  };

  const PAGE_TITLES={inicio:"Inicio",reservas:"Reservas",clientes:"Clientes",gastos:"Gastos",recursos:"Espacios y Extras",reportes:"Reportes",config:"⚙️ Configuración",usuarios:"Usuarios"};

  if(loaded&&bloqueadoMotivo) return <PantallaBloqueada motivo={bloqueadoMotivo} negocio={negocio} />;
  if(loaded&&!currentUser) return <GoogleLoginScreen onLogin={handleLogin} onBlocked={(m)=>{setBloqueadoMotivo(m);setLoaded(true);}} />;
  if(!loaded) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#FDF8F3"}}>
      <style>{`@keyframes qb-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>🏠</div>
        <div style={{fontSize:20,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display', serif"}}>{negocio.nombreNegocio||"Gestión de Espacios"}</div>
        <div style={{margin:"18px auto 0",width:32,height:32,border:"3px solid #EDE0D0",borderTop:"3px solid #C4602B",borderRadius:"50%",animation:"qb-spin 0.8s linear infinite"}}></div>
        <div style={{fontSize:12,color:"#8B7355",marginTop:10}}>Cargando datos...</div>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans', sans-serif",background:"#FDF8F3",minHeight:"100vh",maxWidth:480,margin:"0 auto",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:0;height:0;}
        input,select,textarea,button{font-family:'DM Sans',sans-serif;}
        input:focus,select:focus,textarea:focus{border-color:#C4602B!important;box-shadow:0 0 0 3px rgba(196,96,43,0.12);}
      `}</style>

      {/* Banner demo */}
      {currentUser?.suscripcionEstado === "demo" && <BannerDemo diasRestantes={currentUser.diasRestantes ?? 0} />}

      {/* Top Bar */}
      <div style={{position:"sticky",top:0,background:"rgba(253,248,243,0.95)",backdropFilter:"blur(10px)",zIndex:100,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #EDE0D0"}}>
        <button onClick={()=>setSideOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,fontSize:22,color:"#1C1C1E",lineHeight:1,flexShrink:0}}>☰</button>
        {tab==="inicio" ? (
          <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
            {negocio.logoUrl
              ? <img src={negocio.logoUrl} alt="logo" style={{width:32,height:32,borderRadius:8,objectFit:"cover"}} />
              : <LogoSVG size={28} color="#C4602B" />
            }
            <div>
              <div style={{fontSize:13,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display',serif",lineHeight:1.2,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {negocio.nombreNegocio || "Mi Negocio"}
              </div>
              {negocio.ciudad && <div style={{fontSize:10,color:"#8B7355",lineHeight:1}}>{negocio.ciudad}</div>}
            </div>
          </div>
        ) : (
          <h1 style={{margin:0,fontSize:18,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display', serif",flex:1}}>{PAGE_TITLES[tab]}</h1>
        )}
        {currentUser&&(
          <div style={{position:"relative",flexShrink:0}} id="root-menu-wrap">
            <button onClick={()=>setShowRootMenu(m=>!m)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:4,fontFamily:"inherit"}}>
              {currentUser.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="" style={{width:30,height:30,borderRadius:15,objectFit:"cover"}} />
                : <div style={{width:30,height:30,borderRadius:15,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:13}}>{(currentUser.nombre?.charAt(0)||"?").toUpperCase()}</div>
              }
              <span style={{fontSize:11,color:"#5C4033",fontWeight:700,maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.nombre?.split(" ")[0]}</span>
              <span style={{fontSize:10,color:"#8B7355"}}>▾</span>
            </button>
            {showRootMenu&&(
              <div style={{position:"absolute",top:"100%",right:0,background:"#FFF",border:"1px solid #EDE0D0",borderRadius:12,boxShadow:"0 4px 20px rgba(0,0,0,0.14)",zIndex:200,minWidth:220,padding:"0",marginTop:6,overflow:"hidden"}}>
                {/* Header usuario */}
                <div style={{padding:"14px 16px",background:"#FDF8F3",borderBottom:"1px solid #EDE0D0",display:"flex",alignItems:"center",gap:10}}>
                  {currentUser.avatarUrl
                    ? <img src={currentUser.avatarUrl} alt="" style={{width:36,height:36,borderRadius:18,objectFit:"cover",flexShrink:0}} />
                    : <div style={{width:36,height:36,borderRadius:18,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:15,flexShrink:0}}>{(currentUser.nombre?.charAt(0)||"?").toUpperCase()}</div>
                  }
                  <div style={{overflow:"hidden"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser.nombre}</div>
                    <div style={{fontSize:11,color:"#8B7355",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser.email}</div>
                  </div>
                </div>
                {/* Plan */}
                <div style={{padding:"10px 16px",borderBottom:"1px solid #EDE0D0"}}>
                  <div style={{fontSize:10,color:"#8B7355",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>Suscripción</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{background:"#FEF3C7",color:"#92400E",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,textTransform:"capitalize"}}>
                      {currentUser.suscripcionEstado==="sincargo"?"Sin cargo":(currentUser.plan||"Básico")}
                    </span>
                    <span style={{fontSize:11,color:currentUser.suscripcionEstado==="activo"||currentUser.suscripcionEstado==="sincargo"?"#16A34A":"#DC2626",fontWeight:600}}>
                      {currentUser.suscripcionEstado==="activo"?"● Activa":currentUser.suscripcionEstado==="sincargo"?"● Activa":currentUser.suscripcionEstado==="demo"?"● Demo":"● Vencida"}
                    </span>
                  </div>
                </div>
                {/* Soporte WhatsApp */}
                <a href="https://wa.me/542235767784?text=Hola%2C+necesito+soporte+con+la+app+de+quincho" target="_blank" rel="noreferrer"
                  style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",color:"#16A34A",textDecoration:"none",fontSize:13,fontWeight:600,borderBottom:"1px solid #EDE0D0"}}
                  onClick={()=>setShowRootMenu(false)}>
                  💬 Contactar soporte
                </a>
                {/* Cerrar sesión */}
                <button onClick={()=>{handleLogout();setShowRootMenu(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 16px",background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:"#DC2626",fontFamily:"inherit",textAlign:"left"}}>
                  🚪 Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Views */}
      {tab==="inicio" && <InicioView reservas={reservas} clientes={clientes} pagos={pagos} extrasReserva={extrasReserva} serviciosExtras={serviciosExtras} bloqueos={bloqueos} tareas={tareas} saveTareas={saveTareas} calDate={{year:calYear,month:calMonth}} setCalDate={(fn)=>{const r=fn({year:calYear,month:calMonth});setCalYear(r.year);setCalMonth(r.month);}} onDayClick={(ds,dr,ef)=>{
  const filtro=ef||"all";
  if(filtro==="all"&&recursos.length>1){
    setEspacioPicker({date:ds,reservas:dr});
  } else {
    setDayModal({date:ds,reservas:dr,espacioFiltro:filtro});
  }
}} onReservaClick={r=>setDetailReserva(r)} onNavigate={setTab} setModal={setModal} currentUser={currentUser} saveReservas={saveR} negocio={negocio} recursos={recursos} turnosRecurso={turnosRecurso} />}
      {tab==="reservas" && <ReservasView reservas={reservas} clientes={clientes} pagos={pagos} recursos={recursos} extrasReserva={extrasReserva} onReservaClick={r=>setDetailReserva(r)} onNewReserva={()=>{setEditReserva(null);setModal("reserva");}} />}
      {tab==="clientes" && <ClientesView clientes={clientes} reservas={reservas} onClienteClick={c=>setDetailCliente(c)} onNewCliente={()=>{setEditCliente(null);setModal("cliente");}} />}
      {tab==="gastos" && <ErrorBoundary><GastosView gastos={gastos} onNewGasto={()=>setModal("gasto")} /></ErrorBoundary>}
      {tab==="recursos" && <RecursosView recursos={recursos} setRecursos={setRecursos} serviciosExtras={serviciosExtras} setServiciosExtras={setServiciosExtras} />}
      {tab==="config" && <ConfigView config={config} saveConfig={saveConfig} serviciosExtras={serviciosExtras} setServiciosExtras={setServiciosExtras} recursos={recursos} setRecursos={setRecursos} usuarios={usuarios} setUsuarios={setUsuarios} currentUser={currentUser} removeUsuario={removeUsuario} perfilesUsuarios={perfilesUsuarios} setPerfilesUsuarios={setPerfilesUsuarios} negocio={negocio} setNegocio={setNegocio} turnosRecurso={turnosRecurso} setTurnosRecurso={setTurnosRecurso} />}
      {tab==="recordatorios" && <RecordatoriosView recordatorios={recordatorios} setRecordatorios={saveRecordatorios} reservas={reservas} clientes={clientes} pagos={pagos} extrasReserva={extrasReserva} onVerCliente={c=>{setDetailCliente(c);setTab("clientes");}} onVerEvento={r=>{setDetailReserva(r);setTab("reservas");}} onNewPago={(rid)=>{setPagoReservaId(rid);setModal("pago");}} negocio={negocio} />}
      {tab==="usuarios" && <UsuariosView usuarios={usuarios} setUsuarios={setUsuarios} currentUser={currentUser} />}
      {tab==="reportes" && <ErrorBoundary><ReportesView pagos={pagos} gastos={gastos} reservas={reservas} extrasReserva={extrasReserva} serviciosExtras={serviciosExtras} clientes={clientes} negocio={negocio} turnosRecurso={turnosRecurso} /></ErrorBoundary>}

      {/* Bottom Tab Bar */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#FFF",borderTop:"1px solid #EDE0D0",display:"flex",zIndex:500,boxShadow:"0 -4px 20px rgba(0,0,0,0.07)"}}>
        {[{id:"reservas",icon:"📋",label:"Reservas"},{id:"inicio",icon:"🏠",label:"Inicio"},{id:"clientes",icon:"👥",label:"Clientes"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0 12px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
            <span style={{fontSize:22}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:t.id===tab?800:500,color:t.id===tab?"#C4602B":"#8B7355"}}>{t.label}</span>
            {t.id===tab && <div style={{width:20,height:2.5,background:"#C4602B",borderRadius:2}} />}
          </button>
        ))}
      </div>

      {/* FAB */}
      <FAB onNewPago={()=>{setPagoReservaId(null);setModal("pago");}} onNewGasto={()=>setModal("gasto")} />

      {/* Side Menu */}
      <SideMenu open={sideOpen} onClose={()=>setSideOpen(false)} onNavigate={setTab} tab={tab} currentUser={currentUser} negocio={negocio} />

      {/* Modals */}
      {modal==="reserva" && <ReservaModal reservas={reservas} onClose={()=>{setModal(null);setEditReserva(null);setInitDate(null);setInitTurno(null);}} onSave={handleSaveReserva} clientes={clientes} recursos={recursos} reserva={editReserva} initialDate={initDate} initialTurno={initTurno} config={config} saving={savingReserva} turnosRecurso={turnosRecurso} />}
      {modal==="cliente" && <ClienteModal onClose={()=>{setModal(null);setEditCliente(null);}} onSave={handleSaveCliente} cliente={editCliente} />}
      {modal==="pago" && <PagoModal onClose={()=>{setModal(null);setPagoReservaId(null);}} onSave={handleSavePago} reservas={reservas} clientes={clientes} pagos={pagos} extrasReserva={extrasReserva} initialReservaId={pagoReservaId} />}
      {modal==="gasto" && <GastoModal onClose={()=>setModal(null)} onSave={handleSaveGasto} />}
      {modal==="extra" && <ExtrasModal onClose={()=>{setModal(null);setExtraReservaId(null);}} onSave={handleSaveExtra} servicios={serviciosExtras} reservaId={extraReservaId} />}

      {/* Detail Panels */}
      {detailReserva && <ReservaDetail
        reserva={detailReserva}
        clientes={clientes}
        recursos={recursos}
        pagos={pagos}
        extrasReserva={extrasReserva}
        serviciosExtras={serviciosExtras}
        canModifyCaja={isAdmin || currentUser?.modificarCaja === true}
        onShowPDF={setPrintData}
        onClose={()=>setDetailReserva(null)}
        onEdit={(overrideData)=>{
          if(overrideData&&overrideData._fromReschedule){
            // Direct reschedule save — no modal
            saveR(reservas.map(r=>r.id===overrideData.id?overrideData:r));
            setDetailReserva({...detailReserva,...overrideData});
          } else {
            setEditReserva(detailReserva);setDetailReserva(null);setModal("reserva");
          }
        }}
        onDelete={()=>handleDeleteReserva(detailReserva.id)}
        onCancel={(isAdmin || currentUser?.modificarCaja===true) ? (withRefund)=>{
          if(withRefund){
            const hp=pagos.filter(p=>p.reservaId===detailReserva.id).reduce((s,p)=>s+p.monto,0);
            var c2=clientes.find(x=>x.id===detailReserva.clienteId);
            saveG([...gastos,{id:genId(),fecha:toDateStr(new Date()),concepto:"Devolución seña por cancelación - "+clientName(c2),monto:hp,categoria:"Otros",creadoEn:new Date().toISOString(),creadoPor:currentUser?.nombre||""}]);
          }
          saveR(reservas.map(r=>r.id===detailReserva.id?{...r,estado:"cancelada"}:r));
          setDetailReserva(null);
        } : undefined}
        onDeletePago={async(pid)=>{
          await sb.remove("pagos", pid);
          const newPagos=pagos.filter(p=>p.id!==pid);
          setPagos(newPagos);
          const res=reservas.find(r=>r.id===detailReserva.id);
          if(res){
            const tp=newPagos.filter(p=>p.reservaId===res.id).reduce((s,p)=>s+p.monto,0);
            const te=getTotalExtras(res.id,extrasReserva);
            const saldo=(res.montoPactado+te)-tp;
            const newEstado=tp===0?"pendiente":saldo<=0?"confirmada":"senada";
            if(["pendiente","senada","confirmada"].includes(res.estado))
              saveR(reservas.map(r=>r.id===res.id?{...r,estado:newEstado}:r));
          }
        }}
        onEditPago={(updatedPago)=>{
          const newPagos=pagos.map(p=>p.id===updatedPago.id?updatedPago:p);
          saveP(newPagos);
          const res=reservas.find(r=>r.id===detailReserva.id);
          if(res){
            const tp=newPagos.filter(p=>p.reservaId===res.id).reduce((s,p)=>s+p.monto,0);
            const te=getTotalExtras(res.id,extrasReserva);
            const saldo=(res.montoPactado+te)-tp;
            const newEstado=tp===0?"pendiente":saldo<=0?"confirmada":"senada";
            if(["pendiente","senada","confirmada"].includes(res.estado))
              saveR(reservas.map(r=>r.id===res.id?{...r,estado:newEstado}:r));
          }
        }}
        onNewPago={()=>{setPagoReservaId(detailReserva.id);setDetailReserva(null);setModal("pago");}}
        onNewExtra={()=>{setExtraReservaId(detailReserva.id);setDetailReserva(null);setModal("extra");}}
        negocio={negocio}
      />}
      {detailCliente && <ClienteDetail cliente={detailCliente} reservas={reservas}
        onClose={()=>setDetailCliente(null)}
        onEdit={()=>{setEditCliente(detailCliente);setDetailCliente(null);setModal("cliente");}} />}
      {currentUser && alertaActiva && <AlertaRecordatorioModal
        alerta={alertaActiva}
        clientes={clientes}
        reservas={reservas}
        onClose={()=>{setShownAlerts(s=>new Set([...s,alertaActiva.id]));setAlertaActiva(null);}}
        onVerCliente={()=>{const c=clientes.find(x=>x.id===alertaActiva.clienteId);if(c){setDetailCliente(c);setAlertaActiva(null);}}}
        onVerEvento={()=>{const r=reservas.find(x=>x.id===alertaActiva.reservaId);if(r){setDetailReserva(r);setAlertaActiva(null);}}}
        onNewPago={()=>{if(alertaActiva.reservaId){setPagoReservaId(alertaActiva.reservaId);setModal("pago");setAlertaActiva(null);}}}
        onSnooze={(hours)=>{
          const d=new Date();d.setHours(d.getHours()+hours);
          const updated=recordatorios.map(r=>r.id===alertaActiva.id?{...r,fechaAlerta:toDateStr(d),horaAlerta:String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"),estado:"Pospuesto"}:r);
          saveRecordatorios(updated);setAlertaActiva(null);
        }}
        onDone={()=>{
          saveRecordatorios(recordatorios.map(r=>r.id===alertaActiva.id?{...r,estado:"Procesado"}:r));
          setAlertaActiva(null);
        }}
        negocio={negocio}
      />}
      {currentUser && ratingQueue.length>0 && <RatingModal reserva={ratingQueue[0]} clientes={clientes} onSave={(cal)=>handleSaveRating(ratingQueue[0].id,cal)} onSnooze={()=>{const id=ratingQueue[0]?.id;if(id)setSnoozedRatings(s=>new Set([...s,id]));setRatingQueue(q=>q.filter((_,i)=>i!==0));}} />}
      {bloqueoModal && <BloqueoModal date={bloqueoModal.date} bloqueoExistente={bloqueoModal.bloqueo} onClose={()=>setBloqueoModal(null)} onBloquear={(cfg)=>handleBloquear(bloqueoModal.date,cfg)} onDesbloquear={handleDesbloquear} />}
      {printData && <PrintModal data={printData} onClose={()=>setPrintData(null)} />}
      {onboarding && <OnboardingWizard
        onFinish={async(data)=>{
          // 1. Guardar config del negocio
          const row={org_id:currentOrgId,nombre_negocio:data.negocio.nombreNegocio,ciudad:data.negocio.ciudad,direccion:data.negocio.direccion,telefono:data.negocio.telefono,logo_url:"",msg_recordatorio:MSG_REC_DEFAULT,msg_post_evento:MSG_POST_DEFAULT,recordatorio_activo:true,post_evento_activo:true};
          await supabase.from("config").upsert(row,{onConflict:"org_id"});
          setNegocio({...negocio,...data.negocio,logoUrl:""});
          // 2. Guardar espacio
          const recId=genId();
          const modoEsp=data.espacio.modo||"fijo";
          const sc=data.slotCfg||{};
          await supabase.from("recursos").insert({id:recId,nombre:data.espacio.nombre,capacidad_max:Number(data.espacio.capacidadMax)||0,modo:modoEsp,slot_hora_inicio:sc.horaInicio||"08:00",slot_hora_fin:sc.horaFin||"22:00",slot_duracion_min:Number(sc.duracion)||60,org_id:currentOrgId,creado_en:new Date().toISOString()});
          // 3. Generar turnos (manuales o slots automáticos)
          const nuevoRec={id:recId,nombre:data.espacio.nombre,capacidadMax:Number(data.espacio.capacidadMax)||0,modo:modoEsp,slotHoraInicio:sc.horaInicio||"08:00",slotHoraFin:sc.horaFin||"22:00",slotDuracionMin:Number(sc.duracion)||60,orgId:currentOrgId};
          let turnosInsert=[];
          if(modoEsp==="slot"){
            const [h1,m1]=(sc.horaInicio||"08:00").split(":").map(Number);
            const [h2,m2]=(sc.horaFin||"22:00").split(":").map(Number);
            const dur=Number(sc.duracion)||60;
            let cur=h1*60+m1, fin=h2*60+m2;
            while(cur+dur<=fin){
              const hI=String(Math.floor(cur/60)).padStart(2,"0")+":"+String(cur%60).padStart(2,"0");
              const hF=String(Math.floor((cur+dur)/60)).padStart(2,"0")+":"+String((cur+dur)%60).padStart(2,"0");
              turnosInsert.push({recurso_id:recId,org_id:currentOrgId,nombre:`${hI} – ${hF}`,icono:"📌",hora_inicio:hI,hora_fin:hF,precio_semana:Number(sc.precioSemana)||0,precio_finde:Number(sc.precioFinde)||0,activo:true});
              cur+=dur;
            }
          } else {
            turnosInsert=data.turnos.map(t=>({recurso_id:recId,org_id:currentOrgId,nombre:t.nombre,icono:t.icono||"📌",hora_inicio:t.horaInicio,hora_fin:t.horaFin,precio_semana:Number(t.precioSemana)||0,precio_finde:Number(t.precioFinde)||0,activo:true}));
          }
          let mappedTurnos=[];
          if(turnosInsert.length>0){
            const {data:td}=await supabase.from("turnos_recurso").insert(turnosInsert).select();
            mappedTurnos=(td||[]).map(x=>({id:x.id,recursoId:x.recurso_id,orgId:x.org_id,nombre:x.nombre||"",icono:x.icono||"📌",horaInicio:x.hora_inicio||"",horaFin:x.hora_fin||"",precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:true}));
          }
          setRecursos([nuevoRec]);
          setTurnosRecurso(mappedTurnos);
          setOnboarding(false);
        }}
      />}
      {espacioPicker && (
        <BottomModal title={`📅 ${fmtDate(espacioPicker.date)} — ¿Qué espacio?`} onClose={()=>setEspacioPicker(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {recursos.map(r=>(
              <button key={r.id} onClick={()=>{
                setEspacioPicker(null);
                setDayModal({date:espacioPicker.date,reservas:espacioPicker.reservas.filter(rv=>rv.recursoId===r.id),espacioFiltro:r.id});
              }} style={{padding:"14px 16px",borderRadius:10,border:"1.5px solid #EDE0D0",background:"#FFF8F5",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>🏠 {r.nombre}</div>
                  {r.capacidadMax>0&&<div style={{fontSize:11,color:"#8B7355"}}>Cap. {r.capacidadMax} personas</div>}
                </div>
                <div style={{fontSize:12,color:"#C4602B",fontWeight:700}}>
                  {espacioPicker.reservas.filter(rv=>rv.recursoId===r.id).length > 0 ? `${espacioPicker.reservas.filter(rv=>rv.recursoId===r.id).length} reserva${espacioPicker.reservas.filter(rv=>rv.recursoId===r.id).length!==1?"s":""}` : "libre"}
                </div>
              </button>
            ))}
          </div>
        </BottomModal>
      )}
      {dayModal && <DayModal
        date={dayModal.date}
        dayRes={dayModal.reservas}
        clientes={clientes}
        bloqueosDia={bloqueos.filter(b=>b.fecha===dayModal.date)}
        canBloquear={currentUser?.gestionOperativa!==false}
        onClose={()=>setDayModal(null)}
        turnosRecurso={turnosRecurso}
        espacioFiltro={dayModal.espacioFiltro||"all"}
        onNewReserva={(date,turnoIdOrKey,turnoObj)=>{
          setInitDate(date);
          setInitTurno(turnoObj ? turnoObj.id : turnoIdOrKey);
          setEditReserva(null);
          setModal("reserva");
        }}
        onReservaClick={r=>setDetailReserva(r)}
        onBloquear={(data)=>{
          if(data&&data.id){
            // Desbloquear directamente (confirmación en el modal)
            handleDesbloquear(data.id);
          } else if(data&&data.turno&&data.motivo){
            // Crear bloqueo desde formulario inline
            handleBloquear(dayModal.date, data);
            setDayModal(null);
          }
        }}
      />}
    </div>
  );
}
