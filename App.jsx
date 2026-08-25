import { useState, useEffect, useRef, useMemo, useCallback, memo, Component, Fragment, lazy, Suspense } from "react";
import { MONTHS, MONTHS_SHORT, DAYS_SHORT, STATUS, TURNOS, PAYMENT_METHODS, EXPENSE_CATS, CAT_COLORS, DEFAULT_CONFIG, PLAN_LIMITS, getPlanLimits } from "./src/lib/constants.js";
import { genId, escHtml, fmtCurrency, fmtDate, toDateStr, clientName, monthKey, getTotalExtras, getTotalPagado, getSaldo } from "./src/lib/utils.js";
import { supabase, sb, getCurrentOrgId, setCurrentOrgId, verificarLimiteServidor, mensajeErrorGuardado, getUltimoError } from "./src/lib/supabase.js";
import { mapReserva, mapCliente, mapPago, mapGasto, mapExtra, mapBloqueo, mapTarea, mapRecordatorio, mapUsuario, mapConsulta, mapMercadoProducto, mapMercadoPedido } from "./src/lib/mappers.js";
import { card, inputStyle, lbl, labelStyle } from "./src/lib/styles.js";
import { Field, Input, Select, TextArea, Btn, BottomModal, StatusBadge, TurnoBadge, Avatar } from "./src/components/ui.jsx";
import DailyBriefing, { shouldShowBriefing, markBriefingShown } from "./src/components/DailyBriefing.jsx";

const GastosViewLazy        = lazy(() => import("./src/views/GastosView.jsx"));
const ReportesViewLazy      = lazy(() => import("./src/views/ReportesView.jsx"));
const RecordatoriosViewLazy = lazy(() => import("./src/views/RecordatoriosView.jsx"));
const ClientesViewLazy      = lazy(() => import("./src/views/ClientesView.jsx"));
const ReservasViewLazy      = lazy(() => import("./src/views/ReservasView.jsx"));

// ─── VIEW LOADER (Suspense fallback) ──────────────────────
function ViewLoader() {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 0",color:"#C4602B"}}>
      <div style={{width:28,height:28,border:"3px solid #EDE0D0",borderTopColor:"#C4602B",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── DESKTOP HOOK ────────────────────────────────────────
function useIsDesktop() {
  const [is, setIs] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIs(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return is;
}

// ─── DESKTOP LEFT NAV ────────────────────────────────────
function DesktopNav({ negocio, onNavigate, tab, currentUser, onNewCobro, onNewGasto, onNewConsulta, onLogout }) {
  const isAdmin = currentUser?.rol === "Administrador";
  const limits = getPlanLimits(currentUser?.plan);
  const NAV_ITEMS = [
    { id:"inicio",        label:"Inicio",        icon:"🏠" },
    { id:"reservas",      label:"Reservas",      icon:"📋" },
    { id:"clientes",      label:"Clientes",      icon:"👥" },
    { id:"reportes",      label:"Reportes",      icon:"📊", adminOnly: true },
    { id:"gastos",        label:"Gastos",        icon:"💸" },
    ...(limits.recordatorios !== false ? [{ id:"recordatorios", label:"Recordatorios", icon:"🔔" }] : []),
    { id:"config",        label:"Configuración", icon:"⚙️" },
  ].filter(i => !i.adminOnly || isAdmin);

  return (
    <div style={{width:220,flexShrink:0,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,borderRight:"1px solid #EDE0D0",background:"#FDF8F3",overflowY:"auto"}}>
      {/* Logo / nombre */}
      <div style={{padding:"20px 18px 16px",borderBottom:"1px solid #EDE0D0"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:800,color:"#1C1C1E",lineHeight:1.2}}>
          {negocio.nombreNegocio || "App Eventos"}
        </div>
        {negocio.ciudad && <div style={{fontSize:11,color:"#8B7355",marginTop:2}}>{negocio.ciudad}</div>}
      </div>

      {/* Acciones rápidas */}
      <div style={{padding:"12px 14px",borderBottom:"1px solid #EDE0D0",display:"flex",gap:8}}>
        <button onClick={onNewCobro} style={{flex:1,padding:"7px 0",background:"#F0FDF4",border:"0.5px solid #BBF7D0",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"#16A34A",fontFamily:"inherit"}}>+ Cobro</button>
        <button onClick={onNewGasto} style={{flex:1,padding:"7px 0",background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"#DC2626",fontFamily:"inherit"}}>+ Gasto</button>
        <button onClick={onNewConsulta} style={{flex:1,padding:"7px 0",background:"#E0F2FE",border:"0.5px solid #BAE6FD",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"#0284C7",fontFamily:"inherit"}}>+ Consultas</button>
      </div>

      {/* Nav items */}
      <nav style={{flex:1,padding:"10px 10px"}}>
        {NAV_ITEMS.map(item => {
          const active = tab === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              style={{
                display:"flex",alignItems:"center",gap:10,width:"100%",
                padding:"9px 12px",marginBottom:2,
                background: active ? "#FCE8DE" : "transparent",
                border:"none",borderRadius:8,cursor:"pointer",
                fontSize:13,fontWeight: active ? 700 : 400,
                color: active ? "#C4602B" : "#1C1C1E",
                fontFamily:"inherit",textAlign:"left",
              }}>
              <span style={{fontSize:16,lineHeight:1}}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Usuario + logout */}
      {currentUser && (
        <div style={{padding:"12px 14px",borderTop:"1px solid #EDE0D0"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            {currentUser.avatarUrl
              ? <img src={currentUser.avatarUrl} alt="" style={{width:28,height:28,borderRadius:14,objectFit:"cover"}} />
              : <div style={{width:28,height:28,borderRadius:14,background:"#C4602B",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:11,fontWeight:800}}>{(currentUser.nombre?.charAt(0)||"?").toUpperCase()}</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser.nombre}</div>
              <div style={{fontSize:10,color:"#8B7355",textTransform:"capitalize"}}>{currentUser.plan || "Básico"}</div>
            </div>
          </div>
          <button onClick={()=>{ window.location.href="https://eventos.solucionesmdp.com.ar/ayuda"; }}
            style={{width:"100%",padding:"7px 0",background:"none",border:"0.5px solid #EDE0D0",borderRadius:8,cursor:"pointer",fontSize:12,color:"#C4602B",fontFamily:"inherit",fontWeight:600,marginBottom:6}}>
            📖 Ayuda
          </button>
          <button onClick={onLogout} style={{width:"100%",padding:"7px 0",background:"none",border:"0.5px solid #EDE0D0",borderRadius:8,cursor:"pointer",fontSize:12,color:"#DC2626",fontFamily:"inherit",fontWeight:600}}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

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

const DEFAULT_USUARIOS = [];
const DEFAULT_SERVICIOS = [];


// ─── TOAST GLOBAL ─────────────────────────────────────────────
// Función accesible desde cualquier componente sin prop drilling.
let _setToastGlobal = null;
function showToast(msg, type = "ok") {
  if (_setToastGlobal) _setToastGlobal({ msg, type, id: Date.now() });
}

function ToastContainer() {
  const [toast, setToast] = useState(null);
  useEffect(() => { _setToastGlobal = setToast; }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  const colors = { ok: { bg: "#16A34A", icon: "✅" }, error: { bg: "#DC2626", icon: "❌" }, warn: { bg: "#D97706", icon: "⚠️" }, info: { bg: "#2563EB", icon: "ℹ️" } };
  const c = colors[toast.type] || colors.ok;
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 99999,
      background: c.bg, color: "#FFF", padding: "10px 18px", borderRadius: 12,
      fontWeight: 700, fontSize: 13, fontFamily: "inherit",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 8,
      animation: "fadeIn 0.2s ease", maxWidth: "calc(100vw - 40px)" }}>
      <span>{c.icon}</span><span>{toast.msg}</span>
    </div>
  );
}

// ─── localStorage SAFE ────────────────────────────────────────
function lsSet(key, value) { try { localStorage.setItem(key, value); } catch(e) {} }
function lsGet(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
function lsRemove(key) { try { localStorage.removeItem(key); } catch(e) {} }




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
  "body{font-family:Arial,sans-serif;color:#1C1C1E;padding:40px;max-width:760px;margin:0 auto;font-size:14px;line-height:1.5;position:relative}" +
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
  ".sello{width:120px;height:120px;border:3px solid rgba(196,96,43,0.35);border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:12px;color:rgba(196,96,43,0.4);letter-spacing:1px;text-transform:uppercase;transform:rotate(-12deg);flex-shrink:0}" +
  ".sello-inner{border:2px solid rgba(196,96,43,0.25);border-radius:50%;width:104px;height:104px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px}" +
  ".sello-nombre{font-size:11px;line-height:1.2;max-width:80px;word-break:break-word}" +
  ".sello-linea{width:50px;height:2px;background:rgba(196,96,43,0.25);margin:2px 0}" +
  ".sello-tipo{font-size:8px;letter-spacing:2px}" +
  ".firma-con-sello{display:flex;align-items:flex-end;justify-content:space-between;margin-top:40px;border-top:1px dashed #EDE0D0;padding-top:14px;gap:10px}" +
  ".firma-cols{display:flex;justify-content:space-between;flex:1;gap:20px}" +
  ".monto-destacado{background:linear-gradient(135deg,#FDF8F3,#F5EDE4);border:2px solid #C4602B;border-radius:10px;padding:16px 20px;margin:14px 0;text-align:center}" +
  ".monto-label{font-size:11px;color:#8B7355;text-transform:uppercase;letter-spacing:1px;font-weight:700}" +
  ".monto-valor{font-size:28px;font-weight:900;color:#C4602B;margin-top:4px}" +
  ".estado-badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.5px;margin-top:6px}" +
  "@media print{body{padding:20px}.sello{print-color-adjust:exact;-webkit-print-color-adjust:exact}}";

function pRow(l,v,c){return '<div class="row"><span class="lbl">'+l+'</span><span class="val'+(c?' '+c:'')+'">' +v+'</span></div>';}
function pH2(t){return '<h2>'+t+'</h2>';}
function pDiv(c,i){return '<div class="'+c+'">'+i+'</div>';}

function pSello(negocio,tipo){
  var nombre=escHtml((negocio&&negocio.nombreNegocio)||'Mi Negocio');
  return '<div class="sello"><div class="sello-inner"><div class="sello-nombre">'+nombre+'</div><div class="sello-linea"></div><div class="sello-tipo">'+tipo+'</div></div></div>';
}
function pFirmaConSello(negocio,tipo,nombreCliente){
  var nombreNeg=escHtml((negocio&&negocio.nombreNegocio)||'Mi Negocio');
  var sello=pSello(negocio,tipo);
  return '<div class="firma-con-sello"><div class="firma-cols">'+
    '<div class="fitem"><div class="fline">Firma prestador<br><b>'+nombreNeg+'</b></div></div>'+
    '<div class="fitem"><div class="fline">Conformidad cliente<br><b>'+escHtml(nombreCliente)+'</b></div></div>'+
    '</div>'+sello+'</div>';
}
function buildDoc(title,body,negocio){
  var nombreNeg=escHtml((negocio&&negocio.nombreNegocio)||'Mi Quincho');
  var footer=pDiv('footer',nombreNeg+' · '+new Date().toLocaleDateString('es-AR'));
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
  if(reserva.tipoEvento)body+=pRow('Tipo de evento',escHtml(reserva.tipoEvento));
  if(reserva.notas)body+=pRow('Notas',escHtml(reserva.notas));
  if(resExtras.length>0){body+=pH2('Extras');resExtras.forEach(function(e){body+=pRow(escHtml(e.descripcion)+' x'+e.cantidad,fmtCurrency(e.cantidad*e.precioHistorico));});}
  body+=pH2('Resumen')+pRow('Monto pactado',fmtCurrency(reserva.montoPactado));
  if(te>0)body+=pRow('+ Extras',fmtCurrency(te));
  body+=pRow('Total',fmtCurrency(reserva.montoPactado+te))+pRow('Cobrado',fmtCurrency(tp),'pos')+'<div class="total"><span>'+(saldo>0?'Saldo pendiente':'Pagado')+'</span><span class="'+(saldo>0?'neg':'pos')+'">'+fmtCurrency(Math.abs(saldo))+'</span></div>';
  if(resPagos.length>0){body+=pH2('Cobros');resPagos.forEach(function(p){body+=pRow(fmtDate(p.fecha)+' - '+escHtml(p.metodo),'+'+fmtCurrency(p.monto),'pos');});}
  return buildDoc('Ficha '+escHtml(clientName(cliente)),body,negocio);
}

function printContrato(reserva,cliente,recurso,resExtras,resPagos,negocio){
  var te=resExtras.reduce(function(s,e){return s+(e.precioHistorico*e.cantidad);},0);
  var tp=resPagos.reduce(function(s,p){return s+p.monto;},0);
  var saldo=(reserva.montoPactado+te)-tp;
  var hoy=new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'});
  var nombreNeg=escHtml((negocio&&negocio.nombreNegocio)||'Mi Negocio');
  var tel=negocio&&negocio.telefono?escHtml(negocio.telefono):'';
  var ciudad=negocio&&negocio.ciudad?escHtml(negocio.ciudad):'Mar del Plata';

  var CSS_EXTRA=
    ".contrato-title{text-align:center;font-size:18px;font-weight:800;color:#3D2B1F;margin:24px 0 4px;letter-spacing:.5px}" +
    ".contrato-sub{text-align:center;font-size:12px;color:#8B7355;margin-bottom:24px}" +
    ".clausula{margin:14px 0 8px;font-weight:700;font-size:13px;color:#3D2B1F;border-left:3px solid #C4602B;padding-left:8px}" +
    ".condicion{font-size:12.5px;color:#333;padding:4px 0 4px 12px;border-bottom:1px dotted #EDE0D0}" +
    "";

  var hdr=pLogoHdr(negocio,'Contrato de Alquiler','<div style="font-size:11px;color:#8B7355;text-align:right">'+ciudad+'<br>'+hoy+'</div>');
  var titulo='<div class="contrato-title">CONTRATO DE ALQUILER DE ESPACIO</div><div class="contrato-sub">Ref. N° '+reserva.id.slice(-8).toUpperCase()+'</div>';

  // Partes
  var dir=negocio&&negocio.direccion?escHtml(negocio.direccion):'';
  var partes=pH2('LAS PARTES')+
    '<div class="clausula">Prestador del Servicio</div>'+
    pRow('Nombre / Razón social',nombreNeg)+(tel?pRow('Contacto',tel):'')+(dir?pRow('Dirección',dir+', '+ciudad):pRow('Ciudad',ciudad))+
    '<div class="clausula">Contratante</div>'+
    pRow('Nombre',escHtml(clientName(cliente)))+
    (cliente&&cliente.whatsapp?pRow('WhatsApp',escHtml(cliente.whatsapp)):'')+
    (cliente&&cliente.email?pRow('Email',escHtml(cliente.email)):'')+
    (cliente&&cliente.localidad?pRow('Localidad',escHtml(cliente.localidad)):'');

  // Objeto del contrato
  var evento=pH2('OBJETO DEL CONTRATO')+
    pRow('Espacio alquilado',escHtml(recurso?recurso.nombre:'—'))+
    (reserva.tipoEvento?pRow('Tipo de evento',escHtml(reserva.tipoEvento)):'')+
    pRow('Fecha del evento',fmtDate(reserva.fecha))+
    (TURNOS[reserva.turno]?pRow('Turno',escHtml(TURNOS[reserva.turno].label)):'')+
    (reserva.horario?pRow('Horario de inicio',escHtml(reserva.horario)+' hs'):'')+
    (reserva.horarioFin?pRow('Horario de finalización',escHtml(reserva.horarioFin)+' hs'):'')+
    (reserva.cantInvitados>0?pRow('Cantidad de invitados',String(reserva.cantInvitados)+' personas'):'')+
    (reserva.notas?pRow('Observaciones',escHtml(reserva.notas)):'');

  // Condiciones económicas
  var economia=pH2('CONDICIONES ECONÓMICAS')+
    pRow('Monto base del alquiler',fmtCurrency(reserva.montoPactado));
  if(resExtras.length>0){economia+='<div class="clausula">Extras contratados</div>';resExtras.forEach(function(e){economia+=pRow(escHtml(e.descripcion)+' x'+e.cantidad,fmtCurrency(e.cantidad*e.precioHistorico));});}
  if(te>0)economia+=pRow('Subtotal extras',fmtCurrency(te));
  economia+=pRow('<b>Total acordado</b>','<b>'+fmtCurrency(reserva.montoPactado+te)+'</b>');
  if(resPagos.length>0){economia+='<div class="clausula">Pagos registrados</div>';resPagos.forEach(function(p){economia+=pRow(fmtDate(p.fecha)+' — '+escHtml(p.metodo),fmtCurrency(p.monto),'pos');});}
  if(tp>0)economia+=pRow('Total cobrado a la fecha',fmtCurrency(tp),'pos');
  economia+='<div class="total"><span>'+(saldo>0?'Saldo pendiente al evento':'Estado de cuenta')+'</span><span class="'+(saldo>0?'neg':'pos')+'">'+(saldo>0?fmtCurrency(saldo):'Pagado en su totalidad')+'</span></div>';

  // Condiciones del alquiler — usa las configuradas en Config (condicionesEmail)
  var condTxt=negocio&&negocio.condicionesEmail?negocio.condicionesEmail:'';
  var condiciones=pH2('NORMAS Y CONDICIONES DEL ALQUILER')+
    (condTxt
      ? '<div style="font-size:12.5px;color:#333;line-height:1.8;white-space:pre-line;padding:4px 0">'+escHtml(condTxt)+'</div>'
      : '<div style="font-size:12px;color:#8B7355;font-style:italic">No se configuraron condiciones. Podés agregarlas desde Config → Condiciones del email.</div>'
    );

  // Aceptación
  var aceptacion='<div style="margin-top:20px;background:#FDF8F3;border:1px solid #EDE0D0;border-radius:8px;padding:14px 16px;font-size:12px;color:#5C4033;line-height:1.7">'+
    'Las partes declaran haber leído y aceptado las condiciones del presente contrato en la ciudad de '+ciudad+', el '+hoy+'.'+
    '</div>';

  var firmas=pFirmaConSello(negocio,'CONTRATO',clientName(cliente));

  var style='<style>'+PDF_CSS+CSS_EXTRA+'</style>';
  var footer=pDiv('footer',nombreNeg+' · Generado el '+new Date().toLocaleDateString('es-AR'));
  var html=style+hdr+titulo+partes+evento+economia+condiciones+aceptacion+firmas+footer;
  return {title:'Contrato '+escHtml(clientName(cliente)),html:html};
}

function printRecibo(pago,reserva,cliente,negocio,resExtras,resPagos){
  var hdr=pLogoHdr(negocio,'Comprobante de Pago','<b>N° '+pago.id.slice(-6).toUpperCase()+'</b><br>'+new Date().toLocaleDateString('es-AR'));
  var nombreNeg=escHtml((negocio&&negocio.nombreNegocio)||'Mi Negocio');
  var body=hdr;
  body+='<div class="monto-destacado"><div class="monto-label">Monto recibido</div><div class="monto-valor">'+fmtCurrency(pago.monto)+'</div><div class="estado-badge" style="background:#DCFCE7;color:#16A34A">'+escHtml(pago.metodo)+'</div></div>';
  body+=pH2('Datos del cobro')+pRow('Cliente',escHtml(clientName(cliente)));
  if(cliente&&cliente.whatsapp)body+=pRow('WhatsApp',escHtml(cliente.whatsapp));
  body+=pRow('Monto cobrado',fmtCurrency(pago.monto),'pos')+pRow('Método de pago',escHtml(pago.metodo))+pRow('Fecha del cobro',fmtDate(pago.fecha));
  if(pago.notas)body+=pRow('Referencia',escHtml(pago.notas));
  if(reserva){
    body+=pH2('Evento asociado')+pRow('Fecha del evento',fmtDate(reserva.fecha));
    if(TURNOS[reserva.turno])body+=pRow('Turno',escHtml(TURNOS[reserva.turno].label));
    if(reserva.horario)body+=pRow('Horario',escHtml(reserva.horario)+(reserva.horarioFin?' a '+escHtml(reserva.horarioFin):'')+' hs');
    if(reserva.tipoEvento)body+=pRow('Tipo de evento',escHtml(reserva.tipoEvento));
    if(reserva.cantInvitados>0)body+=pRow('Invitados',String(reserva.cantInvitados)+' personas');
  }
  var extras=resExtras||[];
  var pagos=resPagos||[];
  var te=extras.reduce(function(s,e){return s+(e.precioHistorico*e.cantidad);},0);
  var tp=pagos.reduce(function(s,p){return s+p.monto;},0);
  if(reserva){
    body+=pH2('Estado de cuenta')+pRow('Monto pactado',fmtCurrency(reserva.montoPactado));
    if(te>0){body+=pRow('+ Extras',fmtCurrency(te));extras.forEach(function(e){body+=pRow('  '+escHtml(e.descripcion)+' x'+e.cantidad,fmtCurrency(e.cantidad*e.precioHistorico));});}
    body+=pRow('Total del evento',fmtCurrency(reserva.montoPactado+te));
    body+=pRow('Total cobrado',fmtCurrency(tp),'pos');
    var saldo=(reserva.montoPactado+te)-tp;
    body+='<div class="total"><span>'+(saldo>0?'Saldo pendiente':'Cuenta saldada')+'</span><span class="'+(saldo>0?'neg':'pos')+'">'+(saldo>0?fmtCurrency(saldo):'$0')+'</span></div>';
  }
  if(pagos.length>1){body+=pH2('Historial de cobros');pagos.forEach(function(p){var esCurrent=p.id===pago.id;body+=pRow((esCurrent?'► ':'')+fmtDate(p.fecha)+' - '+escHtml(p.metodo),fmtCurrency(p.monto),'pos');});}
  body+=pFirmaConSello(negocio,'COMPROBANTE',clientName(cliente));
  return buildDoc('Recibo '+escHtml(clientName(cliente)),body,negocio);
}

function printReporte(month,year,ingresos,gastos,ganancia,catData,confirmadas,porCobrar,negocio){
  var hdr=pLogoHdr(negocio,'Reporte Financiero','<b>'+MONTHS[month]+' '+year+'</b>');
  var body=hdr+pH2('Resumen del mes')+pRow('Ingresos cobrados',fmtCurrency(ingresos),'pos')+pRow('Gastos operacionales',fmtCurrency(gastos),'neg')+'<div class="total"><span>Ganancia Neta</span><span class="'+(ganancia>=0?'pos':'neg')+'">'+fmtCurrency(Math.abs(ganancia))+'</span></div>'+pH2('Ocupacion')+pRow('Eventos activos',String(confirmadas))+pRow('Por cobrar',fmtCurrency(porCobrar),'neg');
  if(catData.length>0){body+=pH2('Gastos por categoria');catData.forEach(function(c){body+=pRow(c.name,fmtCurrency(c.value));});}
  return buildDoc('Reporte '+MONTHS[month]+' '+year,body,negocio);
}


// mappers importados desde src/lib/mappers.js


// ─── MODALS ───────────────────────────────────────────────

function getTemporadaActiva(fecha, temporadas, recursoId) {
  if(!fecha||!temporadas?.length) return null;
  const d = new Date(fecha+"T12:00:00");
  const actual = (d.getMonth()+1)*100+d.getDate();
  return temporadas.find(t=>{
    if(recursoId && t.recursoId!==recursoId) return false;
    const desde = t.mesDesde*100+t.diaDesde;
    const hasta = t.mesHasta*100+t.diaHasta;
    if(desde>hasta) return actual>=desde||actual<=hasta; // cruza año (ej: dic–mar)
    return actual>=desde&&actual<=hasta;
  }) || null;
}

function ReservaModal({ onClose, onSave, clientes, recursos, reserva, reservas, initialDate, initialTurno, config, saving, turnosRecurso, temporadasPrecio, preciosTemporada }) {
  const isEdit = !!reserva;

  const esFinde = (fecha) => {
    try { const d=new Date(fecha+"T12:00:00"); const dow=d.getDay(); return dow===0||dow===6; } catch(e){ return false; }
  };

  const getTurnosEspacio = (recursoId) =>
    (turnosRecurso||[]).filter(t=>t.recursoId===recursoId && t.activo!==false);

  const tieneTemporadas = (recursoId) => (temporadasPrecio||[]).some(t=>t.recursoId===recursoId);

  // Turnos disponibles para fecha+espacio, con precio ya resuelto (temporada o base del turno)
  const getTurnosConPrecio = (recursoId, fecha) => {
    const todos = getTurnosEspacio(recursoId);
    if(!tieneTemporadas(recursoId)) return { turnos: todos, temporada: null, sinTemporada: false };
    const tmp = getTemporadaActiva(fecha, temporadasPrecio, recursoId);
    if(!tmp) return { turnos: [], temporada: null, sinTemporada: true };
    const turnos = todos.map(t=>{
      const pt = (preciosTemporada||[]).find(p=>p.temporadaId===tmp.id && p.turnoId===t.id);
      if(!pt || pt.activo===false) return null;
      return {...t, precioSemana: pt.precioSemana, precioFinde: pt.precioFinde};
    }).filter(Boolean);
    return { turnos, temporada: tmp, sinTemporada: false };
  };

  const getPrecioFromTurnos = (turnoId, fecha, recursoId) => {
    const { turnos } = getTurnosConPrecio(recursoId, fecha);
    const t = turnos.find(x=>x.id===turnoId);
    if(!t) return "";
    return esFinde(fecha) ? (t.precioFinde||"") : (t.precioSemana||"");
  };

  // Si initialTurno es un UUID de turno custom, detectar el espacio automáticamente
  const turnoDeInitial = initialTurno ? (turnosRecurso||[]).find(t=>t.id===initialTurno) : null;
  const initRecursoId = reserva?.recursoId || turnoDeInitial?.recursoId || recursos[0]?.id || "";
  const initFecha = reserva?.fecha || initialDate || toDateStr(new Date());
  const initTurnosEspacio = getTurnosConPrecio(initRecursoId, initFecha).turnos;
  const initTurnoId = reserva?.turnoId || initialTurno || (initTurnosEspacio[0]?.id) || "";

  const getInitMonto = () => {
    if(reserva?.montoPactado) return reserva.montoPactado;
    if(initTurnoId && initTurnosEspacio.length>0) return getPrecioFromTurnos(initTurnoId, initFecha, initRecursoId);
    return "";
  };

  const getInitHorario = () => {
    if(reserva) return {horario: reserva.horario||"", horarioFin: reserva.horarioFin||""};
    const t = initTurnosEspacio.find(x=>x.id===initTurnoId);
    return t ? {horario: t.horaInicio, horarioFin: t.horaFin} : {horario:"", horarioFin:""};
  };
  const initH = getInitHorario();

  const getInitEstado = () => {
    if(reserva?.estado) return reserva.estado;
    if(reserva?.clienteId) {
      const cli = clientes.find(c=>c.id===reserva.clienteId);
      if(cli?.estadoCrm === "Potencial") return "visita";
    }
    return "pendiente";
  };

  const [f, setF] = useState({
    clienteId:    reserva?.clienteId    || "",
    recursoId:    initRecursoId,
    fecha:        initFecha,
    turnoId:      initTurnoId,
    turno:        reserva?.turno        || initialTurno || "dia",
    horario:      initH.horario,
    horarioFin:   initH.horarioFin,
    cantInvitados:reserva?.cantInvitados||(recursos.find(r=>r.id===initRecursoId)?.capacidadMax)||1,
    montoPactado: getInitMonto(),
    estado:       getInitEstado(),
    tipoEvento:   reserva?.tipoEvento   || "",
    nombreEvento: reserva?.nombreEvento || "",
    notas:        reserva?.notas        || "",
    fechaVisita:  reserva?.fechaVisita  || "",
    horaVisita:   reserva?.horaVisita   || "",
  });

  // Si initialTurno llega después del primer render (batching), sincronizar
  useEffect(() => {
    if(!initialTurno) return;
    const t = (turnosRecurso||[]).find(x=>x.id===initialTurno);
    if(!t) return;
    const precio = getPrecioFromTurnos(t.id, f.fecha, t.recursoId);
    setF(p => {
      if(p.turnoId === t.id) return p; // ya está bien, no hacer nada
      return {...p, recursoId:t.recursoId, turnoId:t.id, horario:t.horaInicio, horarioFin:t.horaFin, montoPactado:precio||p.montoPactado};
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTurno]);

  const turnosInfo = getTurnosConPrecio(f.recursoId, f.fecha);
  const turnosDelEspacio = turnosInfo.turnos;
  const usaTurnosCustom = tieneTemporadas(f.recursoId) || turnosDelEspacio.length > 0;
  const fechaSinTemporada = tieneTemporadas(f.recursoId) && turnosDelEspacio.length===0;

  const set = k => v => setF(p => {
    if(k==="clienteId") {
      const cli = clientes.find(c=>c.id===v);
      const esVisita = cli?.estadoCrm === "Potencial";
      return {...p, clienteId:v, estado: isEdit ? p.estado : (esVisita ? "visita" : "pendiente")};
    }
    if(k==="recursoId") {
      const { turnos } = getTurnosConPrecio(v, p.fecha);
      const primerTurno = turnos[0];
      const esFin = esFinde(p.fecha);
      const precio = primerTurno ? (esFin ? primerTurno.precioFinde : primerTurno.precioSemana) : "";
      const capMax = recursos.find(r=>r.id===v)?.capacidadMax || p.cantInvitados;
      return {...p, recursoId:v, turnoId:primerTurno?.id||"", horario:primerTurno?.horaInicio||"", horarioFin:primerTurno?.horaFin||"", montoPactado:precio||"", cantInvitados:capMax};
    }
    if(k==="turnoId") {
      const { turnos } = getTurnosConPrecio(p.recursoId, p.fecha);
      const t = turnos.find(x=>x.id===v);
      const esFin = esFinde(p.fecha);
      const precio = t ? (esFin ? t.precioFinde : t.precioSemana) : "";
      return {...p, turnoId:v, horario:t?.horaInicio||p.horario, horarioFin:t?.horaFin||p.horarioFin, montoPactado:precio||p.montoPactado};
    }
    if(k==="fecha") {
      const { turnos } = getTurnosConPrecio(p.recursoId, v);
      const sigueValido = turnos.find(x=>x.id===p.turnoId);
      const t = sigueValido || turnos[0];
      const precio = t ? getPrecioFromTurnos(t.id, v, p.recursoId) : "";
      return {...p, fecha:v, turnoId:t?.id||"", horario:t?.horaInicio||p.horario, horarioFin:t?.horaFin||p.horarioFin, montoPactado:t?(precio||p.montoPactado):""};
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
      <Select label="Tipo de evento" value={f.tipoEvento} onChange={set("tipoEvento")}
        options={[{value:"",label:"— Seleccionar (opcional) —"},{value:"Cumpleaños",label:"🎂 Cumpleaños"},{value:"Cumpleaños de 15",label:"👑 Cumpleaños de 15"},{value:"Casamiento",label:"💍 Casamiento"},{value:"Bautismo / Comunión",label:"⛪ Bautismo / Comunión"},{value:"Baby Shower",label:"🍼 Baby Shower"},{value:"Despedida",label:"🥳 Despedida"},{value:"Evento corporativo",label:"🏢 Evento corporativo"},{value:"Reunión familiar",label:"👨‍👩‍👧‍👦 Reunión familiar"},{value:"Otro",label:"📌 Otro"}]} />
      {f.tipoEvento && <Input label="Nombre del evento (opcional)" value={f.nombreEvento} onChange={set("nombreEvento")} placeholder={`${f.tipoEvento} de ${clientes.find(c=>c.id===f.clienteId)?.nombre||"..."}`} />}
      <Select label="Espacio" value={f.recursoId} onChange={set("recursoId")}
        options={recursos.map(r=>({value:r.id,label:r.nombre}))} />
      <Input label="Fecha del evento" type="date" value={f.fecha} onChange={set("fecha")} required />

      {/* Selector de turno: custom si hay turnos configurados, genérico si no */}
      {fechaSinTemporada ? (
        <div style={{padding:"12px 14px",background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:8,marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:18}}>📅</span>
          <span style={{fontSize:13,fontWeight:700,color:"#DC2626"}}>Esta fecha no está dentro de ninguna temporada habilitada para este espacio.</span>
        </div>
      ) : usaTurnosCustom ? (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#5C4033",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Turno</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {turnosDelEspacio.map(t=>{
              const precio = esFinde(f.fecha) ? t.precioFinde : t.precioSemana;
              const sel = f.turnoId===t.id;
              const toMinR = (s) => { if(!s) return 0; const [h,m]=(s+":0").split(":"); return Number(h)*60+Number(m||0); };
              const ocupado = !isEdit && reservas.some(r=>{
                if(r.fecha!==f.fecha || r.recursoId!==f.recursoId || r.estado==="cancelada" || r.id===(reserva?.id) || !r.turnoId) return false;
                const a=turnosRecurso.find(x=>x.id===r.turnoId), b=t;
                if(!a) return r.turnoId===t.id;
                const s1=toMinR(a.horaInicio),e1=toMinR(a.horaFin)||1440,s2=toMinR(b.horaInicio),e2=toMinR(b.horaFin)||1440;
                return s1<e2 && s2<e1;
              });
              return (
                <button key={t.id} onClick={()=>{ if(!ocupado) set("turnoId")(t.id); }}
                  disabled={ocupado}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:10,
                    border:`1.5px solid ${ocupado?"#FECACA":sel?"#C4602B":"#EDE0D0"}`,
                    background:ocupado?"#FEF2F2":sel?"#FEF3EC":"#FFF",
                    cursor:ocupado?"not-allowed":"pointer",fontFamily:"inherit",textAlign:"left",opacity:ocupado?0.75:1}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:ocupado?"#DC2626":sel?"#C4602B":"#1C1C1E"}}>{t.nombre}{ocupado?" · 🔒 Ocupado":""}</div>
                    <div style={{fontSize:11,color:"#8B7355"}}>{t.horaInicio} – {t.horaFin}</div>
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:ocupado?"#DC2626":sel?"#C4602B":"#5C4033"}}>{fmtCurrency(precio||0)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <Select label="Turno" value={f.turno} onChange={v=>setF(p=>({...p,turno:v}))}
          options={Object.entries(TURNOS).map(([k,v])=>({value:k,label:`${v.icon} ${v.label}`}))} />
      )}

      {!fechaSinTemporada && <>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Hora inicio" type="time" value={f.horario} onChange={set("horario")} />
          <Input label="Hora fin" type="time" value={f.horarioFin} onChange={set("horarioFin")} />
          {turnosDelEspacio.length <= 4 && (
            <Input label="Cant. personas" type="number" value={f.cantInvitados} onChange={set("cantInvitados")} min="1" placeholder="0" onFocus={e=>e.target.select()} />
          )}
        </div>
        <Input label="Monto pactado ($)" type="number" value={f.montoPactado} onChange={set("montoPactado")} required placeholder="0" />
        {turnosInfo.temporada && (
          <div style={{padding:"8px 12px",background:"#FFF8EC",border:"1px solid #F5C842",borderRadius:8,marginBottom:8,fontSize:12,color:"#92680A"}}>🌡️ Precios de <strong>{turnosInfo.temporada.nombre}</strong> aplicados ({esFinde(f.fecha)?"fin de semana":"semana"})</div>
        )}
      </>}
      <div style={{padding:"8px 12px",background:f.estado==="visita"?"#F5F3FF":"#F3F4F6",borderRadius:8,marginBottom:14,fontSize:12,color:f.estado==="visita"?"#7C3AED":"#6B7280"}}>
        {f.estado==="visita" ? "👁️ Estado: Visita — el cliente viene a conocer el espacio" : `🔒 Estado: ${STATUS[f.estado]?.label||"Pendiente"} — cambia automáticamente con los cobros`}
      </div>
      {f.estado==="visita" && (
        <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>📅 Fecha y hora de la visita</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Fecha visita" type="date" value={f.fechaVisita} onChange={set("fechaVisita")} />
            <Input label="Hora visita" type="time" value={f.horaVisita} onChange={set("horaVisita")} />
          </div>
        </div>
      )}
      <TextArea label="Notas" value={f.notas} onChange={set("notas")} placeholder="Detalles del evento, requerimientos especiales..." />
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn disabled={saving||fechaSinTemporada} onClick={()=>{
          if(saving) return;
          if(fechaSinTemporada) return showToast("Esta fecha no está dentro de ninguna temporada habilitada para este espacio.","warn");
          if(!f.clienteId) return showToast("Seleccioná un cliente.","warn");
          if(!f.fecha||!f.montoPactado) return showToast("Completá fecha y monto pactado.","warn");
          if(Number(f.montoPactado)<=0) return showToast("El monto pactado debe ser mayor a cero.","warn");
          if(!isEdit&&f.fecha < toDateStr(new Date())) return showToast("No podés registrar una reserva en una fecha pasada.","warn");
          if(f.estado==="visita"&&!f.fechaVisita) return showToast("Indicá la fecha de la visita.","warn");
          onSave({...f, turnoId:f.turnoId||null, montoPactado:Number(f.montoPactado), cantInvitados:Number(f.cantInvitados)||1, tipoEvento:f.tipoEvento||null, nombreEvento:f.nombreEvento||null, fechaVisita:f.fechaVisita||null, horaVisita:f.horaVisita||null});
        }}>{saving?"Guardando...":(isEdit?"Guardar cambios":"Crear reserva")}</Btn>
      </div>
    </BottomModal>
  );
}

function ClienteModal({ onClose, onSave, cliente, clientes }) {
  const [f, setF] = useState({
    nombre: cliente?.nombre||"", apellido: cliente?.apellido||"",
    whatsapp: cliente?.whatsapp||"", localidad: cliente?.localidad||"Mar del Plata",
    email: cliente?.email||"", notasInternas: cliente?.notasInternas||"",
    estadoCrm: cliente?.estadoCrm||"", origen: cliente?.origen||"",
  });
  const [dupes, setDupes] = useState(null);
  const set = k=>v=>{setF(p=>({...p,[k]:v}));setDupes(null);};
  const isNew = !cliente;
  const findDupes = (data) => {
    if(!isNew||!clientes) return [];
    const inputWa = data.whatsapp?.replace(/\D/g,"")||"";
    const inputEmail = (data.email||"").trim().toLowerCase();
    return clientes.filter(c=>{
      if(inputWa.length>=7 && (c.whatsapp||"").replace(/\D/g,"")===inputWa) return true;
      if(inputEmail && (c.email||"").trim().toLowerCase()===inputEmail) return true;
      return false;
    });
  };
  const doSave = () => onSave({...f, estadoCrm:f.estadoCrm||null, origen:f.origen||null});
  const handleSubmit = () => {
    if(!f.nombre) return showToast("El nombre es obligatorio.","warn");
    if(f.whatsapp&&(!/^[\d\s+\-().]{7,20}$/.test(f.whatsapp)||f.whatsapp.replace(/\D/g,'').length<7)) return showToast("El WhatsApp ingresado no parece válido. Ejemplo: +54 223 1234567","warn");
    if(isNew) {
      const found = findDupes(f);
      if(found.length>0) { setDupes(found); return; }
    }
    doSave();
  };
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Select label="Estado" value={f.estadoCrm} onChange={set("estadoCrm")}
          options={[{value:"",label:"— Sin definir —"},{value:"Potencial",label:"🟡 Potencial"},{value:"Cliente",label:"🟢 Cliente"}]} />
        <Select label="Origen" value={f.origen} onChange={set("origen")}
          options={[{value:"",label:"— Sin definir —"},{value:"Instagram",label:"📸 Instagram"},{value:"WhatsApp",label:"💬 WhatsApp"},{value:"Marketplace",label:"🛒 Marketplace"},{value:"Facebook",label:"📘 Facebook"},{value:"Recomendación",label:"🤝 Recomendación"},{value:"Otro",label:"📌 Otro"}]} />
      </div>
      <TextArea label="Notas internas" value={f.notasInternas} onChange={set("notasInternas")} placeholder="Comportamiento, preferencias..." rows={2} />
      {dupes && dupes.length>0 && (
        <div style={{background:"#FEF3C7",border:"1px solid #F59E0B",borderRadius:10,padding:"12px 14px",marginTop:8}}>
          <div style={{fontWeight:700,fontSize:13,color:"#92400E",marginBottom:6}}>⚠️ Ya existe un cliente similar</div>
          {dupes.map(d=>(
            <div key={d.id} style={{fontSize:12,color:"#78350F",marginBottom:4,padding:"6px 8px",background:"#FFFBEB",borderRadius:6}}>
              <span style={{fontWeight:600}}>{d.nombre} {d.apellido||""}</span>
              {d.whatsapp && <span style={{color:"#92400E"}}> · {d.whatsapp}</span>}
              {d.estadoCrm && <span style={{color:"#92400E"}}> · {d.estadoCrm}</span>}
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <Btn small variant="ghost" onClick={()=>{setDupes(null);onClose();}}>Cancelar</Btn>
            <Btn small onClick={()=>{setDupes(null);doSave();}}>Crear igual</Btn>
          </div>
        </div>
      )}
      {!dupes && (
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={handleSubmit}>{cliente?"Guardar":"Agregar cliente"}</Btn>
        </div>
      )}
    </BottomModal>
  );
}

function PagoModal({ onClose, onSave, reservas, clientes, pagos, extrasReserva, initialReservaId, recursos, turnosRecurso }) {
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
    if(file.size > 3*1024*1024) return showToast("La imagen no puede superar 3MB.","warn");
    const ALLOWED_TYPES = ["image/jpeg","image/png","image/webp","image/gif","application/pdf"];
    if(!ALLOWED_TYPES.includes(file.type)) return showToast("Solo se permiten imágenes JPG, PNG, WEBP o PDF.","warn");
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
      if(r.estado==="cancelada"||r.estado==="finalizada"||r.estado==="visita") return false;
      return getSaldo(r, extrasReserva, pagos) > 0;
    }).map(r=>{
      const c=clientes.find(x=>x.id===r.clienteId);
      const rec=(recursos||[]).find(x=>x.id===r.recursoId);
      const tc=(turnosRecurso||[]).find(x=>x.id===r.turnoId);
      const turnoLabel=tc?tc.nombre:(TURNOS[r.turno]?.label||r.turno||"");
      const saldo = getSaldo(r, extrasReserva, pagos);
      return {value:r.id, label:`${clientName(c)} · ${fmtDate(r.fecha)} · ${turnoLabel}${rec?` · ${rec.nombre}`:""} · Saldo: ${fmtCurrency(saldo)}`};
    })];

  const doSave = (print) => {
    if(!f.reservaId||!f.monto) return showToast("Seleccioná una reserva e ingresá el monto.","warn");
    if(Number(f.monto)<=0) return showToast("El monto debe ser mayor a cero.","warn");
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

function GastoModal({ onClose, onSave, gasto }) {
  const isEdit = !!gasto;
  const [f,setF] = useState(isEdit ? {fecha:gasto.fecha,concepto:gasto.concepto,monto:String(gasto.monto),categoria:gasto.categoria,metodo:gasto.metodo} : {fecha:toDateStr(new Date()),concepto:"",monto:"",categoria:"Insumos",metodo:"Efectivo"});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <BottomModal title={isEdit?"Editar Gasto":"Registrar Gasto"} onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Fecha" type="date" value={f.fecha} onChange={set("fecha")} required />
        <Select label="Categoría" value={f.categoria} onChange={set("categoria")}
          options={EXPENSE_CATS.map(c=>({value:c,label:c}))} />
      </div>
      <Input label="Concepto / descripción" value={f.concepto} onChange={set("concepto")} placeholder="Limpieza post-evento, repuestos..." required />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Monto ($)" type="number" value={f.monto} onChange={set("monto")} required placeholder="0" onFocus={e=>e.target.select()} />
        <Select label="Método de pago" value={f.metodo} onChange={set("metodo")}
          options={[{value:"Efectivo",label:"💵 Efectivo"},{value:"Transferencia",label:"🏦 Transferencia"}]} />
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{
          if(!f.concepto||!f.monto)return showToast("Completá concepto y monto.","warn");
          if(Number(f.monto)<=0)return showToast("El monto debe ser mayor a cero.","warn");
          onSave({...f,monto:Number(f.monto)});
        }}>{isEdit?"Guardar cambios":"Registrar gasto"}</Btn>
      </div>
    </BottomModal>
  );
}

const CANALES = ["Instagram","WhatsApp","Marketplace","Facebook","Otro"];
function ConsultasModal({ onClose, onSave }) {
  const [fecha,setFecha]=useState(toDateStr(new Date()));
  const [counts,setCounts]=useState({});
  const total = CANALES.reduce((s,c)=>s+(Number(counts[c])||0),0);
  return (
    <BottomModal title="Registrar Consultas" onClose={onClose}>
      <Input label="Fecha" type="date" value={fecha} onChange={setFecha} />
      <div style={{marginTop:8}}>
        {CANALES.map(c=>(
          <div key={c} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{flex:1,fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{c}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>setCounts(p=>({...p,[c]:Math.max(0,(Number(p[c])||0)-1)}))} style={{width:34,height:34,borderRadius:17,border:"1.5px solid #EDE0D0",background:"#FDF8F3",fontSize:18,cursor:"pointer",color:"#8B7355",fontFamily:"inherit"}}>−</button>
              <input type="number" min="0" value={counts[c]||""} onChange={e=>setCounts(p=>({...p,[c]:e.target.value===""?"":Number(e.target.value)}))} placeholder="0" style={{width:50,textAlign:"center",fontSize:16,fontWeight:700,border:"1.5px solid #EDE0D0",borderRadius:8,padding:"6px 4px",fontFamily:"inherit",color:"#1C1C1E"}} />
              <button onClick={()=>setCounts(p=>({...p,[c]:(Number(p[c])||0)+1}))} style={{width:34,height:34,borderRadius:17,border:"1.5px solid #C4602B",background:"#C4602B",fontSize:18,cursor:"pointer",color:"#FFF",fontFamily:"inherit"}}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",fontSize:13,color:"#8B7355",marginTop:4,marginBottom:8}}>Total: <b style={{color:"#C4602B",fontSize:16}}>{total}</b> consultas</div>
      <Btn onClick={()=>{
        if(total===0) return;
        const entries = CANALES.filter(c=>Number(counts[c])>0).map(c=>({id:genId(),fecha,canal:c,cantidad:Number(counts[c]),creadoEn:new Date().toISOString()}));
        onSave(entries);
      }}>Guardar consultas</Btn>
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
          if(!desc||!f.cantidad||!f.precioHistorico)return showToast("Completá todos los campos.","warn");
          if(Number(f.cantidad)<=0) return showToast("La cantidad debe ser mayor a cero.","warn");
          if(Number(f.precioHistorico)<=0) return showToast("El precio debe ser mayor a cero.","warn");
          onSave({reservaId,servicioId:f.servicioId!=="custom"?f.servicioId:null,descripcion:desc,cantidad:Number(f.cantidad),precioHistorico:Number(f.precioHistorico)});
        }}>Agregar Extra</Btn>
      </div>
    </BottomModal>
  );
}

// ─── DETAIL PANELS ────────────────────────────────────────

function VisitaPanel({ reserva, cliente, onConfirmVisita, onNoConcreto }) {
  const [confirmAction, setConfirmAction] = useState(null);
  const [motivo, setMotivo] = useState("");
  return (
    <div style={{background:"#F5F3FF",border:"1.5px solid #DDD6FE",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>👁️ Visita programada</div>
      {(reserva.fechaVisita || reserva.horaVisita) && (
        <div style={{fontSize:14,fontWeight:700,color:"#1C1C1E",marginBottom:10}}>
          {reserva.fechaVisita && `📅 ${fmtDate(reserva.fechaVisita)}`}{reserva.horaVisita && ` · ⏰ ${reserva.horaVisita} hs`}
        </div>
      )}
      {!confirmAction && (
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setConfirmAction("confirmar")} style={{flex:1,padding:"10px",background:"#16A34A",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            ✅ Confirmar reserva
          </button>
          <button onClick={()=>setConfirmAction("noconcreto")} style={{flex:1,padding:"10px",background:"#FEF2F2",color:"#DC2626",border:"1.5px solid #FECACA",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            ❌ No concretó
          </button>
        </div>
      )}
      {confirmAction==="confirmar" && (
        <div style={{background:"#DCFCE7",border:"1px solid #86EFAC",borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#166534",marginBottom:6}}>¿Confirmar la reserva de {clientName(cliente)}?</div>
          <div style={{fontSize:12,color:"#166534",marginBottom:10}}>La reserva pasará a Pendiente y el cliente a Cliente.</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={onConfirmVisita} style={{flex:1,padding:"8px",background:"#16A34A",color:"#FFF",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Sí, confirmar</button>
            <button onClick={()=>setConfirmAction(null)} style={{padding:"8px 12px",background:"none",border:"1px solid #86EFAC",borderRadius:6,fontSize:12,color:"#166534",cursor:"pointer",fontFamily:"inherit"}}>Volver</button>
          </div>
        </div>
      )}
      {confirmAction==="noconcreto" && (
        <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#991B1B",marginBottom:6}}>¿Marcar como no concretada?</div>
          <div style={{fontSize:12,color:"#991B1B",marginBottom:8}}>La fecha se liberará y la reserva se cancelará.</div>
          <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo (opcional): ej. muy caro, muchos invitados..." style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:"1px solid #FECACA",borderRadius:6,fontSize:12,fontFamily:"inherit",marginBottom:8,background:"#FFF"}} />
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>onNoConcreto(motivo.trim())} style={{flex:1,padding:"8px",background:"#DC2626",color:"#FFF",border:"none",borderRadius:6,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Sí, no concretó</button>
            <button onClick={()=>{setConfirmAction(null);setMotivo("");}} style={{padding:"8px 12px",background:"none",border:"1px solid #FECACA",borderRadius:6,fontSize:12,color:"#991B1B",cursor:"pointer",fontFamily:"inherit"}}>Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservaDetail({ reserva, clientes, recursos, pagos, extrasReserva, serviciosExtras, onClose, onEdit, onDelete, onCancel, onNewPago, onNewExtra, onShowPDF, onDeletePago, onEditPago, onEditProximoPago, canModifyCaja, negocio, plan, onConfirmVisita, onNoConcreto, turnosRecurso, onSaveShareConfig, logCom, comunicaciones }) {
  const [editingPago, setEditingPago] = useState(null);
  const [cancelStep, setCancelStep] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDelPagoId, setConfirmDelPagoId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [showProximoPago, setShowProximoPago] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareSections, setShareSections] = useState(reserva.shareSections || {rsvp:true,countdown:true,mensaje:true,amenities:true,wifi:true,condiciones:true,fotos_lugar:true,fotos_evento:true,como_llegar:true});
  const [shareMessage, setShareMessage] = useState(reserva.shareMessage || "");
  const [shareTheme, setShareTheme] = useState(reserva.shareTheme || "verde");
  const [shareSaving, setShareSaving] = useState(false);
  const [shareHeroUrl, setShareHeroUrl] = useState(reserva.shareHeroUrl || "");
  const [heroUploading, setHeroUploading] = useState(false);
  const [showRegaloPicker, setShowRegaloPicker] = useState(false);
  const sobreActivo = !!(reserva.sobreDigital && reserva.sobreDigital.activo);
  const REGALO_OPTIONS = [
    {value:"15% OFF en un servicio extra",emoji:"🎉"},
    {value:"20% OFF en un servicio extra",emoji:"🔥"},
    {value:"25% OFF en un servicio extra",emoji:"💥"},
  ];
  const [ppFecha, setPpFecha] = useState(reserva.proximoPagoFecha||"");
  const [ppMonto, setPpMonto] = useState(reserva.proximoPagoMonto||"");
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
        <TurnoBadge turno={reserva.turno} label={reserva.turnoId&&(turnosRecurso||[]).find(t=>t.id===reserva.turnoId)?.nombre} />
        <StatusBadge estado={reserva.estado} />
        {reserva.tipoEvento && <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:"#7C3AED",background:"#F5F3FF",border:"1px solid #DDD6FE"}}>{reserva.tipoEvento}</span>}
        {saldo>0 && <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:"#DC2626",background:"#FEF2F2",border:"1px solid #FECACA"}}>⚠️ Saldo pendiente</span>}
      </div>

      {/* Visita panel */}
      {reserva.estado==="visita" && (
        <VisitaPanel reserva={reserva} cliente={cliente} onConfirmVisita={onConfirmVisita} onNoConcreto={onNoConcreto} />
      )}

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
          {reserva.tipoEvento && <div><div style={labelStyle}>Tipo de evento</div><div style={{fontSize:14,color:"#1C1C1E"}}>🎉 {reserva.tipoEvento}</div></div>}
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
          {getPlanLimits(plan).serviciosExtras===false
            ? <span style={{fontSize:11,color:"#8B7355",fontStyle:"italic"}}>🔒 No disponible en tu plan</span>
            : <Btn small variant="secondary" onClick={onNewExtra}>+ Extra</Btn>}
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

      {/* Próximo pago acordado */}
      {canModifyCaja && reserva.estado!=="cancelada" && reserva.estado!=="finalizada" && (
        <div style={{marginBottom:12}}>
          {reserva.proximoPagoFecha && reserva.proximoPagoMonto ? (
            <div style={{background: new Date(reserva.proximoPagoFecha+"T12:00:00") < new Date() ? "#FEF2F2":"#FFF8E1",
              border:`1px solid ${new Date(reserva.proximoPagoFecha+"T12:00:00") < new Date() ? "#FECACA":"#FFD54F"}`,
              borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color: new Date(reserva.proximoPagoFecha+"T12:00:00") < new Date() ? "#DC2626":"#6D4C00"}}>
                  {new Date(reserva.proximoPagoFecha+"T12:00:00") < new Date() ? "⚠️ Pago vencido":"💰 Próximo pago acordado"}
                </div>
                <div style={{fontSize:14,fontWeight:800,color:"#1C1C1E",marginTop:2}}>{fmtCurrency(reserva.proximoPagoMonto)} · {fmtDate(reserva.proximoPagoFecha)}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setPpFecha(reserva.proximoPagoFecha);setPpMonto(reserva.proximoPagoMonto);setShowProximoPago(true);}}
                  style={{background:"#EFF6FF",border:"1px solid #93C5FD",color:"#2563EB",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>✏️</button>
                <button onClick={()=>onEditProximoPago(null,null)}
                  style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>✕</button>
              </div>
            </div>
          ) : !showProximoPago ? (
            <button onClick={()=>setShowProximoPago(true)}
              style={{width:"100%",padding:"9px",background:"none",border:"1px dashed #EDE0D0",borderRadius:10,cursor:"pointer",fontSize:12,color:"#8B7355",fontFamily:"inherit",fontWeight:600}}>
              💰 + Agregar próximo pago acordado
            </button>
          ) : null}
          {showProximoPago && (
            <div style={{background:"#FFF8E1",border:"1px solid #FFD54F",borderRadius:10,padding:"12px 14px",marginTop:4}}>
              <div style={{fontSize:12,fontWeight:700,color:"#6D4C00",marginBottom:10}}>Próximo pago acordado</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#5C4033",marginBottom:4,textTransform:"uppercase"}}>Monto</div>
                  <input type="number" value={ppMonto} onChange={e=>setPpMonto(e.target.value)} placeholder="0"
                    style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #EDE0D0",fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}} />
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#5C4033",marginBottom:4,textTransform:"uppercase"}}>Fecha</div>
                  <input type="date" value={ppFecha} onChange={e=>setPpFecha(e.target.value)}
                    style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #EDE0D0",fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}} />
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="ghost" onClick={()=>setShowProximoPago(false)}>Cancelar</Btn>
                <Btn onClick={()=>{
                  if(!ppMonto||!ppFecha) return showToast("Completá monto y fecha.","warn");
                  onEditProximoPago(ppFecha, Number(ppMonto));
                  setShowProximoPago(false);
                }}>Guardar</Btn>
              </div>
            </div>
          )}
        </div>
      )}

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
                  {p.comprobante && (
                    <a href={p.comprobante} target="_blank" rel="noreferrer" style={{display:"block",marginTop:8}}>
                      <img src={p.comprobante} alt="Comprobante" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:8,border:"1px solid #EDE0D0",display:"block"}} />
                    </a>
                  )}
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
              if(!rescheduleDate) return showToast("Seleccioná la nueva fecha.","warn");
              if(rescheduleDate===reserva.fecha) return showToast("La nueva fecha es igual a la actual.","warn");
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
        <Btn small variant="secondary" onClick={()=>onShowPDF(printContrato(reserva,cliente,recurso,resExtras,resPagos,negocio))}>📄 Contrato</Btn>
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
        {reserva.estado!=="cancelada"&&negocio?.portalActivo!==false&&getPlanLimits(plan).portal!==false&&<Btn small variant="secondary" onClick={()=>setShowSharePanel(v=>!v)}>🔗 Compartir portal</Btn>}
        {reserva.estado!=="cancelada"&&getPlanLimits(plan).portal===false&&<Btn small variant="secondary" onClick={()=>showToast("El portal de clientes está disponible en el plan Profesional o superior.","warn")} style={{opacity:0.6}}>🔒 Portal (plan superior)</Btn>}
        <Btn small variant="ghost" onClick={onClose}>Cerrar</Btn>
      </div>

      {/* Panel Evento Compartido */}
      {showSharePanel && (()=>{
        const portalUrl=reserva.editToken ? (window.location.origin+"/mi-evento/"+reserva.editToken) : (reserva.shareToken ? (window.location.origin+"/mi-evento/"+reserva.shareToken) : null);
        const shareUrl=reserva.shareToken ? (window.location.origin+"/evento/"+reserva.shareToken) : null;
        const handleGenerate=async()=>{
          setShareSaving(true);
          let token=reserva.shareToken;
          if(!token){ token=genId(); }
          let eToken=reserva.editToken;
          if(!eToken){ eToken=genId(); }
          await onSaveShareConfig({shareToken:token,editToken:eToken,shareSections:{rsvp:true,countdown:true,mensaje:false,amenities:true,wifi:true,fotos_lugar:true,fotos_evento:true},shareMessage:"",shareTheme:"verde",shareHeroUrl:null});
          setShareSaving(false);
        };
        return (
          <div style={{background:"#F0EBE3",border:"1.5px solid #E7DFD3",borderRadius:14,padding:"16px",marginTop:12}}>
            <div style={{fontWeight:800,fontSize:15,color:"#1C1C1E",marginBottom:6,display:"flex",alignItems:"center",gap:8}}>🔗 Evento Compartido</div>
            <div style={{fontSize:13,color:"#5C4033",lineHeight:1.5,marginBottom:14}}>Genera un link para el cliente. Desde ahi puede ver su reserva, armar la invitacion para sus invitados, ver confirmaciones y pedir extras.</div>

            {!reserva.shareToken ? (
              <Btn onClick={handleGenerate} disabled={shareSaving}>{shareSaving?"Generando...":"Generar link del portal"}</Btn>
            ) : (
              <>
                {/* Portal del cliente */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#5C4033",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Link para el cliente</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",padding:"10px 12px",background:"#FFF",borderRadius:10,border:"1px solid #E7DFD3"}}>
                    <span style={{flex:1,wordBreak:"break-all",fontSize:12,color:"#5C4033"}}>{portalUrl}</span>
                    <button onClick={()=>{navigator.clipboard.writeText(portalUrl).then(()=>showToast&&showToast("Link copiado","ok"));}} style={{padding:"6px 12px",background:"#C4602B",color:"#FFF",border:"none",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Copiar</button>
                  </div>
                  <button onClick={()=>{
                    const nombre = cliente ? (cliente.nombre||"").split(" ")[0] : "";
                    const msg = (nombre ? "Hola "+nombre+"! 👋" : "Hola! 👋") + "\nTe comparto el portal de tu evento en *Quincho de Bere* 🎉\n\nDesde ahi podes:\n✅ Ver los detalles de tu reserva\n📨 Armar y compartir la invitacion para tus invitados\n📸 Ver las fotos del lugar\n🎁 Agregar extras para tu evento\n\n👉 " + portalUrl + "\n\nCualquier duda me avisas!";
                    const wa = cliente?.whatsapp ? cliente.whatsapp.replace(/\D/g,"") : "";
                    window.open("https://wa.me/"+(wa||"")+"?text="+encodeURIComponent(msg),"_blank");
                    if(logCom) logCom("whatsapp","Envío portal del cliente",reserva.clienteId,reserva.id,wa);
                  }} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",marginTop:8,padding:"10px 16px",background:"#25D366",color:"#FFF",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    <span style={{fontSize:18}}>📲</span> Enviar por WhatsApp
                  </button>
                </div>

                {/* Link de invitados (referencia) */}
                <details style={{marginTop:4}}>
                  <summary style={{fontSize:11,fontWeight:700,color:"#8B7355",cursor:"pointer"}}>Ver link de invitados (referencia)</summary>
                  <div style={{padding:"8px 12px",background:"#FFF",borderRadius:10,border:"1px solid #E7DFD3",wordBreak:"break-all",fontSize:11,color:"#8B7355",marginTop:6}}>
                    {shareUrl}
                  </div>
                  <div style={{fontSize:11,color:"#A8A29E",marginTop:4}}>Este es el link que el cliente comparte con sus invitados desde su portal.</div>
                </details>

                {/* Regalito */}
                <div style={{marginTop:16,padding:14,background:"#FFF8E6",borderRadius:12,border:"1px solid #FFD54F"}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E",marginBottom:4}}>🎁 Regalito para el cliente</div>
                  {reserva.regaloDescuento ? (
                    <div>
                      <div style={{fontSize:13,color:"#5C4033",marginBottom:8,lineHeight:1.5}}>
                        Regalo activo: <strong>{reserva.regaloDescuento}</strong>
                      </div>
                      <button onClick={async()=>{
                        await onSaveShareConfig({regaloDescuento:null,regaloEnviadoEn:null});
                        showToast("Regalito eliminado","ok");
                      }} style={{padding:"6px 14px",background:"#EDE0D0",color:"#5C4033",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                        Quitar regalito
                      </button>
                    </div>
                  ) : !showRegaloPicker ? (
                    <div>
                      <div style={{fontSize:12,color:"#8B7355",marginBottom:8,lineHeight:1.5}}>Enviale un descuento sorpresa que aparece como una raspadita en su portal. Ideal para clientes que consultan extras pero no se deciden.</div>
                      <button onClick={()=>setShowRegaloPicker(true)} style={{padding:"8px 16px",background:"#C4602B",color:"#FFF",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        🎁 Enviar regalito
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{fontSize:12,color:"#5C4033",marginBottom:10}}>Elegí el regalo (válido por 72 hs):</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {REGALO_OPTIONS.map(opt=>(
                          <button key={opt.value} onClick={async()=>{
                            await onSaveShareConfig({regaloDescuento:opt.value,regaloEnviadoEn:new Date().toISOString()});
                            setShowRegaloPicker(false);
                            showToast("🎁 Regalito enviado","ok");
                          }} style={{padding:"10px 14px",background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,textAlign:"left",display:"flex",alignItems:"center",gap:8,transition:"border-color 0.15s"}}>
                            <span style={{fontSize:18}}>{opt.emoji}</span>
                            <span style={{fontWeight:600,color:"#1C1C1E"}}>{opt.value}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={()=>setShowRegaloPicker(false)} style={{marginTop:8,padding:"6px 14px",background:"none",border:"none",color:"#8B7355",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* ── SOBRE DIGITAL ── */}
                <div style={{marginTop:16,padding:14,background:"#FFF5F0",borderRadius:12,border:"1px solid #F0D4C4"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>💝 Sobre Digital</div>
                      <div style={{fontSize:11,color:"#8B7355",marginTop:2}}>Los invitados pueden colaborar y dejar mensajes</div>
                    </div>
                    <button onClick={async()=>{const next={...(reserva.sobreDigital||{activo:false,mensaje:"",alias:"",cbu:"",mpLink:"",metaNombre:"",metaMonto:0,montoJuntado:0,mostrarProgreso:false,muralActivo:true}),activo:!sobreActivo};await onSaveShareConfig({sobreDigital:next});}}
                      style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"none",background:sobreActivo?"#16A34A":"#EDE0D0",color:sobreActivo?"#FFF":"#8B7355"}}>
                      {sobreActivo?"✅ Activo":"Inactivo"}
                    </button>
                  </div>
                  {sobreActivo && <div style={{fontSize:11,color:"#8B7355",marginTop:8,lineHeight:1.5}}>El cliente configura su alias, mensaje y opciones desde su portal (Mi Evento). Vos solo habilitás la función.</div>}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </BottomModal>
  );
}

function ClienteDetail({ cliente, reservas, onClose, onEdit, onReactivar, turnosRecurso, comunicaciones }) {
  const allRes = reservas.filter(r=>r.clienteId===cliente.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const esVisitaNoConcreto = r => r.estado==="cancelada" && r.fechaVisita;
  const cr = allRes.filter(r=>!esVisitaNoConcreto(r));
  const totalMonto = cr.reduce((s,r)=>s+r.montoPactado,0);
  const avg = getClientAvg(cliente.id, reservas);
  const notas = cr.filter(r=>r.calificacion?.nota).map(r=>({...r.calificacion,fecha:r.fecha}));
  const [confirmReactivar, setConfirmReactivar] = useState(null);
  const todayStr = toDateStr(new Date());
  const ultimoEvento = cr.find(r=>r.fecha<=todayStr && r.estado==="finalizada");
  const proximoEvento = [...cr].reverse().find(r=>r.fecha>=todayStr && ["visita","pendiente","senada","confirmada"].includes(r.estado));
  const [verTodas, setVerTodas] = useState(false);
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
          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
            {cliente.estadoCrm && cliente.estadoCrm !== "Cliente" && <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:cliente.estadoCrm==="Potencial"?"#FEF9C3":"#F3F4F6",color:cliente.estadoCrm==="Potencial"?"#A16207":"#6B7280",border:`1px solid ${cliente.estadoCrm==="Potencial"?"#FDE68A":"#E5E7EB"}`}}>{cliente.estadoCrm}</span>}
            {cliente.origen && <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:"#F5F3FF",color:"#7C3AED",border:"1px solid #DDD6FE"}}>{cliente.origen}</span>}
          </div>
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div style={{...card,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display', serif"}}>{cr.length}</div>
          <div style={{fontSize:11,color:"#8B7355"}}>Reservas totales</div>
        </div>
        <div style={{...card,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display', serif"}}>{fmtCurrency(totalMonto)}</div>
          <div style={{fontSize:11,color:"#8B7355"}}>Monto acumulado</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div style={{...card,padding:"12px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:4}}>Último evento</div>
          {ultimoEvento ? (
            <>
              <div style={{fontSize:14,fontWeight:700,color:"#1C1C1E"}}>{fmtDate(ultimoEvento.fecha)}</div>
              {ultimoEvento.tipoEvento && <div style={{fontSize:11,color:"#8B7355",marginTop:2}}>{ultimoEvento.tipoEvento}</div>}
            </>
          ) : <div style={{fontSize:12,color:"#C4B49A"}}>Sin eventos pasados</div>}
        </div>
        <div style={{...card,padding:"12px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",marginBottom:4}}>Próximo evento</div>
          {proximoEvento ? (
            <>
              <div style={{fontSize:14,fontWeight:700,color:"#16A34A"}}>{fmtDate(proximoEvento.fecha)}</div>
              {proximoEvento.tipoEvento && <div style={{fontSize:11,color:"#8B7355",marginTop:2}}>{proximoEvento.tipoEvento}</div>}
            </>
          ) : <div style={{fontSize:12,color:"#C4B49A"}}>Sin reserva futura</div>}
        </div>
      </div>
      <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Historial de reservas</div>
      {(verTodas ? allRes : allRes.slice(0,4)).map(r=>{
        const esVisitaNoConcreto = r.estado==="cancelada" && r.fechaVisita;
        return (
        <div key={r.id} style={{...card,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:esVisitaNoConcreto?"3px solid #7C3AED":undefined}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{fmtDate(r.fecha)}</div>
            <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
              <TurnoBadge turno={r.turno} label={r.turnoId&&(turnosRecurso||[]).find(t=>t.id===r.turnoId)?.nombre} />
              {r.tipoEvento && <span style={{fontSize:10,fontWeight:600,color:"#7C3AED",background:"#F5F3FF",borderRadius:4,padding:"1px 6px",border:"1px solid #DDD6FE"}}>{r.tipoEvento}</span>}
            </div>
            {esVisitaNoConcreto && <div style={{fontSize:11,color:"#7C3AED",marginTop:3,fontWeight:600}}>🟣 Visitó el {fmtDate(r.fechaVisita)} — no concretó</div>}
            {esVisitaNoConcreto && r.motivoNoConcreto && <div style={{fontSize:11,color:"#6B7280",marginTop:2,fontStyle:"italic"}}>Motivo: {r.motivoNoConcreto}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            {esVisitaNoConcreto
              ? <>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,background:"#F5F3FF",color:"#7C3AED",border:"1px solid #DDD6FE"}}>Visita</span>
                  {r.fecha>=todayStr && confirmReactivar!==r.id && <button onClick={(e)=>{e.stopPropagation();setConfirmReactivar(r.id);}} style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99,background:"#DCFCE7",color:"#16A34A",border:"1px solid #BBF7D0",cursor:"pointer",fontFamily:"inherit"}}>🔄 Reactivar</button>}
                  {confirmReactivar===r.id && (
                    <div style={{display:"flex",gap:4,marginTop:2}}>
                      <button onClick={(e)=>{e.stopPropagation();onReactivar(r);setConfirmReactivar(null);}} style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:"#16A34A",color:"#FFF",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Sí, reactivar</button>
                      <button onClick={(e)=>{e.stopPropagation();setConfirmReactivar(null);}} style={{fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,background:"#F3F4F6",color:"#6B7280",border:"none",cursor:"pointer",fontFamily:"inherit"}}>No</button>
                    </div>
                  )}
                </>
              : <StatusBadge estado={r.estado} />
            }
          </div>
        </div>
        );
      })}
      {allRes.length>4 && !verTodas && (
        <button onClick={()=>setVerTodas(true)} style={{width:"100%",padding:"8px",background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,fontSize:12,fontWeight:600,color:"#C4602B",cursor:"pointer",fontFamily:"inherit",marginBottom:4}}>
          Ver todas ({allRes.length})
        </button>
      )}
      {comunicaciones && (()=>{
        const coms = comunicaciones.filter(c=>c.clienteId===cliente.id).sort((a,b)=>(b.creadoEn||"").localeCompare(a.creadoEn||""));
        if(!coms.length) return null;
        return (<>
          <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,marginTop:4}}>Historial de comunicaciones</div>
          {coms.slice(0,6).map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderBottom:"1px solid #EDE0D0"}}>
              <span style={{fontSize:18,lineHeight:"22px",flexShrink:0}}>{c.tipo==="email"?"📧":c.tipo==="whatsapp"?"💬":"🔗"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{c.asunto}</div>
                {c.destino && <div style={{fontSize:11,color:"#8B7355",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.destino}</div>}
                <div style={{fontSize:10,color:"#C4B49A",marginTop:2}}>{c.creadoEn ? new Date(c.creadoEn).toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : ""}{c.creadoPor ? ` · ${c.creadoPor}` : ""}</div>
              </div>
            </div>
          ))}
          {coms.length>6 && <div style={{fontSize:11,color:"#C4B49A",textAlign:"center",padding:"6px 0"}}>+{coms.length-6} más</div>}
        </>);
      })()}
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
          if(!monto||Number(monto)<=0) return showToast("El monto debe ser mayor a 0.","warn");
          onSave({...pago, monto:Number(monto), metodo, notas});
        }}>Guardar cambios</Btn>
      </div>
    </BottomModal>
  );
}

function DayModal({ date, dayRes, clientes, onClose, onNewReserva, onReservaClick, bloqueosDia, onBloquear, canBloquear, turnosRecurso, espacioFiltro, temporadasPrecio, preciosTemporada }) {
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

  // Conflicto por solapamiento de horario (ej: Día 11-17 bloquea Completo 11-23)
  const toMin = (t) => { if(!t) return 0; const [h,m]=(t+":0").split(":"); return Number(h)*60+Number(m||0); };
  const turnosConflictan = (idA, idB) => {
    if(idA===idB) return true;
    const a=todosLosTurnos.find(t=>t.id===idA), b=todosLosTurnos.find(t=>t.id===idB);
    if(!a||!b) return false;
    const s1=toMin(a.horaInicio),e1=toMin(a.horaFin)||1440,s2=toMin(b.horaInicio),e2=toMin(b.horaFin)||1440;
    return s1<e2 && s2<e1;
  };
  const isOccCustom = (turnoId) =>
    dayRes.some(r=>r.turnoId && turnosConflictan(r.turnoId, turnoId));

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
                  <TurnoBadge turno={r.turno} label={r.turnoId&&(turnosRecurso||[]).find(t=>t.id===r.turnoId)?.nombre} />
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
            const potencialDia = turnosDelEspacio.reduce((s,t)=>{const tmp=getTemporadaActiva(date,temporadasPrecio,t.recursoId);const pt=tmp?(preciosTemporada||[]).find(p=>p.temporadaId===tmp.id&&p.turnoId===t.id):null;return s+(pt?(esFinde?pt.precioFinde:pt.precioSemana):(esFinde?t.precioFinde:t.precioSemana));},0);
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
                const tmpActiva = getTemporadaActiva(date, temporadasPrecio, t.recursoId);
                const ptRow = tmpActiva ? (preciosTemporada||[]).find(p=>p.temporadaId===tmpActiva.id&&p.turnoId===t.id) : null;
                const precio = ptRow ? (esFinde ? ptRow.precioFinde : ptRow.precioSemana) : (esFinde ? t.precioFinde : t.precioSemana);

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
                  if(!bMotivo.trim()){showToast("El motivo es obligatorio.","warn");return;}
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
              if(!form.nombre||!form.email) return showToast("Completá nombre e email.","warn");
              if(!form.pin||form.pin.length!==4) return showToast("El PIN debe tener 4 dígitos.","warn");
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
          if(!estrellas) return showToast("Por favor seleccioná una calificación de 1 a 5 estrellas.","warn");
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
        <Btn onClick={()=>{ if(!motivo.trim()) return showToast("El motivo es obligatorio.","warn"); onBloquear({turno,motivo:motivo.trim()}); }}>
          🚫 Confirmar bloqueo
        </Btn>
      </div>
    </BottomModal>
  );
}

// ─── CALENDAR WIDGET ──────────────────────────────────────
// ─── CALENDAR WIDGET ──────────────────────────────────────

const CalendarWidget = memo(function CalendarWidget({ reservas, clientes, bloqueos, calDate, setCalDate, onDayClick, recursos, turnosRecurso }) {
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

  const reservasByDate = useMemo(()=>{
    const idx={};
    reservas.forEach(r=>{
      if(r.estado==="cancelada") return;
      if(!idx[r.fecha]) idx[r.fecha]=[];
      idx[r.fecha].push(r);
    });
    return idx;
  },[reservas]);

  const bloqueosByDate = useMemo(()=>{
    const idx={};
    bloqueos.forEach(b=>{ idx[b.fecha]=b; });
    return idx;
  },[bloqueos]);

  const getDay = (day) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return (reservasByDate[ds]||[]).filter(r=>espacioFiltro==="all"||r.recursoId===espacioFiltro);
  };
  const getBloqueo = (day) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return bloqueosByDate[ds];
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
                /* Modo turnos nombrados: chips con color por tipo de turno */
                (()=>{
                  const toMinCal=s=>{if(!s)return 0;const[h,m]=(s+":0").split(":");return Number(h)*60+Number(m||0);};
                  const getTurnoColor=(r,tc)=>{
                    if(isPast||r.estado==="finalizada") return "#9CA3AF";
                    if(r.estado==="visita") return "#7C3AED";
                    if(r.estado==="pendiente") return "#6B7280";
                    if(!tc) return TURNOS[r.turno]?.color||"#C4602B";
                    const dur=(toMinCal(tc.horaFin)||1440)-toMinCal(tc.horaInicio);
                    if(dur>=600) return "#059669";
                    return toMinCal(tc.horaInicio)<14*60?"#D97706":"#4F46E5";
                  };
                  const isCompletoCal=(r,tc)=>{
                    if(r.turno==="completo") return true;
                    if(!tc) return false;
                    return (toMinCal(tc.horaFin)||1440)-toMinCal(tc.horaInicio)>=600;
                  };
                  const allTurnos=turnosRecurso||[];
                  return dr.map((r,ri)=>{
                    const t=TURNOS[r.turno];
                    const cl=clientes&&clientes.find(x=>x.id===r.clienteId);
                    const ini=cl?(cl.nombre?cl.nombre[0].toUpperCase():"")+(cl.apellido?cl.apellido[0].toUpperCase():""):"?";
                    const tc=allTurnos.find(x=>x.id===r.turnoId);
                    const cellBg=getTurnoColor(r,tc);
                    const completo=isCompletoCal(r,tc);
                    const icono=tc?(tc.icono||"📌"):(t?t.icon:"📌");
                    const label=tc?(tc.nombre.length>7?tc.horaInicio:tc.nombre):ini;
                    return (
                      <div key={`${year}-${month}-${day}-${ri}`} style={{flex:completo?"1 1 auto":1,background:cellBg,display:"flex",alignItems:"center",gap:2,padding:"1px 3px",borderRadius:3,marginBottom:1,minHeight:completo?28:0}}>
                        <div style={{fontSize:10,lineHeight:1}}>{icono}</div>
                        <div style={{fontSize:8,fontWeight:800,color:"#FFF",lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
                      </div>
                    );
                  });
                })()
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
});

function NextEventoCard({ nextEvento, clientes, extrasReserva, pagos, onReservaClick, mercadoProductos, toggleMercadoReserva }) {
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
      {mercadoProductos && mercadoProductos.filter(p=>p.activo).length > 0 && (
        <div style={{marginBottom:8}}>
          <button onClick={(e)=>{e.stopPropagation();toggleMercadoReserva(nextEvento.id,!nextEvento.mercadoActivo);}} style={{
            background:nextEvento.mercadoActivo?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.1)",
            border:nextEvento.mercadoActivo?"2px solid rgba(255,255,255,0.6)":"2px solid rgba(255,255,255,0.2)",
            color:"#FFF",borderRadius:10,padding:"8px 14px",cursor:"pointer",
            display:"flex",alignItems:"center",gap:8,width:"100%",fontFamily:"inherit",
            transition:"all 0.2s ease",
          }}>
            <span style={{fontSize:18}}>{nextEvento.mercadoActivo?"🟢":"🛒"}</span>
            <div style={{textAlign:"left",flex:1}}>
              <div style={{fontSize:13,fontWeight:800}}>{nextEvento.mercadoActivo?"Mercado ACTIVO":"Activar Mercado"}</div>
              <div style={{fontSize:10,opacity:0.8}}>{nextEvento.mercadoActivo?"Los organizadores pueden pedir productos":"Toca para habilitar pedidos en el portal"}</div>
            </div>
            <span style={{fontSize:14,opacity:0.7}}>{nextEvento.mercadoActivo?"✓":"›"}</span>
          </button>
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

const AgendaDiaView = memo(function AgendaDiaView({ diaVista, setDiaVista, reservas, clientes, bloqueos, recursos, turnosRecurso, onDayClick, onReservaClick }) {
  const today2=toDateStr(new Date());
  const multiEspacio=recursos&&recursos.length>1;
  const espacioConTurnos=recursos?.find(r=>(turnosRecurso||[]).some(t=>t.recursoId===r.id));
  const [espacioDia,setEspacioDia]=useState(espacioConTurnos?.id||"all");
  const irDia=(delta)=>{const d=new Date(diaVista+"T12:00:00");d.setDate(d.getDate()+delta);setDiaVista(toDateStr(d));};
  const todosLosTurnos=turnosRecurso||[];
  const espacioEfectivo=espacioDia!=="all"?espacioDia:(recursos?.length===1?recursos[0]?.id:([...new Set(todosLosTurnos.map(t=>t.recursoId))].length===1?todosLosTurnos[0]?.recursoId:null));
  const turnosDia=espacioEfectivo?todosLosTurnos.filter(t=>t.recursoId===espacioEfectivo&&t.activo!==false).sort((a,b)=>(a.horaInicio||"").localeCompare(b.horaInicio||"")):[];
  const reservasDia=reservas.filter(r=>r.fecha===diaVista&&r.estado!=="cancelada"&&(espacioEfectivo?r.recursoId===espacioEfectivo:true));
  const bloqueosDia=bloqueos.filter(b=>b.fecha===diaVista);
  const hayBloqueoCompleto=bloqueosDia.some(b=>b.turno==="completo");
  const isSlotBloqueado=(turnoId)=>hayBloqueoCompleto||bloqueosDia.some(b=>b.turno===turnoId);
  const esFinde=(()=>{const d=new Date(diaVista+"T12:00:00");return d.getDay()===0||d.getDay()===6;})();
  const isPast=diaVista<today2;
  const ocupados=turnosDia.filter(t=>reservasDia.some(r=>r.turnoId===t.id)).length;
  const libres=turnosDia.filter(t=>!reservasDia.some(r=>r.turnoId===t.id)&&!isSlotBloqueado(t.id)).length;
  const potencial=turnosDia.reduce((s,t)=>s+(esFinde?t.precioFinde||0:t.precioSemana||0),0);
  const fmtDiaVista=()=>{const d=new Date(diaVista+"T12:00:00");const dias=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];const meses=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;};
  return (
    <div style={{...card,overflow:"hidden",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"linear-gradient(135deg,#C4602B,#9E4A1E)",borderRadius:"12px 12px 0 0"}}>
        <button onClick={()=>irDia(-1)} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#FFF",cursor:"pointer",padding:"4px 12px",borderRadius:8,fontSize:20,fontFamily:"inherit"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:16,fontFamily:"'Playfair Display', serif",color:"#FFF"}}>{fmtDiaVista()}</div>
          {diaVista===today2&&<div style={{fontSize:10,color:"rgba(255,255,255,0.8)",fontWeight:700,letterSpacing:1}}>HOY</div>}
        </div>
        <button onClick={()=>irDia(1)} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#FFF",cursor:"pointer",padding:"4px 12px",borderRadius:8,fontSize:20,fontFamily:"inherit"}}>›</button>
      </div>
      {multiEspacio&&(
        <div style={{padding:"8px 12px",background:"#FDF5EE",borderBottom:"1px solid #EDE0D0",display:"flex",gap:6,overflowX:"auto"}}>
          {recursos.map(r=>(
            <button key={r.id} onClick={()=>setEspacioDia(r.id)}
              style={{flexShrink:0,padding:"4px 12px",borderRadius:16,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                border:"1.5px solid "+(espacioDia===r.id?"#C4602B":"#EDE0D0"),
                background:espacioDia===r.id?"#C4602B":"#FFF",color:espacioDia===r.id?"#FFF":"#8B7355"}}>
              🏠 {r.nombre}
            </button>
          ))}
        </div>
      )}
      {turnosDia.length>0&&(
        <div style={{padding:"8px 14px",background:"#F9F6F2",borderBottom:"1px solid #EDE0D0",display:"flex",gap:14,alignItems:"center"}}>
          <span style={{fontSize:12,color:"#DC2626",fontWeight:700}}>🔴 {ocupados} ocupados</span>
          <span style={{fontSize:12,color:"#16A34A",fontWeight:700}}>✅ {libres} libres</span>
          {potencial>0&&<span style={{fontSize:12,color:"#C4602B",fontWeight:700,marginLeft:"auto"}}>💰 {fmtCurrency(potencial)}</span>}
        </div>
      )}
      <div style={{padding:"8px 12px"}}>
        {turnosDia.length===0?(
          <div style={{textAlign:"center",padding:"24px 0",color:"#B5A090",fontSize:13}}>Sin turnos configurados para este espacio</div>
        ):(
          turnosDia.map(t=>{
            const res=reservasDia.find(r=>r.turnoId===t.id);
            const bloqueado=isSlotBloqueado(t.id);
            const cli=res?clientes.find(c=>c.id===res.clienteId):null;
            const precio=esFinde?(t.precioFinde||0):(t.precioSemana||0);
            return (
              <button key={t.id}
                onClick={()=>{if(res){onReservaClick(res);}else if(!bloqueado&&!isPast){onDayClick(diaVista,reservasDia,espacioEfectivo||"all");}}}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,width:"100%",marginBottom:6,
                  border:`1px solid ${bloqueado?"#374151":res?"#FECACA":"#EDE0D0"}`,
                  background:bloqueado?"#1F2937":res?"#FEF2F2":"#FFF",
                  cursor:(res||(!bloqueado&&!isPast))?"pointer":"default",fontFamily:"inherit",textAlign:"left"}}>
                <div style={{fontSize:11,fontWeight:700,color:bloqueado?"#9CA3AF":"#8B7355",width:96,flexShrink:0}}>{t.horaInicio} – {t.horaFin}</div>
                <div style={{flex:1}}>
                  {res?<div style={{fontSize:13,fontWeight:700,color:"#DC2626"}}>{cli?clientName(cli):"🔴 Ocupado"}</div>
                    :bloqueado?<div style={{fontSize:13,color:"#6B7280"}}>🚫 Bloqueado</div>
                    :<div style={{fontSize:13,color:"#16A34A",fontWeight:600}}>✅ Disponible</div>}
                  <div style={{fontSize:10,color:bloqueado?"#6B7280":"#B5A090"}}>{t.nombre}</div>
                </div>
                {precio>0&&<div style={{fontSize:12,color:res?"#DC2626":bloqueado?"#6B7280":"#C4602B",fontWeight:700,flexShrink:0}}>{fmtCurrency(precio)}</div>}
              </button>
            );
          })
        )}
        {!isPast&&!hayBloqueoCompleto&&(
          <button onClick={()=>onDayClick(diaVista,reservasDia,espacioEfectivo||"all")}
            style={{width:"100%",padding:"10px",marginTop:4,border:"1.5px dashed #C4602B",borderRadius:8,
              background:"#FFF8F5",color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            + Nueva reserva este día
          </button>
        )}
      </div>
    </div>
  );
});

function InicioView({ reservas, clientes, pagos, extrasReserva, serviciosExtras, bloqueos, tareas, saveTareas, removeTarea, saveReservas, calDate, setCalDate, onDayClick, onReservaClick, onNavigate, setModal, currentUser, negocio, recursos, turnosRecurso, isDesktop, onOpenBriefing, mercadoProductos, mercadoPedidos, setMercadoPedidos, toggleMercadoReserva, toggleMercadoProducto }) {
  const today=toDateStr(new Date()), now=new Date();
  const monthStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const curTimeDash=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const tomorrowDate=new Date(now); tomorrowDate.setDate(tomorrowDate.getDate()+1);
  const tmStr=toDateStr(tomorrowDate);

  const monthRes=useMemo(()=>reservas.filter(r=>r.fecha&&r.fecha.startsWith(monthStr)&&r.estado!=="cancelada"),[reservas,monthStr]);
  const monthRevenue=useMemo(()=>pagos.filter(p=>p.fecha&&p.fecha.startsWith(monthStr)).reduce((s,p)=>s+p.monto,0),[pagos,monthStr]);
  const confirmadas=useMemo(()=>reservas.filter(r=>r.estado==="confirmada"||r.estado==="senada").length,[reservas]);
  const totalPorCobrar=useMemo(()=>reservas.filter(r=>r.estado!=="cancelada"&&r.estado!=="finalizada").reduce((s,r)=>s+Math.max(0,getSaldo(r,extrasReserva,pagos)),0),[reservas,extrasReserva,pagos]);
  const upcoming=useMemo(()=>reservas.filter(r=>{
    if(r.estado==="cancelada"||r.estado==="finalizada") return false;
    if(r.fecha<today) return false;
    if(r.fecha===today&&r.horarioFin&&curTimeDash>r.horarioFin) return false;
    return true;
  }).sort((a,b)=>(a.fecha+(a.horario||"00:00")).localeCompare(b.fecha+(b.horario||"00:00"))),[reservas,today,curTimeDash]);
  const tmReservas=useMemo(()=>reservas.filter(r=>r.fecha===tmStr&&(r.estado==="senada"||r.estado==="confirmada")&&!r.recordatorioEnviado),[reservas,tmStr]);

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
  const esHorarioComercial=now.getHours()>=8&&now.getHours()<21;
  const [forzarEnvio,setForzarEnvio]=useState({});
  const [incluirReview,setIncluirReview]=useState({});
  const puedeEnviar=(id)=>esHorarioComercial||forzarEnvio[id];
  const [newTarea,setNewTarea]=useState("");
  const tieneSlots=recursos?.some(r=>r.modo==="slot");
  const [vistaModo,setVistaModo]=useState(()=>{const s=lsGet("vistaModoInicio");if(s)return s;return tieneSlots?"dia":"mes";});
  const [diaVista,setDiaVista]=useState(today);

  const mercadoAbierto=useMemo(()=>reservas.some(r=>r.fecha===today&&(r.estado==="confirmada"||r.estado==="senada")&&r.mercadoActivo),[reservas,today]);
  const prevPedidosCount=useRef((mercadoPedidos||[]).length);
  useEffect(()=>{
    if(!mercadoAbierto||!setMercadoPedidos) return;
    const poll=async()=>{
      const {data}=await supabase.from("mercado_pedidos").select("*").eq("org_id",getCurrentOrgId()).order("creado_en",{ascending:false}).limit(100);
      if(data){
        const mapped=data.map(x=>({id:x.id,orgId:x.org_id,reservaId:x.reserva_id,productoNombre:x.producto_nombre,productoEmoji:x.producto_emoji,cantidad:x.cantidad,precioUnitario:x.precio_unitario,total:x.total,estado:x.estado,creadoEn:x.creado_en}));
        if(mapped.length>prevPedidosCount.current&&prevPedidosCount.current>0){
          const nuevo=mapped[0];
          showToast(`🛒 Nuevo pedido: ${nuevo.productoEmoji} ${nuevo.productoNombre} x${nuevo.cantidad}`,"ok");
        }
        prevPedidosCount.current=mapped.length;
        setMercadoPedidos(mapped);
      }
    };
    poll();
    const iv=setInterval(poll,30000);
    return ()=>clearInterval(iv);
  },[mercadoAbierto]);

  const addTarea=()=>{
    if(!newTarea.trim())return;
    const t=[...tareas,{id:genId(),fechaRegistro:today,descripcion:newTarea.trim(),estado:"pendiente"}];
    saveTareas(t.map((x,idx)=>idx===t.length-1?{...x,creadoPor:currentUser?.nombre||""}:x));setNewTarea("");
  };
  const toggleTarea=(id)=>{
    saveTareas(tareas.map(t=>t.id===id?{...t,estado:t.estado==="pendiente"?"completada":"pendiente"}:t));
  };
  const deleteTarea=(id)=>removeTarea(id);

  return (
    <div style={{padding: isDesktop ? "20px 28px 40px" : "16px 16px 100px"}}>

      {/* Botón operativa diaria */}
      {onOpenBriefing && (
        <button onClick={onOpenBriefing} style={{
          display:"flex",alignItems:"center",gap:8,width:"100%",marginBottom:14,
          background:"linear-gradient(135deg,#1C1C1E,#374151)",
          border:"none",borderRadius:12,padding:"11px 16px",cursor:"pointer",fontFamily:"inherit",
          color:"#FFF",textAlign:"left",
        }}>
          <span style={{fontSize:18}}>💡</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700}}>Operativa del día</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:1}}>Alertas, extras y recordatorios</div>
          </div>
          <span style={{fontSize:16,color:"rgba(255,255,255,0.4)"}}>›</span>
        </button>
      )}

      {isDesktop ? (
        /* ── Desktop: stats horizontales compactas arriba ── */
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          <div style={{...card,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>📅</span>
            <div><div style={{fontSize:20,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display',serif",lineHeight:1}}>{monthRes.length}</div><div style={{fontSize:11,color:"#8B7355"}}>Reservas este mes</div></div>
          </div>
          <div style={{...card,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{totalPorCobrar>0?"⚠️":"✅"}</span>
            <div><div style={{fontSize:14,fontWeight:800,color:totalPorCobrar>0?"#DC2626":"#16A34A",fontFamily:"'Playfair Display',serif",lineHeight:1.2}}>{fmtCurrency(totalPorCobrar)}</div><div style={{fontSize:11,color:"#8B7355"}}>Por cobrar</div></div>
          </div>
          <div style={{...card,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>📋</span>
            <div><div style={{fontSize:20,fontWeight:800,color:"#2563EB",fontFamily:"'Playfair Display',serif",lineHeight:1}}>{confirmadas}</div><div style={{fontSize:11,color:"#8B7355"}}>Eventos activos</div></div>
          </div>
          <div style={{...card,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>💰</span>
            <div><div style={{fontSize:14,fontWeight:800,color:"#16A34A",fontFamily:"'Playfair Display',serif",lineHeight:1.2}}>{fmtCurrency(monthRevenue)}</div><div style={{fontSize:11,color:"#8B7355"}}>Cobrado este mes</div></div>
          </div>
        </div>
      ) : (
        <>
          {/* ── Próximo Evento (mobile) ── */}
          {nextEvento ? NextEventoCard({nextEvento, clientes, extrasReserva, pagos, onReservaClick, mercadoProductos, toggleMercadoReserva}) : (
            <div style={{background:"#F9F6F2",borderRadius:14,padding:"20px 18px",marginBottom:14,border:"1.5px dashed #D4C5B5",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8}}>🗓</div>
              <div style={{fontWeight:700,fontSize:15,color:"#8B7355",marginBottom:4}}>No hay eventos próximos programados</div>
              <div style={{fontSize:13,color:"#B5A090"}}>¡Cargá uno nuevo desde la pestaña Reservas!</div>
            </div>
          )}
          {/* ── Quick buttons (mobile) ── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
            {[
              {icon:"📅",label:"Reserva",action:()=>setModal("reserva"),perm:currentUser?.gestionOperativa!==false},
              {icon:"👥",label:"Cliente",action:()=>setModal("cliente"),perm:currentUser?.gestionOperativa!==false},

              {icon:"💸",label:"Gastos",action:()=>onNavigate("gastos"),perm:currentUser?.gestionOperativa!==false},
              {icon:"🔔",label:"Alertas",action:()=>getPlanLimits(currentUser?.plan).recordatorios!==false?onNavigate("recordatorios"):showToast("Los recordatorios no están disponibles en tu plan.","warn"),perm:true},
            ].map((b,i)=>(
              <button key={i} onClick={b.perm?b.action:()=>showToast("Sin permiso.","warn")} style={{
                display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 4px",
                background:b.perm?"#FFF":"#F3F4F6",border:"1px solid #EDE0D0",borderRadius:10,
                cursor:b.perm?"pointer":"not-allowed",fontFamily:"inherit",opacity:b.perm?1:0.45,
              }}>
                <span style={{fontSize:18}}>{b.icon}</span>
                <span style={{fontSize:9,fontWeight:700,color:b.perm?"#5C4033":"#9CA3AF",textAlign:"center",lineHeight:1.1}}>{b.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Próximo Evento (desktop) ── */}
      {isDesktop && (nextEvento ? NextEventoCard({nextEvento, clientes, extrasReserva, pagos, onReservaClick, mercadoProductos, toggleMercadoReserva}) : (
        <div style={{background:"#F9F6F2",borderRadius:14,padding:"16px 18px",marginBottom:14,border:"1.5px dashed #D4C5B5",textAlign:"center"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#8B7355"}}>🗓 No hay eventos próximos programados</div>
        </div>
      ))}

      {/* ── Layout dos columnas desktop ── */}
      <div style={isDesktop ? {display:"flex",gap:20,alignItems:"flex-start"} : {}}>
      <div style={isDesktop ? {flex:"0 0 57%",minWidth:0} : {}}>

      {/* ── Calendario / Agenda ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:12,color:"#8B7355",letterSpacing:0.5,textTransform:"uppercase"}}>{vistaModo==="mes"?"Calendario":"Agenda del día"}</div>
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1.5px solid #EDE0D0"}}>
          <button onClick={()=>{setVistaModo("mes");lsSet("vistaModoInicio","mes");}}
            style={{padding:"4px 12px",fontWeight:700,fontSize:11,border:"none",cursor:"pointer",fontFamily:"inherit",background:vistaModo==="mes"?"#C4602B":"#FDF8F3",color:vistaModo==="mes"?"#FFF":"#8B7355"}}>📅 Mes</button>
          <button onClick={()=>{setVistaModo("dia");lsSet("vistaModoInicio","dia");}}
            style={{padding:"4px 12px",fontWeight:700,fontSize:11,border:"none",cursor:"pointer",fontFamily:"inherit",background:vistaModo==="dia"?"#C4602B":"#FDF8F3",color:vistaModo==="dia"?"#FFF":"#8B7355"}}>🕐 Día</button>
        </div>
      </div>
      {vistaModo==="mes"?(
        <div style={{marginBottom:16}}>
          <CalendarWidget reservas={reservas} clientes={clientes} bloqueos={bloqueos} calDate={calDate} setCalDate={setCalDate} onDayClick={onDayClick} recursos={recursos} turnosRecurso={turnosRecurso} />
        </div>
      ):(
        <AgendaDiaView diaVista={diaVista} setDiaVista={setDiaVista} reservas={reservas} clientes={clientes} bloqueos={bloqueos} recursos={recursos} turnosRecurso={turnosRecurso} onDayClick={onDayClick} onReservaClick={onReservaClick} />
      )}

      </div>{/* cierra col izquierda */}
      <div style={isDesktop ? {flex:"0 0 40%",minWidth:0,display:"flex",flexDirection:"column",gap:12} : {}}>

      {/* ── Próximas reservas ── */}
      {/* Post-event fidelization */}
      {negocio?.postEventoActivo!==false&&reservas.filter(r=>{
        const yest=new Date(now); yest.setDate(yest.getDate()-1);
        return r.fecha===toDateStr(yest)&&r.estado==="finalizada"&&!r.postEventoProcesado;
      }).map(r=>{
        const c=clientes.find(x=>x.id===r.clienteId);
        if(!c||!c.whatsapp) return null;
        const conReview = incluirReview[r.id] && negocio?.googleReviewUrl;
        const msgBase=buildPostMsg(r);
        const msg=conReview ? msgBase+`\n\n⭐ Si querés ayudarnos a crecer, te agradecería mucho que nos dejes una reseña en Google. ¡Solo un minuto! → ${negocio.googleReviewUrl}` : msgBase;
        const puede=puedeEnviar(r.id);
        return (
          <div key={r.id} style={{...card,padding:"14px 16px",marginBottom:12,border:"2px solid #F59E0B",background:"#FFFBEB"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#D97706",marginBottom:4}}>💌 Mensaje post-evento</div>
            <div style={{fontSize:13,color:"#1C1C1E",marginBottom:8}}>{clientName(c)} · {fmtDate(r.fecha)}</div>
            {negocio?.googleReviewUrl && (
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#1C1C1E",marginBottom:10,cursor:"pointer"}}>
                <input type="checkbox" checked={!!incluirReview[r.id]} onChange={e=>setIncluirReview(p=>({...p,[r.id]:e.target.checked}))} style={{width:16,height:16,accentColor:"#F59E0B",cursor:"pointer"}} />
                ⭐ Incluir link para reseña en Google
              </label>
            )}
            {!puede&&(
              <div style={{fontSize:12,color:"#92400E",background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:8,padding:"7px 10px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>⏰ Fuera de horario comercial</span>
                <button onClick={()=>setForzarEnvio(p=>({...p,[r.id]:true}))} style={{fontSize:11,fontWeight:700,color:"#C4602B",background:"none",border:"none",cursor:"pointer",padding:0}}>Enviar igual</button>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              {puede ? (
                <a href={"https://wa.me/"+c.whatsapp.replace(/\D/g,"")+"?text="+encodeURIComponent(msg)} target="_blank" rel="noreferrer"
                  onClick={()=>saveReservas(reservas.map(x=>x.id===r.id?{...x,postEventoProcesado:true}:x))}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"#25D366",color:"#FFF",textDecoration:"none",padding:"9px 12px",borderRadius:8,fontWeight:700,fontSize:13}}>
                  💬 Enviar mensaje
                </a>
              ) : (
                <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#D1FAE5",color:"#065F46",padding:"9px 12px",borderRadius:8,fontSize:13,fontWeight:600,opacity:0.6}}>
                  💬 Enviar mensaje
                </div>
              )}
              <button onClick={()=>saveReservas(reservas.map(x=>x.id===r.id?{...x,postEventoProcesado:true}:x))}
                style={{padding:"9px 14px",background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#8B7355",fontWeight:600}}>
                No enviar
              </button>
            </div>
          </div>
        );
      })}
      {negocio?.recordatorioActivo!==false&&tmReservas.length>0&&(
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
            const tc=turnosRecurso?.find(x=>x.id===r.turnoId);
            const turnoLabel=tc?tc.nombre:(TURNOS[r.turno]?.label||r.turno||"");
            const puede=puedeEnviar("rec_"+r.id);
            return (
              <div key={r.id} style={{background:"#F0FDF4",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{clientName(c)}</div>
                    <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{turnoLabel} · {r.horario||"--"} → {r.horarioFin||"--"}</div>
                    {saldo>0&&<div style={{fontSize:12,color:"#DC2626",fontWeight:700,marginTop:2}}>⚠️ Saldo: {fmtCurrency(saldo)}</div>}
                  </div>
                  <StatusBadge estado={r.estado} />
                </div>
                {!puede&&(
                  <div style={{fontSize:12,color:"#166534",background:"#DCFCE7",border:"1px solid #BBF7D0",borderRadius:8,padding:"7px 10px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>⏰ Fuera de horario comercial</span>
                    <button onClick={()=>setForzarEnvio(p=>({...p,["rec_"+r.id]:true}))} style={{fontSize:11,fontWeight:700,color:"#C4602B",background:"none",border:"none",cursor:"pointer",padding:0}}>Enviar igual</button>
                  </div>
                )}
                {c&&c.whatsapp&&(puede?(
                  <a href={"https://wa.me/"+c.whatsapp.replace(/\D/g,"")+"?text="+encodeURIComponent(buildReminderMsg(r))}
                    target="_blank" rel="noreferrer"
                    onClick={()=>saveReservas(reservas.map(x=>x.id===r.id?{...x,recordatorioEnviado:true}:x))}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#FFF",textDecoration:"none",padding:"10px 14px",borderRadius:8,fontWeight:700,fontSize:13}}>
                    💬 Enviar recordatorio
                  </a>
                ):(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:"#D1FAE5",color:"#065F46",padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:600,opacity:0.6}}>
                    💬 Enviar recordatorio
                  </div>
                ))}
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
            const st=STATUS[r.estado];
            return (
              <div key={r.id} onClick={()=>onReservaClick(r)} style={{...card,padding:"12px 14px",marginBottom:8,cursor:"pointer",background:st?.bg||"#FFF",border:`1px solid ${st?.border||"#EDE0D0"}`,borderLeft:`3px solid ${st?.color||"#C4602B"}`,borderRadius:"0 12px 12px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{clientName(c)}</div><div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{fmtDate(r.fecha)} · {TURNOS[r.turno]?.icon||"📌"} {(r.turnoId&&turnosRecurso?.find(t=>t.id===r.turnoId)?.nombre)||TURNOS[r.turno]?.label||r.turno}{r.cantInvitados>0?` · 👥 ${r.cantInvitados}`:""}</div></div>
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
        {tareas.filter(t=>t.estado==="pendiente").map(t=>{
          const waMatch=t.descripcion.match(/📱(\+?\d[\d\s-]+)/);
          const displayDesc=waMatch?t.descripcion.replace(/ 📱\+?\d[\d\s-]+/,""):t.descripcion;
          return (
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #EDE0D0"}}>
            <input type="checkbox" checked={false} onChange={()=>toggleTarea(t.id)} style={{width:16,height:16,cursor:"pointer",accentColor:"#C4602B"}} />
            <span style={{flex:1,fontSize:13,color:"#1C1C1E"}}>{displayDesc}</span>
            {waMatch&&<a href={"https://wa.me/"+waMatch[1].replace(/[\s-]/g,"")} target="_blank" rel="noopener" style={{padding:"4px 10px",background:"#25D366",color:"#FFF",borderRadius:8,fontSize:11,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap",flexShrink:0}}>💬 WhatsApp</a>}
            <span style={{fontSize:11,color:"#8B7355"}}>{fmtDate(t.fechaRegistro)}</span>
            <button onClick={()=>deleteTarea(t.id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
          </div>);
        })}
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
      </div>{/* cierra col derecha */}
      </div>{/* cierra wrapper dos columnas */}

    </div>
  );
}


function AddUsuarioForm({ usuarios, setUsuarios }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({nombre:"",email:"",rol:"Empleado"});
  const [saving, setSaving] = useState(false);
  const roles = ["Empleado","Administrador"];

  const handleSave = async () => {
    if(!form.email||!form.email.includes("@")) return showToast("El Gmail es obligatorio.","warn");
    if(!form.nombre) return showToast("El nombre es obligatorio.","warn");
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
      showToast("✅ Usuario autorizado. Podrá ingresar con su Gmail de Google.","ok");
    } catch(e) {
      showToast("Error al guardar: "+e.message,"error");
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
    supabase.auth.getSession().then(({data:{session}})=>{
      fetch(`/api/colaboradores`,{headers:{Authorization:`Bearer ${session?.access_token}`}})
        .then(r=>r.json()).then(d=>{ setColaboradores(d.colaboradores||[]); setLoading(false); });
    });
  },[orgId]);

  const handleAdd = async () => {
    if(!email.trim()) return;
    if(colaboradores.length >= maxColab){
      showToast(`Tu plan ${plan||"actual"} permite hasta ${maxColab} colaborador${maxColab!==1?"es":""}. Actualizá tu plan para agregar más.`,"warn");
      return;
    }
    setSaving(true);
    const { data:{ session } } = await supabase.auth.getSession();
    const r = await fetch('/api/colaboradores',{ method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`}, body: JSON.stringify({ email: email.trim(), nombre: nombre.trim()||email.trim() }) });
    if(!r.ok){ const d=await r.json(); showToast("Error al agregar colaborador: "+(d.error||r.status,"error")); setSaving(false); return; }
    const nuevo = { org_id: orgId, email: email.trim(), nombre: nombre.trim()||email.trim(), activo: true };
    setColaboradores(prev=>[...prev, nuevo]);
    setEmail(""); setNombre(""); setSaving(false);
  };

  const handleRemove = async (id) => {
    const { data:{ session } } = await supabase.auth.getSession();
    await fetch('/api/colaboradores',{ method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`}, body: JSON.stringify({ id }) });
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

function EspacioCard({ espacio, onDelete, onTurnosChange, onTemporadasChange }) {
  const [expanded, setExpanded] = useState(false);
  const [turnos, setTurnos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({nombre:"",horaInicio:"",horaFin:"",precioSemana:"",precioFinde:"",icono:"📌"});
  const [temporadas, setTemporadas] = useState([]);
  const [preciosTemp, setPreciosTemp] = useState([]); // {id,temporadaId,turnoId,precioSemana,precioFinde,activo}
  const [showTmpForm, setShowTmpForm] = useState(false);
  const [expandedTmpId, setExpandedTmpId] = useState(null);
  const [tmpForm, setTmpForm] = useState({nombre:"",mesDesde:"12",diaDesde:"1",mesHasta:"3",diaHasta:"31"});
  const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const ICONOS_TURNO = ["📌","☀️","🌤️","🌆","🌙","⚽","🎾","🏊","🎉","🎪","🍖","🎸","💅","🏋️","🎭","🏠"];
  const [saving, setSaving] = useState(false);
  // modo local del espacio (fijo = manual, slot = generador)
  const [modo, setModo] = useState(espacio.modo||"fijo");
  const [slotForm, setSlotForm] = useState({horaInicio: espacio.slotHoraInicio||"08:00", horaFin: espacio.slotHoraFin||"23:00", duracion: espacio.slotDuracionMin||60, intervalo: espacio.slotIntervaloMin||0, precioSemana:"", precioFinde:""});
  const [generando, setGenerando] = useState(false);
  const [calActiva, setCalActiva] = useState(espacio.calificacionActiva!==false);

  const toggleCalActiva = async () => {
    const nv=!calActiva;
    setCalActiva(nv);
    await supabase.from("recursos").update({calificacion_activa:nv}).eq("id",espacio.id);
  };

  const inpS = {padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",outline:"none"};

  const loadTurnos = async () => {
    if(loaded) return;
    const [{data:trData},{data:tmpData}] = await Promise.all([
      supabase.from("turnos_recurso").select("*").eq("recurso_id",espacio.id).eq("activo",true).order("hora_inicio"),
      supabase.from("temporadas_precio").select("*").eq("recurso_id",espacio.id).order("mes_desde"),
    ]);
    setTurnos(trData||[]);
    const mappedTmp=(tmpData||[]).map(x=>({id:x.id,nombre:x.nombre||"Temporada",mesDesde:x.mes_desde,diaDesde:x.dia_desde,mesHasta:x.mes_hasta,diaHasta:x.dia_hasta}));
    setTemporadas(mappedTmp);
    if(tmpData?.length){
      const {data:ptData}=await supabase.from("precios_temporada").select("*").in("temporada_id",tmpData.map(t=>t.id));
      setPreciosTemp((ptData||[]).map(x=>({id:x.id,temporadaId:x.temporada_id,turnoId:x.turno_id,precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:x.activo!==false})));
    }
    setLoaded(true);
  };

  const handleAddTemporada = async () => {
    if(!tmpForm.nombre||!tmpForm.mesDesde||!tmpForm.mesHasta) return showToast("Completá nombre y meses.","warn");
    // RPC atómica: inserta temporada + precios en una sola transacción DB
    // Si falla cualquiera de los dos, ninguno queda guardado
    const precios = turnos.map(t=>({turno_id:t.id,precio_semana:t.precio_semana||0,precio_finde:t.precio_finde||0}));
    const {data,error}=await supabase.rpc("crear_temporada_con_precios",{
      p_org_id:getCurrentOrgId(),
      p_recurso_id:espacio.id,
      p_nombre:tmpForm.nombre.trim(),
      p_mes_desde:Number(tmpForm.mesDesde),
      p_dia_desde:Number(tmpForm.diaDesde)||1,
      p_mes_hasta:Number(tmpForm.mesHasta),
      p_dia_hasta:Number(tmpForm.diaHasta)||28,
      p_precios:precios,
    });
    if(error){showToast("Error al guardar temporada: "+error.message,"error");return;}
    const tmp=data.temporada;
    const mapped={id:tmp.id,nombre:tmp.nombre,mesDesde:tmp.mes_desde,diaDesde:tmp.dia_desde,mesHasta:tmp.mes_hasta,diaHasta:tmp.dia_hasta};
    const mappedPt=(data.precios||[]).map(x=>({id:x.id,temporadaId:x.temporada_id,turnoId:x.turno_id,precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:true}));
    const nextPt=[...preciosTemp,...mappedPt];
    const next=[...temporadas,mapped];
    setPreciosTemp(nextPt);
    setTemporadas(next);
    setExpandedTmpId(tmp.id);
    setShowTmpForm(false);
    setTmpForm({nombre:"",mesDesde:"12",diaDesde:"1",mesHasta:"3",diaHasta:"31"});
    if(onTemporadasChange) onTemporadasChange(espacio.id,next.map(t=>({...t,recursoId:espacio.id})),nextPt);
  };

  const handleRemoveTemporada = async (id) => {
    await supabase.from("temporadas_precio").delete().eq("id",id);
    const nextT=temporadas.filter(t=>t.id!==id);
    const nextPt=preciosTemp.filter(p=>p.temporadaId!==id);
    setTemporadas(nextT);
    setPreciosTemp(nextPt);
    if(expandedTmpId===id) setExpandedTmpId(null);
    if(onTemporadasChange) onTemporadasChange(espacio.id,nextT.map(t=>({...t,recursoId:espacio.id})),nextPt);
  };

  const handlePrecioChange = async (temporadaId, turnoId, field, value) => {
    const existing = preciosTemp.find(p=>p.temporadaId===temporadaId&&p.turnoId===turnoId);
    if(existing){
      const updated={...existing,[field]:field==="activo"?value:Number(value)||0};
      const {error}=await supabase.from("precios_temporada").update({precio_semana:updated.precioSemana,precio_finde:updated.precioFinde,activo:updated.activo}).eq("id",existing.id);
      if(error){showToast("Error al guardar precio","error");return;}
      const next=preciosTemp.map(p=>p.id===existing.id?updated:p);
      setPreciosTemp(next);
      if(onTemporadasChange) onTemporadasChange(espacio.id,temporadas.map(t=>({...t,recursoId:espacio.id})),next);
      if(field!=="activo") showToast("Precio guardado","ok");
    } else {
      // No había fila para este turno+temporada (ej: turno creado después de la temporada) → la creamos
      const base={precioSemana:0,precioFinde:0,activo:true,[field]:field==="activo"?value:Number(value)||0};
      const {data,error}=await supabase.from("precios_temporada").insert({org_id:getCurrentOrgId(),temporada_id:temporadaId,turno_id:turnoId,precio_semana:base.precioSemana,precio_finde:base.precioFinde,activo:base.activo}).select().single();
      if(error){showToast("Error al guardar precio: "+error.message,"error");return;}
      const mapped={id:data.id,temporadaId:data.temporada_id,turnoId:data.turno_id,precioSemana:Number(data.precio_semana)||0,precioFinde:Number(data.precio_finde)||0,activo:data.activo!==false};
      const next=[...preciosTemp,mapped];
      setPreciosTemp(next);
      if(onTemporadasChange) onTemporadasChange(espacio.id,temporadas.map(t=>({...t,recursoId:espacio.id})),next);
      if(field!=="activo") showToast("Precio guardado","ok");
    }
  };

  const handleExpand = () => {
    setExpanded(e=>!e);
    if(!loaded) loadTurnos();
  };

  const handleAddTurno = async () => {
    if(!form.nombre||!form.horaInicio||!form.horaFin) return showToast("Completá nombre, hora inicio y hora fin.","warn");
    setSaving(true);
    const nuevo = {recurso_id:espacio.id,org_id:getCurrentOrgId(),nombre:form.nombre.trim(),icono:form.icono||"📌",hora_inicio:form.horaInicio,hora_fin:form.horaFin,precio_semana:Number(form.precioSemana)||0,precio_finde:Number(form.precioFinde)||0,activo:true};
    const {data,error} = await supabase.from("turnos_recurso").insert(nuevo).select().single();
    if(error){showToast("Error: "+error.message,"error");setSaving(false);return;}
    const mapX=x=>({id:x.id,recursoId:x.recurso_id||x.recursoId,orgId:x.org_id||x.orgId,nombre:x.nombre||"",icono:x.icono||"📌",horaInicio:x.hora_inicio||x.horaInicio||"",horaFin:x.hora_fin||x.horaFin||"",precioSemana:Number(x.precio_semana||x.precioSemana)||0,precioFinde:Number(x.precio_finde||x.precioFinde)||0,activo:true});
    setTurnos(prev=>{const n=[...prev,data];if(onTurnosChange)onTurnosChange(espacio.id,n.map(mapX));return n;});
    // Si ya hay temporadas configuradas, crear también el precio de este turno para cada una (default: precio base)
    if(temporadas.length){
      const filas=temporadas.map(tmp=>({org_id:getCurrentOrgId(),temporada_id:tmp.id,turno_id:data.id,precio_semana:data.precio_semana||0,precio_finde:data.precio_finde||0,activo:true}));
      const {data:ptData}=await supabase.from("precios_temporada").insert(filas).select();
      if(ptData?.length){
        const mappedPt=ptData.map(x=>({id:x.id,temporadaId:x.temporada_id,turnoId:x.turno_id,precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:true}));
        const nextPt=[...preciosTemp,...mappedPt];
        setPreciosTemp(nextPt);
        if(onTemporadasChange) onTemporadasChange(espacio.id,temporadas.map(t=>({...t,recursoId:espacio.id})),nextPt);
      }
    }
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
    if(!slotForm.horaInicio||!slotForm.horaFin||!slotForm.duracion) return showToast("Completá horario de apertura, cierre y duración.","warn");
    const [hI,mI]=slotForm.horaInicio.split(":").map(Number);
    const [hF,mF]=slotForm.horaFin.split(":").map(Number);
    const inicioMin = hI*60+mI;
    const finMin = hF*60+mF;
    const dur = Number(slotForm.duracion);
    const intervalo = Number(slotForm.intervalo)||0;
    if(finMin<=inicioMin||dur<=0||dur>finMin-inicioMin) return showToast("Horarios o duración inválidos.","warn");
    const slots=[];
    const hh=h=>String(Math.floor(h/60)).padStart(2,"0")+":"+String(h%60).padStart(2,"0");
    for(let t=inicioMin;t+dur<=finMin;t+=dur+intervalo){
      slots.push({recurso_id:espacio.id,org_id:getCurrentOrgId(),nombre:hh(t)+" – "+hh(t+dur),hora_inicio:hh(t),hora_fin:hh(t+dur),precio_semana:Number(slotForm.precioSemana)||0,precio_finde:Number(slotForm.precioFinde)||0,activo:true});
    }
    if(slots.length===0) return showToast("No se generaron turnos. Revisá los horarios.","warn");
    if(turnos.length>0 && !window.confirm(`Esto va a reemplazar los ${turnos.length} turnos actuales de este espacio. ¿Continuar?`)) return;
    setGenerando(true);
    // Desactivar turnos existentes
    await supabase.from("turnos_recurso").update({activo:false}).eq("recurso_id",espacio.id);
    // Guardar parámetros del slot en el espacio
    await supabase.from("recursos").update({modo:"slot",slot_hora_inicio:slotForm.horaInicio,slot_hora_fin:slotForm.horaFin,slot_duracion_min:dur,slot_intervalo_min:intervalo}).eq("id",espacio.id);
    // Insertar nuevos slots
    const {data,error}=await supabase.from("turnos_recurso").insert(slots).select();
    if(error){showToast("Error al generar turnos: "+error.message,"error");setGenerando(false);return;}
    const mapped=(data||[]).map(x=>({id:x.id,recursoId:x.recurso_id,orgId:x.org_id,nombre:x.nombre||"",horaInicio:x.hora_inicio||"",horaFin:x.hora_fin||"",precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:true}));
    setTurnos(data||[]);
    setLoaded(true);
    if(onTurnosChange) onTurnosChange(espacio.id, mapped);
    setGenerando(false);
    showToast(`✅ Se generaron ${slots.length} turnos de ${dur} minutos.`,"ok");
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

          {/* Toggle calificación post-evento */}
          <button onClick={toggleCalActiva} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 10px",marginBottom:12,background:calActiva?"#FEF3EC":"#F5F5F5",border:"1.5px solid",borderColor:calActiva?"#C4602B":"#D1D5DB",borderRadius:8,cursor:"pointer",fontFamily:"inherit"}}>
            <span style={{fontSize:12,color:calActiva?"#C4602B":"#8B7355",fontWeight:600}}>⭐ Calificación post-evento</span>
            <span style={{fontSize:12,color:calActiva?"#C4602B":"#8B7355",fontWeight:700}}>{calActiva?"Activa":"Inactiva"}</span>
          </button>

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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div>
                  <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Duración del turno</div>
                  <select value={slotForm.duracion} onChange={e=>setSlotForm(p=>({...p,duracion:e.target.value}))} style={inpS}>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min (1h)</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min (2h)</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Intervalo entre turnos</div>
                  <select value={slotForm.intervalo} onChange={e=>setSlotForm(p=>({...p,intervalo:e.target.value}))} style={inpS}>
                    <option value={0}>Sin intervalo</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
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

          {/* ── TEMPORADAS DE PRECIO ── */}
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #EDE0D0"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#5C4033",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>🌡️ Temporadas de precio</div>
            <div style={{fontSize:11,color:"#8B7355",marginBottom:10}}>Cada temporada define qué turnos están disponibles y a qué precio. Fechas sin temporada = no disponibles.</div>
            {temporadas.length===0 && !showTmpForm && <div style={{fontSize:12,color:"#8B7355",marginBottom:8}}>Sin temporadas — el precio base es el del turno y todas las fechas están disponibles.</div>}
            {temporadas.map(tmp=>{
              const isOpen=expandedTmpId===tmp.id;
              return (
                <div key={tmp.id} style={{marginBottom:8,borderRadius:8,border:`1.5px solid ${isOpen?"#C4602B":"#EDE0D0"}`,overflow:"hidden"}}>
                  {/* Header temporada */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:isOpen?"#FEF3EC":"#FDF8F3",cursor:"pointer"}} onClick={()=>setExpandedTmpId(isOpen?null:tmp.id)}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:isOpen?"#C4602B":"#1C1C1E"}}>{tmp.nombre}</div>
                      <div style={{fontSize:11,color:"#8B7355"}}>{MESES[tmp.mesDesde]} {tmp.diaDesde} → {MESES[tmp.mesHasta]} {tmp.diaHasta}</div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:13,color:"#8B7355",transform:isOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}>⌄</span>
                      <button onClick={e=>{e.stopPropagation();if(window.confirm(`¿Eliminás la temporada "${tmp.nombre}"?`))handleRemoveTemporada(tmp.id);}} style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>🗑️</button>
                    </div>
                  </div>
                  {/* Turnos dentro de la temporada */}
                  {isOpen && (
                    <div style={{padding:"10px 12px",background:"#FFF",borderTop:"1px solid #EDE0D0"}}>
                      {turnos.length===0 && <div style={{fontSize:12,color:"#8B7355"}}>Primero creá los turnos del espacio (arriba).</div>}
                      {turnos.map(tr=>{
                        const pt=preciosTemp.find(p=>p.temporadaId===tmp.id&&p.turnoId===tr.id);
                        const activo=pt?.activo!==false;
                        return (
                          <div key={tr.id} style={{marginBottom:10,padding:"8px 10px",borderRadius:8,border:"1px solid #EDE0D0",background:activo?"#FFF":"#F9F6F2",opacity:activo?1:0.65}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:activo?8:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <span style={{fontSize:16}}>{tr.icono||"📌"}</span>
                                <span style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>{tr.nombre}</span>
                                <span style={{fontSize:11,color:"#8B7355"}}>{tr.hora_inicio}–{tr.hora_fin}</span>
                              </div>
                              <button onClick={()=>handlePrecioChange(tmp.id,tr.id,"activo",!activo)}
                                style={{padding:"4px 10px",borderRadius:16,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"none",background:activo?"#16A34A":"#EDE0D0",color:activo?"#FFF":"#8B7355"}}>
                                {activo?"Activo":"Inactivo"}
                              </button>
                            </div>
                            {activo && (
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                <div>
                                  <div style={{fontSize:10,color:"#8B7355",marginBottom:3}}>Precio lun–vie ($)</div>
                                  <input type="number" defaultValue={pt?.precioSemana||0}
                                    onBlur={e=>handlePrecioChange(tmp.id,tr.id,"precioSemana",e.target.value)}
                                    style={{...inpS,fontSize:12}} />
                                </div>
                                <div>
                                  <div style={{fontSize:10,color:"#8B7355",marginBottom:3}}>Precio sáb–dom ($)</div>
                                  <input type="number" defaultValue={pt?.precioFinde||0}
                                    onBlur={e=>handlePrecioChange(tmp.id,tr.id,"precioFinde",e.target.value)}
                                    style={{...inpS,fontSize:12}} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {!showTmpForm ? (
              <button onClick={()=>setShowTmpForm(true)} style={{marginTop:4,width:"100%",padding:"8px",background:"#FDF8F3",border:"1.5px dashed #8B7355",borderRadius:8,color:"#8B7355",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar temporada</button>
            ) : (
              <div style={{marginTop:8,padding:12,background:"#FDF5EE",borderRadius:10,border:"1px solid #EDE0D0"}}>
                <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Nombre</div>
                <input value={tmpForm.nombre} onChange={e=>setTmpForm(p=>({...p,nombre:e.target.value}))} style={{...inpS,marginBottom:10}} placeholder="ej: Temporada Alta, Diciembre, Baja..." />
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
                  <div><div style={{fontSize:10,color:"#8B7355",marginBottom:2}}>Mes desde</div><input type="number" min="1" max="12" value={tmpForm.mesDesde} onChange={e=>setTmpForm(p=>({...p,mesDesde:e.target.value}))} style={inpS} /></div>
                  <div><div style={{fontSize:10,color:"#8B7355",marginBottom:2}}>Día desde</div><input type="number" min="1" max="31" value={tmpForm.diaDesde} onChange={e=>setTmpForm(p=>({...p,diaDesde:e.target.value}))} style={inpS} /></div>
                  <div><div style={{fontSize:10,color:"#8B7355",marginBottom:2}}>Mes hasta</div><input type="number" min="1" max="12" value={tmpForm.mesHasta} onChange={e=>setTmpForm(p=>({...p,mesHasta:e.target.value}))} style={inpS} /></div>
                  <div><div style={{fontSize:10,color:"#8B7355",marginBottom:2}}>Día hasta</div><input type="number" min="1" max="31" value={tmpForm.diaHasta} onChange={e=>setTmpForm(p=>({...p,diaHasta:e.target.value}))} style={inpS} /></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setShowTmpForm(false)} style={{flex:1,padding:"9px",background:"#FFF",border:"1px solid #EDE0D0",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#8B7355",fontWeight:600}}>Cancelar</button>
                  <button onClick={handleAddTemporada} style={{flex:2,padding:"9px",background:"#C4602B",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700}}>Guardar temporada</button>
                </div>
              </div>
            )}
          </div>
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
    // Whitelist estricta: no SVG (puede contener JS embebido)
    const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"];
    if (!ALLOWED.includes(file.type)) {
      showToast("Solo se permiten JPG, PNG, WEBP o GIF.", "error");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("La imagen no puede superar 2MB.", "error");
      e.target.value = "";
      return;
    }
    setUploading(true);
    const EXT = { "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif" };
    const ext = EXT[file.type] || "jpg";
    const path = `logos/${orgId || "default"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("negocio-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { showToast("Error al subir imagen: " + error.message, "error"); setUploading(false); return; }
    const { data } = supabase.storage.from("negocio-assets").getPublicUrl(path);
    onUploaded(data.publicUrl + "?t=" + Date.now());
    showToast("Logo actualizado correctamente.", "ok");
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
    if(!form.nombre||!form.horaInicio||!form.horaFin) return showToast("Completá nombre, hora inicio y hora fin.","warn");
    const nuevo = { recurso_id: espacioSel, org_id: getCurrentOrgId(), nombre: form.nombre.trim(), hora_inicio: form.horaInicio, hora_fin: form.horaFin, precio_semana: Number(form.precioSemana)||0, precio_finde: Number(form.precioFinde)||0, activo: true };
    const { data, error } = await supabase.from("turnos_recurso").insert(nuevo).select().single();
    if(error){ showToast("Error: "+error.message,"error"); return; }
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

const PLANES_META_QB = {
  basico:      { label:'Básico',      color:'#6b7280', emoji:'⚡' },
  profesional: { label:'Profesional', color:'#C4602B', emoji:'🚀' },
  premium:     { label:'Premium',     color:'#7c3aed', emoji:'💎' },
  sincargo:    { label:'Sin cargo',   color:'#16a34a', emoji:'🎁' },
  demo:        { label:'Demo',        color:'#C4602B', emoji:'🎁' },
};

function MiPlanView({ currentUser, onBack }) {
  const planActual = currentUser?.plan || 'basico';
  const meta = PLANES_META_QB[planActual] || PLANES_META_QB.basico;

  const [planesDB,        setPlanesDB]        = useState([]);
  const [planSel,         setPlanSel]         = useState('profesional');
  const [vistaUpgrade,    setVistaUpgrade]    = useState(false);
  const [cargando,        setCargando]        = useState(false);
  const [cancelando,      setCancelando]      = useState(false);
  const [confirmarCancel, setConfirmarCancel] = useState(false);
  const [mpPreapproval,   setMpPreapproval]   = useState(null);
  const [fechaVenc,       setFechaVenc]       = useState(null);
  const [error,           setError]           = useState('');

  useEffect(() => {
    fetch('/api/planes-precios').then(r => r.json()).then(d => {
      if (d.planes?.length) {
        const ordenados = ['basico','profesional','premium'].map(id => {
          const row = d.planes.find(p => p.plan === id);
          if (!row) return null;
          return { id, ...PLANES_META_QB[id], precio:'$'+Number(row.precio_mensual).toLocaleString('es-AR'), beneficios: row.beneficios||[] };
        }).filter(Boolean);
        setPlanesDB(ordenados);
      }
    }).catch(()=>{});

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const res = await fetch('/api/verificar-acceso', { headers: { Authorization:`Bearer ${session.access_token}` } });
      const data = res.ok ? await res.json() : null;
      if (data?.mp_preapproval_id) setMpPreapproval(data.mp_preapproval_id);
      if (data?.fecha_vencimiento)  setFechaVenc(data.fecha_vencimiento);
    });
  }, []);

  const iniciarUpgrade = async () => {
    setCargando(true); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Sesión expirada.'); setCargando(false); return; }
    try {
      const r = await fetch('/api/mp-crear-suscripcion', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`},
        body: JSON.stringify({ plan: planSel }),
      });
      const data = await r.json();
      if (!r.ok || !data.init_point) { setError(data.error||'Error al iniciar el pago.'); setCargando(false); return; }
      window.location.href = data.init_point;
    } catch { setError('Error de conexión. Intentá de nuevo.'); setCargando(false); }
  };

  const cancelarSuscripcion = async () => {
    setCancelando(true); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Sesión expirada.'); setCancelando(false); return; }
    try {
      const r = await fetch('/api/mp-cancelar-suscripcion', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`},
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error||'Error al cancelar.'); setCancelando(false); setConfirmarCancel(false); return; }
      setMpPreapproval(null);
      setConfirmarCancel(false);
    } catch { setError('Error de conexión.'); }
    setCancelando(false);
  };

  const planesUpgrade = planesDB.filter(p => p.id !== planActual);

  return (
    <div style={{minHeight:'100vh',background:'#FFF',paddingBottom:80}}>
      <div style={{maxWidth:480,margin:'0 auto',padding:'16px 16px 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <button onClick={onBack} style={{width:36,height:36,borderRadius:10,background:'#F3F4F6',border:'none',cursor:'pointer',fontSize:18}}>←</button>
          <h1 style={{margin:0,fontSize:18,fontWeight:800,color:'#1C1C1E',fontFamily:"'Playfair Display',serif"}}>Mi plan</h1>
        </div>

        <div style={{borderRadius:16,padding:20,marginBottom:16,border:`2px solid ${meta.color}`,background:meta.color+'12'}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:meta.color,marginBottom:4}}>Plan actual</div>
          <div style={{fontSize:24,fontWeight:900,color:meta.color,marginBottom:10}}>{meta.emoji} {meta.label}</div>
          {currentUser?.suscripcionEstado === 'demo' && (
            <div style={{fontSize:13,color:'#92400E',fontWeight:600,marginBottom:6}}>
              🎁 Demo — {currentUser.diasRestantes != null ? `${currentUser.diasRestantes} días restantes` : 'activa'}
            </div>
          )}
          {fechaVenc && currentUser?.suscripcionEstado === 'activo' && (
            <div style={{fontSize:13,color:'#374151',marginBottom:6}}>
              🔄 Próxima renovación: <strong>{new Date(fechaVenc).toLocaleDateString('es-AR')}</strong>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:mpPreapproval?'#16A34A':'#9CA3AF',marginTop:8}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:mpPreapproval?'#16A34A':'#D1D5DB',display:'inline-block'}} />
            {mpPreapproval ? 'Débito automático activo' : 'Sin débito automático'}
          </div>
        </div>

        {!vistaUpgrade && (
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
            <button onClick={()=>setVistaUpgrade(true)}
              style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#C4602B,#9E4A1E)',border:'none',borderRadius:12,color:'#FFF',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
              ⬆️ Cambiar plan
            </button>
            {mpPreapproval && (
              <button onClick={()=>setConfirmarCancel(true)}
                style={{width:'100%',padding:'12px',background:'none',border:'1px solid #FECACA',borderRadius:12,color:'#DC2626',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                Cancelar débito automático
              </button>
            )}
          </div>
        )}

        {vistaUpgrade && (
          <div>
            <button onClick={()=>setVistaUpgrade(false)} style={{background:'none',border:'none',color:'#C4602B',fontWeight:700,fontSize:13,cursor:'pointer',marginBottom:12,fontFamily:'inherit'}}>← Volver</button>
            <div style={{fontWeight:700,fontSize:15,color:'#1C1C1E',marginBottom:4}}>Cambiar plan</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:14}}>Se activa de inmediato con débito automático mensual.</div>
            {planesUpgrade.map(p => (
              <div key={p.id} onClick={()=>setPlanSel(p.id)}
                style={{border:`2px solid ${planSel===p.id?p.color:'#E5E7EB'}`,borderRadius:14,padding:'14px 16px',marginBottom:10,cursor:'pointer',background:planSel===p.id?p.color+'12':'#FAFAFA',transition:'all 0.15s'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontWeight:700,fontSize:15,color:p.color}}>{p.label}</span>
                  <span style={{fontWeight:800,color:'#1C1C1E',fontSize:15}}>{p.precio}<span style={{fontWeight:400,fontSize:11,color:'#9CA3AF'}}>/mes</span></span>
                </div>
                {p.beneficios?.length > 0 && (
                  <ul style={{margin:0,padding:0,listStyle:'none',marginTop:6}}>
                    {p.beneficios.map((b,i) => (
                      <li key={i} style={{fontSize:12,color:'#6B7280',display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                        <span style={{color:p.color,fontWeight:700}}>✓</span>{b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <div style={{background:'#FFF8F5',border:'1px solid #EDE0D0',borderRadius:12,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#8B7355'}}>
              💳 El pago se procesa por <strong>Mercado Pago</strong>. Se renueva automáticamente cada mes.
            </div>
            {error && <div style={{color:'#DC2626',fontSize:12,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:12}}>{error}</div>}
            <button onClick={iniciarUpgrade} disabled={cargando}
              style={{width:'100%',padding:'14px',background:cargando?'#EDE0D0':'linear-gradient(135deg,#C4602B,#9E4A1E)',border:'none',borderRadius:12,color:'#FFF',fontWeight:700,fontSize:14,cursor:cargando?'not-allowed':'pointer',fontFamily:'inherit',opacity:cargando?0.7:1}}>
              {cargando ? 'Redirigiendo...' : `Suscribirme — Plan ${planesDB.find(p=>p.id===planSel)?.label??planSel}`}
            </button>
          </div>
        )}

        {confirmarCancel && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:999,padding:16}}>
            <div style={{background:'#FFF',borderRadius:20,padding:20,width:'100%',maxWidth:400}}>
              <h3 style={{margin:'0 0 8px',fontSize:16,color:'#1C1C1E'}}>¿Cancelar débito automático?</h3>
              <p style={{margin:'0 0 20px',fontSize:14,color:'#6B7280'}}>Tu acceso continúa hasta el vencimiento.</p>
              {error && <div style={{color:'#DC2626',fontSize:12,marginBottom:10}}>{error}</div>}
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setConfirmarCancel(false)} style={{flex:1,padding:'12px',background:'#F3F4F6',border:'none',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontSize:13,color:'#6B7280'}}>No, mantener</button>
                <button onClick={cancelarSuscripcion} disabled={cancelando}
                  style={{flex:1,padding:'12px',background:'#DC2626',border:'none',borderRadius:12,cursor:cancelando?'not-allowed':'pointer',fontFamily:'inherit',fontSize:13,color:'#FFF',fontWeight:700,opacity:cancelando?0.6:1}}>
                  {cancelando?'Cancelando...':'Sí, cancelar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigView({ config, saveConfig, serviciosExtras, setServiciosExtras, recursos, setRecursos, usuarios, setUsuarios, currentUser, removeUsuario, perfilesUsuarios, setPerfilesUsuarios, negocio, setNegocio, turnosRecurso, setTurnosRecurso, setTemporadasPrecio, setPreciosTemporada, onGoMiPlan, mercadoProductos, saveMercadoProductos, removeMercadoProducto }) {
  const [negForm, setNegForm] = useState({ nombreNegocio: negocio?.nombreNegocio||"", ciudad: negocio?.ciudad||"", direccion: negocio?.direccion||"", telefono: negocio?.telefono||"", logoUrl: negocio?.logoUrl||"", msgRecordatorio: negocio?.msgRecordatorio||"", msgPostEvento: negocio?.msgPostEvento||"", recordatorioActivo: negocio?.recordatorioActivo!==false, postEventoActivo: negocio?.postEventoActivo!==false, condicionesEmail: negocio?.condicionesEmail||"", googleReviewUrl: negocio?.googleReviewUrl||"", wifiPassword: negocio?.wifiPassword||"", portalActivo: negocio?.portalActivo!==false, fotosLugar: negocio?.fotosLugar||[] });
  const [negSaved, setNegSaved] = useState(false);
  const [showMsgs, setShowMsgs] = useState(false);
  const [open, setOpen] = useState("negocio");
  const planLimits = getPlanLimits(currentUser?.plan);

  const toggle = s => setOpen(o => o===s ? null : s);

  const handleSaveNegocio = async () => {
    const row = { org_id: getCurrentOrgId(), nombre_negocio: negForm.nombreNegocio, ciudad: negForm.ciudad, direccion: negForm.direccion, telefono: negForm.telefono, logo_url: negForm.logoUrl, msg_recordatorio: negForm.msgRecordatorio, msg_post_evento: negForm.msgPostEvento, recordatorio_activo: negForm.recordatorioActivo, post_evento_activo: negForm.postEventoActivo, condiciones_email: negForm.condicionesEmail, google_review_url: negForm.googleReviewUrl, wifi_password: negForm.wifiPassword, portal_activo: negForm.portalActivo, fotos_lugar: negForm.fotosLugar };
    const { error } = await supabase.from("config").upsert(row, { onConflict: "org_id" });
    if (error) { showToast("Error al guardar: " + error.message,"error"); return; }
    setNegocio({ nombreNegocio: negForm.nombreNegocio, ciudad: negForm.ciudad, direccion: negForm.direccion, telefono: negForm.telefono, logoUrl: negForm.logoUrl, msgRecordatorio: negForm.msgRecordatorio, msgPostEvento: negForm.msgPostEvento, recordatorioActivo: negForm.recordatorioActivo, postEventoActivo: negForm.postEventoActivo, condicionesEmail: negForm.condicionesEmail, googleReviewUrl: negForm.googleReviewUrl, wifiPassword: negForm.wifiPassword, portalActivo: negForm.portalActivo, fotosLugar: negForm.fotosLugar });
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

  const SaveBtn = () => (
    <button onClick={handleSaveNegocio} style={{width:"100%",padding:"12px",background:negSaved?"#16A34A":"#C4602B",color:"#FFF",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"background 0.3s",marginTop:4}}>
      {negSaved ? "✅ Guardado" : "💾 Guardar"}
    </button>
  );

  return (
    <div style={{padding:"16px 16px 100px",display:"flex",flexDirection:"column",gap:10}}>

      {/* 1 ── MI NEGOCIO ── */}
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
                  <LogoUploadButton orgId={getCurrentOrgId()} onUploaded={url=>setNegForm(p=>({...p,logoUrl:url}))} />
                  {negForm.logoUrl && <div style={{fontSize:10,color:"#8B7355",marginTop:4,wordBreak:"break-all"}}>{negForm.logoUrl.split("/").pop()?.split("?")[0]}</div>}
                </div>
              </div>
            </div>
            <SaveBtn />
          </div>
        )}
      </div>

      {/* 2 ── ESPACIOS ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="espacios" icon="🏠" title="Espacios" subtitle={`${recursos.length} espacio${recursos.length!==1?"s":""} configurado${recursos.length!==1?"s":""}`} />
        {open==="espacios" && (
          <div style={{marginTop:16}}>
            {recursos.length===0 && <div style={{fontSize:13,color:"#8B7355",marginBottom:12}}>No hay espacios creados. Agregá uno para empezar.</div>}
            {recursos.map(r=>(
              <EspacioCard key={r.id} espacio={r} onDelete={async()=>{
                if(!window.confirm(`¿Eliminás "${r.nombre}"? El espacio quedará inactivo y se preservará el historial.`)) return;
                const {error:delErr} = await supabase.from("recursos").update({deleted_at: new Date().toISOString()}).eq("id",r.id);
                if(delErr){ showToast("No se pudo eliminar el espacio: "+delErr.message,"error"); return; }
                showToast(`Espacio "${r.nombre}" eliminado`,"ok");
                setRecursos(prev=>prev.filter(x=>x.id!==r.id));
                if(setTurnosRecurso) setTurnosRecurso(prev=>prev.filter(t=>t.recursoId!==r.id));
              }} onTurnosChange={(recursoId,nuevos)=>setTurnosRecurso&&setTurnosRecurso(prev=>[...prev.filter(t=>t.recursoId!==recursoId),...nuevos])} onTemporadasChange={(recursoId,nuevasT,nuevosPt)=>{
                if(setTemporadasPrecio) setTemporadasPrecio(prev=>[...prev.filter(t=>t.recursoId!==recursoId),...nuevasT]);
                if(nuevosPt!==undefined&&setPreciosTemporada){
                  const tmpIds=nuevasT.map(t=>t.id);
                  setPreciosTemporada(prev=>[...prev.filter(p=>!tmpIds.includes(p.temporadaId)),...nuevosPt]);
                }
              }} />
            ))}
            <AddEspacioForm recursos={recursos} setRecursos={setRecursos} plan={currentUser?.plan} />
          </div>
        )}
      </div>

      {/* 3 ── MENSAJES WHATSAPP ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="mensajes" icon="💬" title="Mensajes WhatsApp"
          subtitle={`Recordatorio ${negForm.recordatorioActivo?"✅":"⏸"} · Post-evento ${negForm.postEventoActivo?"✅":"⏸"}`} />
        {open==="mensajes" && (
          <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
            {/* Recordatorio */}
            <div style={{padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0"}}>
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
              {negForm.recordatorioActivo&&(
                <>
                  <textarea style={{...inpS,height:110,resize:"vertical",fontSize:12}} value={negForm.msgRecordatorio} onChange={e=>setNegForm(p=>({...p,msgRecordatorio:e.target.value}))} />
                  <div style={{fontSize:10,color:"#9CA3AF",marginTop:4}}>Variables: {"{nombre}"} {"{fecha}"} {"{horario_inicio}"} {"{horario_fin}"} {"{saldo}"}</div>
                </>
              )}
            </div>
            {/* Post-evento */}
            <div style={{padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0"}}>
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
              {negForm.postEventoActivo&&(
                <>
                  <textarea style={{...inpS,height:110,resize:"vertical",fontSize:12}} value={negForm.msgPostEvento} onChange={e=>setNegForm(p=>({...p,msgPostEvento:e.target.value}))} />
                  <div style={{fontSize:10,color:"#9CA3AF",marginTop:4}}>Variables: {"{nombre}"} {"{nombre_negocio}"}</div>
                </>
              )}
            </div>
            {/* Google Reviews */}
            <div style={{padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0"}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E",marginBottom:2}}>⭐ Link de reseñas de Google</div>
              <div style={{fontSize:11,color:"#8B7355",marginBottom:8}}>Aparece como tilde opcional en el mensaje post-evento para pedir reseñas a clientes satisfechos.</div>
              <input style={inpS} value={negForm.googleReviewUrl} onChange={e=>setNegForm(p=>({...p,googleReviewUrl:e.target.value}))} placeholder="https://g.page/r/XXXXXX/review" />
              {negForm.googleReviewUrl && <a href={negForm.googleReviewUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#C4602B",display:"inline-block",marginTop:6}}>Probar link →</a>}
            </div>
            <SaveBtn />
          </div>
        )}
      </div>

      {/* 4 ── CONDICIONES DEL ALQUILER ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="condiciones" icon="📋" title="Condiciones del alquiler" subtitle="Se incluyen en el email y en el contrato PDF" />
        {open==="condiciones" && (
          <div style={{marginTop:16}}>
            <div style={{fontSize:12,color:"#8B7355",marginBottom:10}}>Estas condiciones aparecen en el email de confirmación de reserva y en el contrato PDF. Si el campo queda vacío no se incluyen.</div>
            <textarea style={{...inpS,height:180,resize:"vertical",fontSize:12}} value={negForm.condicionesEmail} onChange={e=>setNegForm(p=>({...p,condicionesEmail:e.target.value}))}
              placeholder={"Ej:\n- Depósito de garantía: $60.000\n- Limpieza opcional: $40.000\n- Sin pirotecnia ni mascotas\n- Cumplir horarios de ingreso y egreso"} />
            <SaveBtn />
          </div>
        )}
      </div>

      {/* 5 ── PORTAL DEL EVENTO ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="portal" icon="🔗" title="Portal del Evento" subtitle={negForm.portalActivo?"✅ Activo":"⏸ Inactivo"} />
        {open==="portal" && (
          <div style={{marginTop:16}}>
            <div style={{fontSize:12,color:"#8B7355",marginBottom:14,lineHeight:1.5}}>Cuando está activo, cada reserva puede generar un link exclusivo para el cliente. Desde ahí configura su invitación, recibe confirmaciones de asistencia, y consulta extras.</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>🔗 Portal del evento</div>
                <div style={{fontSize:11,color:"#8B7355"}}>Permite compartir el evento con clientes</div>
              </div>
              <button onClick={()=>setNegForm(p=>({...p,portalActivo:!p.portalActivo}))}
                style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:"none",background:negForm.portalActivo?"#16A34A":"#EDE0D0",color:negForm.portalActivo?"#FFF":"#8B7355",flexShrink:0,marginLeft:8}}>
                {negForm.portalActivo?"✅ Activo":"Inactivo"}
              </button>
            </div>
            <div style={{padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E",marginBottom:2}}>📶 Contraseña WiFi</div>
              <div style={{fontSize:11,color:"#8B7355",marginBottom:8}}>Se muestra en el portal el día del evento.</div>
              <input style={inpS} value={negForm.wifiPassword} onChange={e=>setNegForm(p=>({...p,wifiPassword:e.target.value}))} placeholder="Contraseña del WiFi" />
            </div>
            <div style={{padding:12,background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E",marginBottom:2}}>📷 Fotos del lugar</div>
              <div style={{fontSize:11,color:"#8B7355",marginBottom:10}}>Se muestran en el portal para que los invitados conozcan el espacio. Hasta 12 fotos.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {(negForm.fotosLugar||[]).map((f,i)=>(
                  <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",aspectRatio:"4/3",background:"#F5EDE4",border:"1.5px solid #EDE0D0"}}>
                    <img src={f.url} alt={f.alt||""} style={{width:"100%",height:"100%",objectFit:"cover"}} loading="lazy" />
                    <button onClick={()=>{setNegForm(p=>({...p,fotosLugar:p.fotosLugar.filter((_,j)=>j!==i)}));}} style={{position:"absolute",top:4,right:4,width:24,height:24,borderRadius:12,background:"rgba(0,0,0,0.6)",color:"#FFF",border:"none",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",lineHeight:1}}>×</button>
                  </div>
                ))}
                {(negForm.fotosLugar||[]).length<12 && (
                  <label style={{borderRadius:10,aspectRatio:"4/3",background:"#FDF8F3",border:"2px dashed #EDE0D0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4}}>
                    <span style={{fontSize:24}}>+</span>
                    <span style={{fontSize:10,color:"#8B7355",fontWeight:600}}>Agregar</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={async(e)=>{
                      const file=e.target.files?.[0]; if(!file) return;
                      const ALLOWED=["image/jpeg","image/png","image/webp"];
                      if(!ALLOWED.includes(file.type)){showToast("Solo JPG, PNG o WEBP.","error");e.target.value="";return;}
                      if(file.size>15*1024*1024){showToast("Máximo 15MB por foto.","error");e.target.value="";return;}
                      const alt=file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," ");
                      const img=new Image();
                      const objUrl=URL.createObjectURL(file);
                      img.onload=async()=>{
                        let w=img.width,h=img.height;
                        if(w>1920){h=Math.round(h*1920/w);w=1920;}
                        const canvas=document.createElement("canvas");
                        canvas.width=w;canvas.height=h;
                        canvas.getContext("2d").drawImage(img,0,0,w,h);
                        URL.revokeObjectURL(objUrl);
                        canvas.toBlob(async(blob)=>{
                          const path=`lugar/${getCurrentOrgId()}-${Date.now()}.jpg`;
                          const {error}=await supabase.storage.from("negocio-assets").upload(path,blob,{upsert:true,contentType:"image/jpeg"});
                          if(error){showToast("Error al subir: "+error.message,"error");return;}
                          const {data}=supabase.storage.from("negocio-assets").getPublicUrl(path);
                          const url=data.publicUrl+"?t="+Date.now();
                          setNegForm(p=>({...p,fotosLugar:[...(p.fotosLugar||[]),{url,alt}]}));
                          showToast("Foto agregada.","ok");
                        },"image/jpeg",0.85);
                      };
                      img.src=objUrl;
                      e.target.value="";
                    }} />
                  </label>
                )}
              </div>
            </div>
            <SaveBtn />
          </div>
        )}
      </div>

      {/* 5b ── MERCADO DEL EVENTO ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="mercado" icon="🛒" title="Mercado del Evento" subtitle={`${(mercadoProductos||[]).length} producto${(mercadoProductos||[]).length!==1?"s":""}`} />
        {open==="mercado" && (
          <div style={{marginTop:16}}>
            <div style={{fontSize:12,color:"#8B7355",marginBottom:14,lineHeight:1.5}}>Configurá los productos que ofrecés durante los eventos (bebidas, comidas, extras). Máximo 10 productos. Se activan individualmente desde el panel del día.</div>
            {(mercadoProductos||[]).map(p=>(
              <MercadoProductoRow key={p.id} p={p} onUpdate={async(changes)=>{
                const updated=(mercadoProductos||[]).map(x=>x.id===p.id?{...x,...changes}:x);
                saveMercadoProductos(updated);
              }} onDelete={()=>{
                if(!window.confirm(`¿Eliminás "${p.emoji} ${p.nombre}"?`)) return;
                removeMercadoProducto(p.id);
              }} />
            ))}
            {(mercadoProductos||[]).length<10 && <AddMercadoProductoForm productos={mercadoProductos||[]} onAdd={(nuevo)=>{
              saveMercadoProductos([...(mercadoProductos||[]),nuevo]);
            }} />}
            {(mercadoProductos||[]).length>=10 && <div style={{textAlign:"center",fontSize:12,color:"#9CA3AF",padding:8}}>🔒 Máximo 10 productos alcanzado</div>}
          </div>
        )}
      </div>

      {/* 6 ── SERVICIOS EXTRAS ── */}
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
                  <ServicioExtraRow key={s.id} s={s}
                    onDelete={async()=>{
                      if(!window.confirm(`¿Eliminás "${s.descripcion}"?`)) return;
                      await sb.remove("servicios_extras",s.id);
                      setServiciosExtras(prev=>prev.filter(x=>x.id!==s.id));
                    }}
                    onUpdate={async(changes)=>{
                      const updated={...s,...changes};
                      setServiciosExtras(prev=>prev.map(x=>x.id===s.id?updated:x));
                      await sb.upsert("servicios_extras",[{id:s.id,org_id:getCurrentOrgId(),descripcion:s.descripcion,precio_actual:changes.precioActual,activo:true,detalle:changes.detalle||null,foto_url:changes.fotoUrl||null,grupo:changes.grupo||null}]);
                    }}
                  />
                ))}
                <AddSrvForm serviciosExtras={serviciosExtras} setServiciosExtras={setServiciosExtras} />
              </>
            )}
          </div>
        )}
      </div>

      {/* 6 ── COLABORADORES ── */}
      <div style={{...card, padding:16}}>
        <SectionHeader id="colab" icon="👥" title="Colaboradores" subtitle={planLimits.colaboradores===0?"No disponible en tu plan":`Hasta ${planLimits.colaboradores} en tu plan`} />
        {open==="colab" && <div style={{marginTop:16}}><ColaboradoresSection orgId={getCurrentOrgId()} plan={currentUser?.plan} embedded /></div>}
      </div>

      {/* 7 ── MI SUSCRIPCIÓN ── */}
      {currentUser?.rol === "Administrador" && onGoMiPlan && (
        <div style={{...card, padding:16, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div>
            <div style={{fontWeight:700, fontSize:14, color:"#1C1C1E"}}>💳 Mi suscripción</div>
            <div style={{fontSize:12, color:"#8B7355", marginTop:2}}>Plan activo, pagos y débito automático</div>
          </div>
          <button onClick={onGoMiPlan} style={{background:"none",border:"none",color:"#C4602B",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Gestionar →</button>
        </div>
      )}

    </div>
  );
}

function AddEspacioForm({ recursos, setRecursos, plan }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({nombre:"",capacidadMax:""});
  const limits = getPlanLimits(plan);
  const atLimit = recursos.length >= limits.espacios;
  if(!show) return (
    <button onClick={()=>{ if(atLimit){showToast(`Tu plan ${plan||"actual"} permite hasta ${limits.espacios} espacio${limits.espacios!==1?"s":""}. Actualizá tu plan para agregar más.`,"warn");return;} setShow(true);}}
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
          const nuevo={id:genId(),nombre:form.nombre,capacidadMax:Number(form.capacidadMax)||0,modo:"fijo",orgId:getCurrentOrgId(),org_id:getCurrentOrgId()};
          const {error}=await supabase.from("recursos").insert({id:nuevo.id,nombre:nuevo.nombre,capacidad_max:nuevo.capacidadMax,modo:"fijo",org_id:getCurrentOrgId(),creado_en:new Date().toISOString()});
          if(error){showToast("Error al guardar espacio: "+error.message,"error");return;}
          setRecursos(prev=>[...prev,nuevo]);
          setForm({nombre:"",capacidadMax:""});setShow(false);
        }} style={{flex:2,padding:"9px",background:"#C4602B",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700}}>Guardar</button>
      </div>
    </div>
  );
}

function ServicioExtraRow({ s, onDelete, onUpdate }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({precio:String(s.precioActual),detalle:s.detalle||"",fotoUrl:s.fotoUrl||"",grupo:s.grupo||""});
  const [uploading, setUploading] = useState(false);
  return (
    <div style={{padding:"12px 0",borderBottom:"1px solid #F5EDE4"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
          {s.fotoUrl && <img src={s.fotoUrl} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}} />}
          <div style={{minWidth:0}}>
            <div style={{fontWeight:600,fontSize:13,color:"#1C1C1E"}}>{s.descripcion}</div>
            {!editando && <div style={{fontSize:12,color:"#8B7355"}}>{fmtCurrency(s.precioActual)}</div>}
            {!editando && s.grupo && <div style={{fontSize:10,color:"#C4602B",fontWeight:700,marginTop:2,background:"#FDF8F3",display:"inline-block",padding:"1px 6px",borderRadius:4}}>Grupo: {s.grupo}</div>}
            {!editando && s.detalle && <div style={{fontSize:11,color:"#A8A29E",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.detalle}</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={()=>{setEditando(p=>!p);setForm({precio:String(s.precioActual),detalle:s.detalle||"",fotoUrl:s.fotoUrl||"",grupo:s.grupo||""});}}
            style={{background:"#FDF8F3",border:"1px solid #EDE0D0",color:"#C4602B",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600}}>
            {editando?"Cancelar":"✏️"}
          </button>
          <button onClick={onDelete}
            style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#DC2626",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
            🗑️
          </button>
        </div>
      </div>
      {editando && (
        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
          <input type="number" placeholder="Precio $" value={form.precio} onChange={e=>setForm(p=>({...p,precio:e.target.value}))}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          <input placeholder="Grupo (ej: Gazebo, Parrillero, Candy) — dejar vacío si es suelto" value={form.grupo} onChange={e=>setForm(p=>({...p,grupo:e.target.value}))}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #C4602B",fontSize:12,fontFamily:"inherit",outline:"none",background:"#FDF8F3"}} />
          <textarea placeholder="Descripcion para el cliente (ej: Incluye parrillero profesional con experiencia en asados para 30+ personas)" value={form.detalle} onChange={e=>setForm(p=>({...p,detalle:e.target.value.slice(0,300)}))}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:12,fontFamily:"inherit",outline:"none",resize:"vertical",minHeight:50}} />
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {form.fotoUrl ? (
              <div style={{position:"relative"}}>
                <img src={form.fotoUrl} alt="" style={{width:60,height:60,borderRadius:8,objectFit:"cover"}} />
                <button onClick={()=>setForm(p=>({...p,fotoUrl:""}))} style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:9,background:"#DC2626",color:"#FFF",border:"none",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            ) : (
              <label style={{padding:"7px 12px",background:"#FDF8F3",border:"1px dashed #EDE0D0",borderRadius:8,cursor:uploading?"wait":"pointer",fontSize:12,color:"#C4602B",fontWeight:600,fontFamily:"inherit"}}>
                {uploading?"Subiendo...":"📷 Foto"}
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} disabled={uploading} onChange={async(e)=>{
                  const file=e.target.files?.[0]; if(!file)return; e.target.value="";
                  if(file.size>15*1024*1024){showToast("Max 15MB","warn");return;}
                  setUploading(true);
                  try{
                    const img=new Image();const url=URL.createObjectURL(file);
                    await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=url;});
                    let w=img.width,h=img.height;if(w>1200){h=Math.round(h*1200/w);w=1200;}
                    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
                    canvas.getContext("2d").drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
                    const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.82));
                    const fileName=`extras/${s.id}_${Date.now()}.jpg`;
                    const{error:upErr}=await supabase.storage.from("evento-fotos").upload(fileName,blob,{contentType:"image/jpeg",upsert:true});
                    if(upErr){showToast("Error: "+upErr.message,"error");return;}
                    setForm(p=>({...p,fotoUrl:`${import.meta.env.VITE_SUPA_URL}/storage/v1/object/public/evento-fotos/${fileName}`}));
                  }catch(err){showToast("Error al procesar imagen","error");}
                  finally{setUploading(false);}
                }} />
              </label>
            )}
            <div style={{flex:1}}></div>
            <button onClick={async()=>{
              const v=Number(form.precio);
              if(!v||v<0) return showToast("Ingresá un precio válido.","warn");
              await onUpdate({precioActual:v,detalle:form.detalle,fotoUrl:form.fotoUrl,grupo:form.grupo});
              setEditando(false);
            }} style={{padding:"7px 14px",background:"#C4602B",color:"#FFF",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MercadoProductoRow({ p, onUpdate, onDelete }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({nombre:p.nombre,emoji:p.emoji||"📦",precio:String(p.precio)});
  const inpS2 = {padding:"7px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  if(editando) return (
    <div style={{padding:12,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0",marginBottom:8}}>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <input style={{...inpS2,width:50,textAlign:"center"}} value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} maxLength={2} placeholder="📦" />
        <input style={{...inpS2,flex:1}} value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre" />
        <input type="number" style={{...inpS2,width:80}} value={form.precio} onChange={e=>setForm(f=>({...f,precio:e.target.value}))} placeholder="Precio" />
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setEditando(false)} style={{flex:1,padding:"8px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancelar</button>
        <button onClick={()=>{
          if(!form.nombre.trim()) return;
          onUpdate({nombre:form.nombre.trim(),emoji:form.emoji||"📦",precio:Number(form.precio)||0});
          setEditando(false);
        }} style={{flex:2,padding:"8px",background:"#C4602B",color:"#FFF",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>Guardar</button>
      </div>
    </div>
  );
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#F9F6F2",borderRadius:10,border:"1px solid #EDE0D0",marginBottom:8}}>
      <span style={{fontSize:22}}>{p.emoji||"📦"}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1C1C1E"}}>{p.nombre}</div>
        <div style={{fontSize:12,color:"#8B7355"}}>${(p.precio||0).toLocaleString("es-AR")}</div>
      </div>
      <button onClick={()=>setEditando(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:4}} title="Editar">✏️</button>
      <button onClick={onDelete} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:4}} title="Eliminar">🗑️</button>
    </div>
  );
}

function AddMercadoProductoForm({ productos, onAdd }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({nombre:"",emoji:"📦",precio:""});
  const inpS2 = {padding:"7px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  if(!show) return (
    <button onClick={()=>setShow(true)} style={{marginTop:4,width:"100%",padding:"10px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:10,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar producto</button>
  );
  return (
    <div style={{marginTop:4,padding:12,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0"}}>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <input style={{...inpS2,width:50,textAlign:"center"}} value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} maxLength={2} placeholder="📦" />
        <input style={{...inpS2,flex:1}} value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Fernet con Coca" />
        <input type="number" style={{...inpS2,width:80}} value={form.precio} onChange={e=>setForm(f=>({...f,precio:e.target.value}))} placeholder="Precio" />
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>{setShow(false);setForm({nombre:"",emoji:"📦",precio:""});}} style={{flex:1,padding:"8px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancelar</button>
        <button onClick={()=>{
          if(!form.nombre.trim()){showToast("Ponele un nombre al producto","warn");return;}
          if(!Number(form.precio)){showToast("Poné un precio válido","warn");return;}
          onAdd({id:genId(),nombre:form.nombre.trim(),emoji:form.emoji||"📦",precio:Number(form.precio),orden:productos.length,activo:true,orgId:getCurrentOrgId(),creadoEn:new Date().toISOString()});
          setForm({nombre:"",emoji:"📦",precio:""});setShow(false);
          showToast("Producto agregado","ok");
        }} style={{flex:2,padding:"8px",background:"#C4602B",color:"#FFF",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>Agregar</button>
      </div>
    </div>
  );
}

function AddSrvForm({ serviciosExtras, setServiciosExtras }) {
  const [form, setForm] = useState({descripcion:"",precioActual:"",detalle:"",fotoUrl:"",grupo:""});
  const [show, setShow] = useState(false);
  const [uploading, setUploading] = useState(false);
  if(!show) return <button onClick={()=>setShow(true)} style={{marginTop:12,width:"100%",padding:"10px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:10,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar servicio</button>;
  return (
    <div style={{marginTop:12,padding:12,background:"#FDF8F3",borderRadius:10,border:"1px solid #EDE0D0"}}>
      <input placeholder="Nombre del servicio" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none"}} />
      <input type="number" placeholder="Precio $" value={form.precioActual} onChange={e=>setForm(p=>({...p,precioActual:e.target.value}))}
        onFocus={e=>e.target.select()}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:13,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none"}} />
      <input placeholder="Grupo (ej: Gazebo, Parrillero, Candy) — vacío = extra suelto" value={form.grupo} onChange={e=>setForm(p=>({...p,grupo:e.target.value}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #C4602B",fontSize:12,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none",background:"#FDF8F3"}} />
      <textarea placeholder="Descripcion para el cliente (opcional)" value={form.detalle} onChange={e=>setForm(p=>({...p,detalle:e.target.value.slice(0,300)}))}
        style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #EDE0D0",fontSize:12,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box",outline:"none",resize:"vertical",minHeight:40}} />
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        {form.fotoUrl ? (
          <div style={{position:"relative"}}>
            <img src={form.fotoUrl} alt="" style={{width:50,height:50,borderRadius:8,objectFit:"cover"}} />
            <button onClick={()=>setForm(p=>({...p,fotoUrl:""}))} style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:8,background:"#DC2626",color:"#FFF",border:"none",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        ) : (
          <label style={{padding:"6px 10px",background:"#FFF",border:"1px dashed #EDE0D0",borderRadius:8,cursor:uploading?"wait":"pointer",fontSize:12,color:"#C4602B",fontWeight:600,fontFamily:"inherit"}}>
            {uploading?"Subiendo...":"📷 Agregar foto"}
            <input type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} disabled={uploading} onChange={async(e)=>{
              const file=e.target.files?.[0]; if(!file)return; e.target.value="";
              if(file.size>15*1024*1024){showToast("Max 15MB","warn");return;}
              setUploading(true);
              try{
                const img=new Image();const url=URL.createObjectURL(file);
                await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=url;});
                let w=img.width,h=img.height;if(w>1200){h=Math.round(h*1200/w);w=1200;}
                const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
                canvas.getContext("2d").drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
                const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.82));
                const tmpId=Date.now().toString(36);
                const fileName=`extras/${tmpId}.jpg`;
                const{error:upErr}=await supabase.storage.from("evento-fotos").upload(fileName,blob,{contentType:"image/jpeg",upsert:true});
                if(upErr){showToast("Error: "+upErr.message,"error");return;}
                setForm(p=>({...p,fotoUrl:`${import.meta.env.VITE_SUPA_URL}/storage/v1/object/public/evento-fotos/${fileName}`}));
              }catch(err){showToast("Error al procesar imagen","error");}
              finally{setUploading(false);}
            }} />
          </label>
        )}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setShow(false);setForm({descripcion:"",precioActual:"",detalle:"",fotoUrl:""});}} style={{flex:1,padding:"8px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Cancelar</button>
        <button onClick={async()=>{
          if(!form.descripcion||!form.precioActual)return;
          const newSrv={id:genId(),descripcion:form.descripcion,precioActual:Number(form.precioActual),activo:true,detalle:form.detalle,fotoUrl:form.fotoUrl,grupo:form.grupo};
          const updated=[...serviciosExtras,newSrv];
          setServiciosExtras(updated);
          await sb.upsert("servicios_extras",[{id:newSrv.id,org_id:getCurrentOrgId(),descripcion:newSrv.descripcion,precio_actual:newSrv.precioActual,activo:true,detalle:form.detalle||null,foto_url:form.fotoUrl||null,grupo:form.grupo||null,creado_en:new Date().toISOString()}]);
          setForm({descripcion:"",precioActual:"",detalle:"",fotoUrl:"",grupo:""});setShow(false);
        }} style={{flex:2,padding:"8px",background:"#C4602B",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:"#FFF",fontWeight:700}}>Guardar</button>
      </div>
    </div>
  );
}


function RecursosView({ recursos, setRecursos, serviciosExtras }) {
  return (
    <div style={{padding:"16px 16px 100px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>🏠 Espacios</div>
      </div>
      {recursos.map(r=>(
        <div key={r.id} style={{...card,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:700,fontSize:14}}>🏠 {r.nombre}</div>{r.capacidadMax>0&&<div style={{fontSize:12,color:"#8B7355",marginTop:2}}>Hasta {r.capacidadMax} personas</div>}</div>
        </div>
      ))}
      <div style={{fontSize:12,color:"#8B7355",marginBottom:20,marginTop:4}}>Para agregar o eliminar espacios, andá a Configuración → Espacios.</div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"24px 0 12px"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>🎉 Catálogo de Extras</div>
      </div>
      {serviciosExtras.length===0 && <div style={{fontSize:13,color:"#8B7355",marginBottom:10}}>No hay servicios extras creados.</div>}
      {serviciosExtras.map(s=>(
        <div key={s.id} style={{...card,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600,fontSize:14}}>{s.descripcion}</div><div style={{fontSize:12,color:"#16A34A",fontWeight:700,marginTop:2}}>{fmtCurrency(s.precioActual)}</div></div>
        </div>
      ))}
      <div style={{fontSize:12,color:"#8B7355",marginTop:4}}>Para agregar o eliminar extras, andá a Configuración → Servicios Extras.</div>
    </div>
  );
}

// ─── FAB ─────────────────────────────────────────────────

function FAB({ onNewPago, onNewGasto, onNewConsulta }) {
  const [open,setOpen]=useState(false);
  return (
    <div style={{position:"fixed",bottom:82,right:20,zIndex:1500}}>
      {open && (
        <>
          <div onClick={()=>{setOpen(false);onNewConsulta();}} style={{position:"absolute",bottom:188,right:0,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <span style={{background:"#FFF",padding:"5px 12px",borderRadius:8,fontSize:13,fontWeight:600,color:"#0284C7",boxShadow:"0 2px 10px rgba(0,0,0,0.12)",whiteSpace:"nowrap"}}>Registrar Consultas</span>
            <div style={{width:48,height:48,borderRadius:24,background:"#0284C7",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(2,132,199,0.4)",fontSize:20,flexShrink:0}}>📩</div>
          </div>
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
    return "- "+r.fecha+" | "+r.turno+" | "+(c?c.nombre:"Sin cliente")+" | "+r.estado;
  }).join("\n");
  const systemPrompt = "Sos el asistente de "+(config?.nombreNegocio||"App Eventos")+". Hoy es "+today+".\n\n"+
    "RESERVAS PROXIMAS ("+upcoming.length+"):\n"+resumenRes+"\n\n"+
    "FINES DISPONIBLES: "+finesDisponibles.slice(0,8).join(", ")+"\n"+
    "CLIENTES: "+clientes.length+"\n\n"+
    "Responde conciso y util. Si piden crear algo, explica que datos completar en la app.";

  const send = async () => {
    if(!input.trim()||loading) return;
    const userMsg = {role:"user",content:input};
    setMsgs(m=>[...m,userMsg]);
    setInput("");
    setLoading(true);
    try {
      const {data:{session:sess}} = await supabase.auth.getSession();
      const res = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${sess?.access_token}`},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:systemPrompt,
          messages:[...msgs,userMsg].map(m=>({role:m.role,content:m.content}))
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
            if(!("webkitSpeechRecognition" in window))return showToast("Tu navegador no soporta voz.","error");
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

const WA_SOPORTE = '5492236965481';

function SelectorPlanesMP({ orgId, titulo, subtitulo, onSignOut }) {
  const [planes,   setPlanes]   = useState([]);
  const [planSel,  setPlanSel]  = useState('profesional');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    fetch('/api/planes-precios').then(r => r.json()).then(d => {
      if (d.planes?.length) {
        const orden = ['basico','profesional','premium'];
        const metas = {
          basico:      { label:'Básico',       color:'#6b7280', emoji:'⚡' },
          profesional: { label:'Profesional',  color:'#C4602B', emoji:'🚀' },
          premium:     { label:'Premium',      color:'#7c3aed', emoji:'💎' },
        };
        setPlanes(orden.map(id => {
          const row = d.planes.find(p => p.plan === id);
          if (!row) return null;
          return { id, ...metas[id], precio: '$' + Number(row.precio_mensual).toLocaleString('es-AR'), beneficios: row.beneficios || [] };
        }).filter(Boolean));
      }
    }).catch(() => {});
  }, []);

  const pagar = async () => {
    if (!orgId) { setError('No se encontró tu organización. Intentá de nuevo.'); return; }
    setCargando(true); setError('');
    try {
      const { data:{session:s} } = await supabase.auth.getSession();
      const r = await fetch('/api/mp-pago-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({ org_id: orgId, plan: planSel }),
      });
      const data = await r.json();
      if (!r.ok || !data.init_point) { setError(data.error || 'Error al iniciar el pago.'); setCargando(false); return; }
      window.location.href = data.init_point;
    } catch { setError('Error de conexión. Intentá de nuevo.'); setCargando(false); }
  };

  const planInfo = planes.find(p => p.id === planSel);

  return (
    <div style={{minHeight:'100vh',background:'#FFF',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:12}}>🏡</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,color:'#1C1C1E',marginBottom:8}}>{titulo}</div>
          <div style={{fontSize:14,color:'#6B7280',lineHeight:1.6}}>{subtitulo}</div>
        </div>

        {planes.map(p => (
          <div key={p.id} onClick={() => setPlanSel(p.id)}
            style={{border:`2px solid ${planSel===p.id ? p.color : '#E5E7EB'}`,borderRadius:14,padding:'14px 16px',marginBottom:10,cursor:'pointer',background:planSel===p.id ? p.color+'12' : '#FAFAFA',transition:'all 0.15s'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:15,color:p.color}}>{p.emoji} {p.label}</span>
              <span style={{fontWeight:800,color:'#1C1C1E',fontSize:15}}>{p.precio}<span style={{fontWeight:400,fontSize:11,color:'#9CA3AF'}}>/mes</span></span>
            </div>
            {p.beneficios.length > 0 && (
              <ul style={{margin:0,padding:0,listStyle:'none',marginTop:6}}>
                {p.beneficios.map((b,i) => (
                  <li key={i} style={{fontSize:12,color:'#6B7280',display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                    <span style={{color:p.color,fontWeight:700}}>✓</span>{b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <div style={{background:'#FFF8F5',border:'1px solid #EDE0D0',borderRadius:12,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#8B7355'}}>
          💳 El pago se procesa por <strong>Mercado Pago</strong>. Se renueva automáticamente cada mes.
        </div>

        {error && <div style={{color:'#DC2626',fontSize:12,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:12}}>{error}</div>}

        <button onClick={pagar} disabled={cargando || !planInfo}
          style={{width:'100%',padding:'14px 20px',background:cargando?'#EDE0D0':'linear-gradient(135deg,#C4602B,#9E4A1E)',border:'none',borderRadius:12,cursor:cargando?'not-allowed':'pointer',fontSize:15,fontWeight:700,color:'#FFF',fontFamily:'inherit',marginBottom:12,opacity:cargando?0.7:1}}>
          {cargando ? 'Redirigiendo...' : `Suscribirme — Plan ${planInfo?.label ?? planSel}`}
        </button>

        {onSignOut && (
          <button onClick={onSignOut}
            style={{width:'100%',background:'none',border:'none',color:'#9CA3AF',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>
            Volver al inicio de sesión
          </button>
        )}
      </div>
    </div>
  );
}

function GoogleLoginScreen({ onLogin, onBlocked }) {
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [pantalla,     setPantalla]     = useState("login"); // login | registro | demo_vencido | suspendido | impago | cancelado
  const [authUser,     setAuthUser]     = useState(null);
  const [orgIdBloqueo, setOrgIdBloqueo] = useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if(session?.user) { setLoading(true); await handleUser(session.user); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if(event === "SIGNED_IN" && session?.user) { setLoading(true); await handleUser(session.user); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUser = async (au) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/verificar-acceso?login=true", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const acceso = res.ok ? await res.json() : null;

      if (!acceso?.tiene_acceso) {
        if (acceso?.estado === "impago" || acceso?.estado === "suspendido" || acceso?.estado === "cancelado") {
          setAuthUser(au);
          if (acceso?.org_id) setOrgIdBloqueo(acceso.org_id);
          else {
            // fallback: buscar org_id
            const { data: { session: s2 } } = await supabase.auth.getSession();
            const empRes = await fetch("/api/verificar-acceso", { headers: { Authorization: `Bearer ${s2?.access_token}` } });
            const empData = empRes.ok ? await empRes.json() : null;
            if (empData?.ret_org_id) setOrgIdBloqueo(empData.ret_org_id);
          }
          await supabase.auth.signOut();
          setPantalla(acceso.estado === "cancelado" ? "cancelado" : acceso.estado);
          setLoading(false);
          return;
        }
        if (acceso?.estado === "demo" && (acceso?.dias_restantes ?? 0) <= 0) {
          if (acceso?.ret_org_id) setOrgIdBloqueo(acceso.ret_org_id);
          await supabase.auth.signOut();
          setAuthUser(au);
          setPantalla("demo_vencido");
          setLoading(false);
          return;
        }
        // Sin cuenta — mostrar registro
        setAuthUser(au);
        setPantalla("registro");
        setLoading(false);
        return;
      }

      const orgId = acceso.ret_org_id;
      await supabase.from("user_orgs").upsert({ user_id: au.id, org_id: orgId });
      await supabase.auth.refreshSession();

      const user = {
        id: au.id,
        nombre: au.user_metadata?.full_name || au.user_metadata?.name || acceso.nombre_docente || au.email.split("@")[0],
        avatarUrl: au.user_metadata?.avatar_url || au.user_metadata?.picture || null,
        email: au.email,
        orgId,
        rol: "Administrador",
        plan: acceso.plan || "basico",
        suscripcionEstado: acceso.estado,
        diasRestantes: acceso.dias_restantes ?? null,
      };
      lsSet("qb_user", JSON.stringify(user));
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
      options: { redirectTo: window.location.origin },
    });
  };

  const empezarDemo = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/registrar-demo", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("error_servidor");
      // Reintentar hasta 5 veces con 1.5s entre intentos hasta que verificar-acceso confirme la suscripción
      const { data: { session: s2 } } = await supabase.auth.getSession();
      let acceso = null;
      for(let i=0;i<5;i++){
        await new Promise(r=>setTimeout(r,1500));
        const vRes = await fetch("/api/verificar-acceso?login=true",{headers:{"Authorization":`Bearer ${s2?.access_token}`}});
        acceso = vRes.ok ? await vRes.json() : null;
        if(acceso?.tiene_acceso) break;
      }
      await handleUser(authUser);
    } catch {
      setError("Ocurrió un error. Intentá de nuevo.");
      setLoading(false);
    }
  };

  const email = authUser?.email || "";
  const nombre = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || "";

  if (pantalla === "registro") return (
    <div style={{minHeight:"100vh",background:"#FFF",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:380,textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>🏡</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:800,color:"#1C1C1E",marginBottom:8}}>
          {nombre ? `¡Hola, ${nombre.split(" ")[0]}!` : "Probá la app gratis"}
        </div>
        <div style={{fontSize:14,color:"#8B7355",marginBottom:28,lineHeight:1.6}}>
          28 días con todas las funciones del plan Profesional. Sin tarjeta.
        </div>
        {[
          { icon:"📅", texto:"Reservas y turnos ilimitados" },
          { icon:"🏡", texto:"Gestión de espacios y temporadas" },
          { icon:"💰", texto:"Control de ingresos y gastos" },
          { icon:"📲", texto:"Link público para tus clientes" },
          { icon:"🔔", texto:"Recordatorios automáticos" },
        ].map((f,i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,textAlign:"left"}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#FFF8F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,border:"1px solid #EDE0D0"}}>{f.icon}</div>
            <span style={{fontSize:13,color:"#6B7280"}}>{f.texto}</span>
            <span style={{marginLeft:"auto",color:"#C4602B",fontWeight:700}}>✓</span>
          </div>
        ))}
        <button onClick={empezarDemo} disabled={loading}
          style={{marginTop:24,width:"100%",padding:"14px 20px",background:loading?"#EDE0D0":"linear-gradient(135deg,#C4602B,#9E4A1E)",border:"none",borderRadius:12,cursor:loading?"not-allowed":"pointer",fontSize:15,fontWeight:700,color:"#FFF",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(196,96,43,0.3)",opacity:loading?0.7:1}}>
          {loading ? "Activando prueba..." : "Empezar prueba gratis"}
        </button>
        {error && <div style={{marginTop:10,color:"#DC2626",fontSize:12}}>{error}</div>}
        <button onClick={()=>supabase.auth.signOut().then(()=>setPantalla("login"))}
          style={{marginTop:14,background:"none",border:"none",color:"#9CA3AF",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
          Cerrar sesión ({email})
        </button>
      </div>
    </div>
  );

  if (pantalla === "demo_vencido") return (
    <SelectorPlanesMP
      orgId={orgIdBloqueo}
      titulo="Tu prueba gratuita venció"
      subtitulo="Activá un plan para seguir gestionando tus reservas y espacios."
      onSignOut={() => setPantalla("login")}
    />
  );

  if (pantalla === "impago") return (
    <SelectorPlanesMP
      orgId={orgIdBloqueo}
      titulo="⏳ Suscripción vencida"
      subtitulo="Regularizá tu pago para reactivar el acceso a tu cuenta."
      onSignOut={() => setPantalla("login")}
    />
  );

  if (pantalla === "suspendido") return (
    <SelectorPlanesMP
      orgId={orgIdBloqueo}
      titulo="🔒 Cuenta suspendida"
      subtitulo="Reactivá tu suscripción para recuperar el acceso."
      onSignOut={() => setPantalla("login")}
    />
  );

  if (pantalla === "cancelado") return (
    <SelectorPlanesMP
      orgId={orgIdBloqueo}
      titulo="Suscripción cancelada"
      subtitulo="Tu suscripción fue cancelada. Elegí un plan para volver a acceder."
      onSignOut={() => setPantalla("login")}
    />
  );

  return (
    <div style={{minHeight:"100vh",background:"#FFF",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:380,textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>🏡</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:800,color:"#1C1C1E",marginBottom:4}}>Gestión de Espacios</div>
        <div style={{fontSize:14,color:"#8B7355",marginBottom:40}}>Iniciá sesión para continuar</div>
        {error && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",marginBottom:20,color:"#DC2626",fontSize:13}}>{error}</div>}
        <button onClick={handleGoogleLogin} disabled={loading}
          style={{width:"100%",padding:"14px 20px",background:loading?"#F3F4F6":"#FFF",border:"1.5px solid #E5E7EB",borderRadius:12,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:15,fontWeight:600,color:"#1C1C1E",fontFamily:"inherit",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",transition:"all 0.2s"}}>
          {loading ? <span style={{color:"#8B7355"}}>Verificando acceso...</span> : (
            <><svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>Iniciar sesión con Google</>
          )}
        </button>
        <div style={{marginTop:16,fontSize:12,color:"#D1D5DB"}}>Ingresá con tu Gmail para probar la app gratis por 28 días</div>
      </div>
    </div>
  );
}

const ICONOS_OB = ["📌","☀️","🌤️","🌆","🌙","⚽","🎾","🏊","🎉","🎪","🍖","🎸","💅","🏋️","🎭","🏠"];

function OnboardingWizard({ onFinish, userName }) {
  // Persiste estado en sessionStorage para sobrevivir un refresh accidental
  const _loadWiz = () => { try { const s=sessionStorage.getItem("qb_wizard"); return s?JSON.parse(s):null; } catch(e){return null;} };
  const _saveWiz = (data) => { try { sessionStorage.setItem("qb_wizard", JSON.stringify(data)); } catch(e){} };
  const _clearWiz = () => { try { sessionStorage.removeItem("qb_wizard"); } catch(e){} };

  const saved = _loadWiz();
  const [step, setStepRaw] = useState(saved?.step||1);
  const [negocio, setNegocioRaw] = useState(saved?.negocio||{ nombreNegocio:"", ciudad:"", direccion:"", telefono:"" });
  const [espacio, setEspacioRaw] = useState(saved?.espacio||{ nombre:"", capacidadMax:"", modo:"fijo" });
  const [turnos, setTurnos] = useState(saved?.turnos||[]);
  const [turnoForm, setTurnoForm] = useState({ nombre:"", horaInicio:"", horaFin:"", precioSemana:"", precioFinde:"", icono:"📌" });
  const [slotCfg, setSlotCfgRaw] = useState(saved?.slotCfg||{ horaInicio:"08:00", horaFin:"22:00", duracion:60, intervalo:0, precioSemana:"", precioFinde:"" });
  const [saving, setSaving] = useState(false);

  const persist = (patch) => {
    const next = { step, negocio, espacio, turnos, slotCfg, ...patch };
    _saveWiz(next);
  };
  const setStep = (v) => { setStepRaw(v); persist({ step: v }); };
  const setNegocio = (fn) => setNegocioRaw(prev => { const next=typeof fn==="function"?fn(prev):fn; persist({negocio:next}); return next; });
  const setEspacio = (fn) => setEspacioRaw(prev => { const next=typeof fn==="function"?fn(prev):fn; persist({espacio:next}); return next; });
  const setSlotCfg = (fn) => setSlotCfgRaw(prev => { const next=typeof fn==="function"?fn(prev):fn; persist({slotCfg:next}); return next; });

  const inpS = {padding:"10px 12px",borderRadius:10,border:"1.5px solid #EDE0D0",fontSize:14,fontFamily:"inherit",width:"100%",boxSizing:"border-box",outline:"none",background:"#FFF"};
  const lblS = {fontSize:12,fontWeight:700,color:"#5C4033",textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:4};

  const addTurno = () => {
    if(!turnoForm.nombre||!turnoForm.horaInicio||!turnoForm.horaFin) return showToast("Completá nombre, hora inicio y hora fin.","warn");
    setTurnos(prev=>[...prev,{...turnoForm}]);
    setTurnoForm({nombre:"",horaInicio:"",horaFin:"",precioSemana:"",precioFinde:"",icono:"📌"});
  };

  const steps = ["Tu negocio","Tu espacio","Turnos"];

  return (
    <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#FDF5EE,#FFF8F3)",zIndex:9999,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
      <div style={{width:"100%",maxWidth:440,margin:"0 auto",padding:20,paddingBottom:40}}>

        {/* Banner de bienvenida */}
        <div style={{background:"linear-gradient(135deg,#C4602B,#E8855A)",borderRadius:14,padding:"20px 24px",marginBottom:20,textAlign:"center",boxShadow:"0 4px 16px rgba(196,96,43,0.25)"}}>
          <div style={{fontSize:32,marginBottom:6}}>🎉</div>
          <div style={{fontSize:19,fontWeight:800,color:"#FFF",marginBottom:4}}>
            {userName ? `¡Bienvenido/a, ${userName.split(' ')[0]}!` : '¡Bienvenido/a!'}
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.9)",lineHeight:1.6}}>
            Tu prueba gratuita de <strong>28 días</strong> del plan Profesional ya está activa.<br/>
            Configurá tu negocio en 3 pasos y empezá a gestionar tus eventos.
          </div>
        </div>

        {/* Logo / título */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:8}}>🏡</div>
          <div style={{fontSize:22,fontWeight:800,color:"#C4602B",fontFamily:"'Playfair Display',serif"}}>App-Eventos</div>
          <div style={{fontSize:13,color:"#8B7355",marginTop:4}}>Configurá tu negocio en 3 pasos</div>
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
              <button onClick={()=>{ if(!negocio.nombreNegocio.trim()) return showToast("Ingresá el nombre de tu negocio.","warn"); setStep(2); }}
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
                <button onClick={()=>{ if(!espacio.nombre.trim()) return showToast("Ingresá el nombre del espacio.","warn"); setStep(3); }}
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
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Duración del turno</div>
                      <select style={inpS} value={slotCfg.duracion} onChange={e=>setSlotCfg(p=>({...p,duracion:Number(e.target.value)}))}>
                        {[30,45,60,90,120].map(m=><option key={m} value={m}>{m} min</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Intervalo entre turnos</div>
                      <select style={inpS} value={slotCfg.intervalo} onChange={e=>setSlotCfg(p=>({...p,intervalo:Number(e.target.value)}))}>
                        <option value={0}>Sin intervalo</option>
                        <option value={5}>5 min</option>
                        <option value={10}>10 min</option>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                      </select>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio lun–vie ($)</div><input type="number" style={inpS} value={slotCfg.precioSemana} onChange={e=>setSlotCfg(p=>({...p,precioSemana:e.target.value}))} placeholder="0" /></div>
                    <div><div style={{fontSize:11,color:"#8B7355",marginBottom:3}}>Precio sáb–dom ($)</div><input type="number" style={inpS} value={slotCfg.precioFinde} onChange={e=>setSlotCfg(p=>({...p,precioFinde:e.target.value}))} placeholder="0" /></div>
                  </div>
                  <div style={{background:"#F0FDF4",borderRadius:8,padding:"10px 12px",border:"1px solid #BBF7D0",fontSize:12,color:"#166534"}}>
                    ✓ Turnos de {slotCfg.duracion} min{slotCfg.intervalo>0?` + ${slotCfg.intervalo} min intervalo`:""} entre las {slotCfg.horaInicio} y las {slotCfg.horaFin}
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
                  {turnoForm.show ? (
                    <div style={{background:"#FDF5EE",borderRadius:10,padding:12,border:"1px dashed #C4602B",marginBottom:10}}>
                      <input style={{...inpS,marginBottom:8,fontSize:13}} placeholder="Nombre (ej: Noche, Turno 20hs)" value={turnoForm.nombre} onChange={e=>setTurnoForm(p=>({...p,nombre:e.target.value}))} autoFocus />
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
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setTurnoForm(p=>({...p,show:false}))} style={{flex:1,padding:"8px",background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:8,color:"#8B7355",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                        <button onClick={addTurno} style={{flex:2,padding:"8px",background:"#C4602B",border:"none",borderRadius:8,color:"#FFF",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={()=>setTurnoForm(p=>({...p,show:true}))}
                      style={{width:"100%",padding:"10px",background:"#FDF8F3",border:"1.5px dashed #C4602B",borderRadius:10,color:"#C4602B",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
                      + Agregar turno
                    </button>
                  )}
                  <div style={{textAlign:"center",marginBottom:6,fontSize:11,color:"#8B7355"}}>
                    {turnos.length===0 ? "Podés agregar turnos ahora o hacerlo después desde Configuración." : `${turnos.length} turno${turnos.length!==1?"s":""} agregado${turnos.length!==1?"s":""}`}
                  </div>
                </>
              )}

              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(2)} style={{flex:1,padding:12,background:"#FFF",border:"1.5px solid #EDE0D0",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:"#8B7355"}}>← Atrás</button>
                <button onClick={async()=>{
                  setSaving(true);
                  await onFinish({negocio,espacio,turnos,slotCfg});
                  _clearWiz();
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
  // Escalabilidad: guard contra cargas duplicadas y cache de 3 min
  const _loadingRef = useRef(false);
  const _lastFetchRef = useRef(0);
  const FETCH_TTL = 3 * 60 * 1000;
  const [checkTick,setCheckTick]=useState(0);
  const [inactivityWarning,setInactivityWarning]=useState(false);
  const [alertaActiva,setAlertaActiva]=useState(null);
  const [shownAlerts,setShownAlerts]=useState(new Set());
  const [showRootMenu,setShowRootMenu]=useState(false);
  const isDesktop = useIsDesktop();

  const [clientes,setClientes]=useState([]);
  const [reservas,setReservas]=useState([]);
  const [pagos,setPagos]=useState([]);
  const [gastos,setGastos]=useState([]);
  const [recursos,setRecursos]=useState([]);
  const [turnosRecurso,setTurnosRecurso]=useState([]);
  const [temporadasPrecio,setTemporadasPrecio]=useState([]);
  const [preciosTemporada,setPreciosTemporada]=useState([]);
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

  const [negocio,setNegocio]=useState({ nombreNegocio:"", ciudad:"", direccion:"", telefono:"", logoUrl:"", msgRecordatorio:"", msgPostEvento:"", recordatorioActivo:true, postEventoActivo:true, condicionesEmail:"", fotosLugar:[] });
  const [onboarding,setOnboarding]=useState(false); // wizard primer uso
  const [usuarios,setUsuarios]=useState([]);
  const [perfilesUsuarios,setPerfilesUsuarios]=useState([]);
  const [currentUser,setCurrentUser]=useState(null);
  const [bloqueadoMotivo,setBloqueadoMotivo]=useState(null);
  // Roles desactivados: todos los usuarios de una org tienen acceso completo. Si se implementan roles, reemplazar por lookup real.
  const isAdmin = true;
  const [tareas,setTareas]=useState([]);
  const [bloqueos,setBloqueos]=useState([]);
  const [recordatorios,setRecordatorios]=useState([]);
  const [comunicaciones,setComunicaciones]=useState([]);
  const [consultas,setConsultas]=useState([]);
  const [mercadoProductos,setMercadoProductos]=useState([]);
  const [mercadoPedidos,setMercadoPedidos]=useState([]);
  const [bloqueoModal,setBloqueoModal]=useState(null);
  const [showBriefing,setShowBriefing]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [tier2Loading,setTier2Loading]=useState(false);
  const [nuevaVersion,setNuevaVersion]=useState(false);

  // Mostrar onboarding cuando no hay espacios (primer uso o los borró todos)
  useEffect(()=>{ if(loaded && currentUser && !onboarding && recursos.length===0) setOnboarding(true); },[loaded,currentUser,recursos.length]);

  // Briefing diario: mostrar una vez por día después de las 7am
  useEffect(()=>{ if(loaded && currentUser && shouldShowBriefing()) setShowBriefing(true); },[loaded,currentUser]);

  // Ping de presencia cada 5 minutos para mantener ultimo_acceso actualizado en el SaaS
  useEffect(()=>{
    if(!currentUser) return;
    const ping = async () => {
      const { data:{ session } } = await supabase.auth.getSession();
      if(!session?.access_token) return;
      fetch(`/api/verificar-acceso`,{ headers:{ Authorization:`Bearer ${session.access_token}` } }).catch(()=>{});
    };
    const t = setInterval(ping, 5*60*1000);
    return () => clearInterval(t);
  },[currentUser?.email]);

  // Detectar sesión expirada mientras la app está abierta
  useEffect(()=>{
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event) => {
      if(event === "SIGNED_OUT") {
        setCurrentUser(prev => {
          if(prev) {
            lsRemove("qb_user");
            showToast("Tu sesión expiró. Por favor, iniciá sesión nuevamente.","error");
          }
          return null;
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Detectar nueva versión del PWA (SW actualizado)
  useEffect(()=>{
    if(!('serviceWorker' in navigator)) return;
    const onControllerChange = () => setNuevaVersion(true);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  useEffect(()=>{
    (async()=>{
    try {
      // ── PASO 1: verificar sesión Supabase ──
      const { data:{ session } } = await supabase.auth.getSession();
      var cu=null; try{const s=lsGet("qb_user");if(s)cu=JSON.parse(s);}catch(e){}

      if(!session?.user){ lsRemove("qb_user"); return; }
      if(cu?.email && cu.email !== session.user.email){ lsRemove("qb_user"); cu=null; }
      if(!cu?.email) return;

      // ── PASO 2: verificar suscripción en central ──
      let accesoArr, accesoError;
      try {
        const res = await Promise.race([
          fetch(`/api/verificar-acceso?email=${encodeURIComponent(cu.email)}`,{ headers:{ Authorization:`Bearer ${session?.access_token}` } }).then(r=>r.json()),
          new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),8000))
        ]);
        accesoArr = res.tiene_acceso !== undefined ? [res] : res; accesoError = res.error ?? null;
      } catch(e) { accesoError = e; }

      const acceso = Array.isArray(accesoArr) ? accesoArr[0] : accesoArr;

      // Si hubo error de red/timeout y hay sesión cacheada, continuar sin bloquear
      if(accesoError || !acceso) {
        if(cu?.suscripcionEstado === "activo" || cu?.suscripcionEstado === "sincargo" || cu?.suscripcionEstado === "demo") {
          // Usar datos cacheados y seguir
          const orgId = cu.orgId;
          setCurrentOrgId(orgId);
          setCurrentUser(cu);
          await cargarDatos(orgId, true);
          setLoaded(true);
          return;
        }
      }

      if(!acceso?.tiene_acceso || acceso.estado==="impago" || acceso.estado==="suspendido"){
        lsRemove("qb_user");
        await supabase.auth.signOut();
        setBloqueadoMotivo(acceso?.motivo || acceso?.estado || "sin_suscripcion");
        setLoaded(true);
        return;
      }

      // ── PASO 3: configurar org y cargar datos ──
      const orgId = acceso.ret_org_id || cu.orgId;
      setCurrentOrgId(orgId);

      // Sincronizar user_orgs y refrescar JWT para que RLS funcione con el org_id correcto
      const planActual = acceso.plan || cu.plan || "basico";
      await Promise.all([
        supabase.from("user_orgs").upsert({ user_id: session.user.id, org_id: orgId }),
        // Sincronizar plan en app DB para que get_my_plan() funcione en RLS policies
        supabase.from("config").upsert({ org_id: orgId, plan: planActual }, { onConflict: "org_id" }),
      ]);
      await supabase.auth.refreshSession();

      const user = { ...cu, orgId, plan: acceso.plan || cu.plan || "basico", suscripcionEstado: acceso.estado, diasRestantes: acceso.dias_restantes ?? null };
      setCurrentUser(user);
      lsSet("qb_user", JSON.stringify(user));

      await cargarDatos(orgId, true);

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

  // Verificación periódica de plan (cada 30 min) — detecta downgrades/suspensiones en sesión activa
  useEffect(()=>{
    if(!currentUser?.email) return;
    const check = async () => {
      try {
        const { data:{ session } } = await supabase.auth.getSession();
        const r = await fetch(`/api/verificar-acceso?email=${encodeURIComponent(currentUser.email)}`,{ headers:{ Authorization:`Bearer ${session?.access_token}` } });
        const accesoRaw = await r.json();
        const acceso = Array.isArray(accesoRaw)?accesoRaw[0]:accesoRaw;
        if(!acceso?.tiene_acceso || acceso.estado==="impago" || acceso.estado==="suspendido"){
          lsRemove("qb_user");
          await supabase.auth.signOut();
          setBloqueadoMotivo(acceso?.estado||"sin_suscripcion");
          setCurrentUser(null);
          return;
        }
        // Actualizar plan/estado si cambió
        if(acceso.plan!==currentUser.plan || acceso.estado!==currentUser.suscripcionEstado){
          const updated={...currentUser,plan:acceso.plan,suscripcionEstado:acceso.estado,diasRestantes:acceso.dias_restantes??null};
          setCurrentUser(updated);
          lsSet("qb_user",JSON.stringify(updated));
          // Sincronizar plan en app DB para que RLS de extras_reserva refleje el cambio
          await supabase.from("config").upsert({org_id:currentUser.orgId,plan:acceso.plan},{onConflict:"org_id"});
          showToast(`Plan actualizado a ${acceso.plan}`,"info");
        }
      } catch(e){ /* silencioso — central puede estar temporalmente caída */ }
    };
    const id = setInterval(check, 30*60*1000); // cada 30 minutos
    return () => clearInterval(id);
  },[currentUser?.email]);

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
    const needsRating=current.filter(r=>r.estado==='finalizada'&&!r.calificacion&&r.clienteId&&!snoozedRatings.has(r.id)&&recursos.find(rc=>rc.id===r.recursoId)?.calificacionActiva!==false);
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
    const WARNING_MS = 28*60*1000;
    const updateActivity = () => { lastActivityRef.current = Date.now(); setInactivityWarning(false); };
    window.addEventListener('click', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('keydown', updateActivity);

    const onVisible = () => {
      if(document.visibilityState === 'visible') {
        if(Date.now() - lastActivityRef.current > INACTIVITY_MS) {
          handleLogout();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    let tickCount=0;
    const interval=setInterval(()=>{
      setCheckTick(t=>t+1);
      const elapsed = Date.now() - lastActivityRef.current;
      if(elapsed > INACTIVITY_MS) {
        handleLogout();
      } else if(elapsed > WARNING_MS) {
        setInactivityWarning(true);
      }
      // Re-verificar suscripción cada hora (60 ticks × 60s)
      tickCount++;
      if(tickCount>=60){
        tickCount=0;
        const email=currentUser?.email;
        if(email){
          supabase.auth.getSession().then(({data:{session}})=>{
            fetch(`/api/verificar-acceso?email=${encodeURIComponent(email)}`,{ headers:{ Authorization:`Bearer ${session?.access_token}` } })
              .then(r=>r.json()).then(acceso=>{
                if(!acceso?.tiene_acceso||acceso.estado==="impago"||acceso.estado==="suspendido"){
                  handleLogout();
                }
              });
          });
        }
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

  const cargarDatos=async(orgId, force=false)=>{
    // Guard: previene dos cargas simultáneas (doble login rápido, doble mount)
    if(_loadingRef.current) return;
    // Cache: si se cargó hace menos de 3 min, saltar (a menos que sea force)
    if(!force && _lastFetchRef.current && Date.now()-_lastFetchRef.current < FETCH_TTL) return;
    _loadingRef.current = true;
    try {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-18);
    const cutoffStr = cutoff.toISOString().slice(0,10);

    // ── TIER 1: crítico — lo que el usuario ve en InicioView ─────
    // Se awaita antes de mostrar la app (setLoaded lo llama el caller)
    const _t1=await Promise.allSettled([
      supabase.from("recursos").select("*").eq("org_id",orgId).is("deleted_at",null).order("creado_en",{ascending:true}).limit(50),
      supabase.from("turnos_recurso").select("*").eq("org_id",orgId).eq("activo",true).order("hora_inicio",{ascending:true}).limit(500),
      supabase.from("reservas").select("*").eq("org_id",orgId).gte("fecha",cutoffStr).order("fecha",{ascending:true}).limit(2000),
      supabase.from("clientes").select("*").eq("org_id",orgId).is("deleted_at",null).order("creado_en",{ascending:true}).limit(2000),
      supabase.from("config").select("*").eq("org_id",orgId).maybeSingle(),
    ]);
    const _t1d=(i)=>_t1[i].status==="fulfilled"?_t1[i].value?.data:null;
    const [rc,tr,r,c,cfgRaw]=[0,1,2,3,4].map(_t1d);
    if(rc?.length) setRecursos(rc.map(x=>({id:x.id,nombre:x.nombre||"",capacidadMax:x.capacidad_max||0,modo:x.modo||"fijo",slotDuracionMin:x.slot_duracion_min||60,slotHoraInicio:x.slot_hora_inicio||"08:00",slotHoraFin:x.slot_hora_fin||"22:00",slotIntervaloMin:x.slot_intervalo_min||0,calificacionActiva:x.calificacion_activa!==false,orgId:x.org_id})));
    if(tr?.length) setTurnosRecurso(tr.map(x=>({id:x.id,recursoId:x.recurso_id,orgId:x.org_id,nombre:x.nombre||"",icono:x.icono||"📌",horaInicio:x.hora_inicio||"",horaFin:x.hora_fin||"",precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:x.activo!==false})));
    if(r?.length) setReservas(r.map(x=>({id:x.id,clienteId:x.cliente_id||"",recursoId:x.recurso_id||"",turnoId:x.turno_id||null,fecha:x.fecha?.slice(0,10)||"",turno:x.turno||"",horario:x.horario||"",horarioFin:x.horario_fin||"",cantInvitados:x.cant_invitados||35,montoPactado:Number(x.monto_pactado)||0,estado:x.estado||"pendiente",notas:x.notas||"",creadoPor:x.creado_por||"",creadoEn:x.creado_en,fechaCreacion:x.fecha_creacion||"",recordatorioEnviado:!!x.recordatorio_enviado,postEventoProcesado:!!x.post_evento_procesado,calificacion:x.calificacion||null,proximoPagoFecha:x.proximo_pago_fecha||null,proximoPagoMonto:x.proximo_pago_monto?Number(x.proximo_pago_monto):null,tipoEvento:x.tipo_evento||null,fechaVisita:x.fecha_visita||null,horaVisita:x.hora_visita||null,seguimientoDescartado:!!x.seguimiento_descartado,motivoNoConcreto:x.motivo_no_concreto||null,nombreEvento:x.nombre_evento||null,shareToken:x.share_token||null,shareSections:x.share_sections||null,shareMessage:x.share_message||null,shareTheme:x.share_theme||"verde",shareHeroUrl:x.share_hero_url||null,regaloDescuento:x.regalo_descuento||null,regaloEnviadoEn:x.regalo_enviado_en||null,sobreDigital:x.sobre_digital||null,editToken:x.edit_token||null,mercadoActivo:!!x.mercado_activo})));
    if(c?.length) setClientes(c.map(x=>({id:x.id,nombre:x.nombre||"",apellido:x.apellido||"",whatsapp:x.whatsapp||"",email:x.email||"",localidad:x.localidad||"",notasInternas:x.notas_internas||"",estadoCrm:x.estado_crm||null,origen:x.origen||null,creadoEn:x.creado_en})));
    const cfgData=cfgRaw && !Array.isArray(cfgRaw)?cfgRaw:null;
    if(cfgData) setNegocio({nombreNegocio:cfgData.nombre_negocio||"",ciudad:cfgData.ciudad||"",direccion:cfgData.direccion||"",telefono:cfgData.telefono||"",logoUrl:cfgData.logo_url||"",msgRecordatorio:cfgData.msg_recordatorio||MSG_REC_DEFAULT,msgPostEvento:cfgData.msg_post_evento||MSG_POST_DEFAULT,recordatorioActivo:cfgData.recordatorio_activo!==false,postEventoActivo:cfgData.post_evento_activo!==false,condicionesEmail:cfgData.condiciones_email||"",googleReviewUrl:cfgData.google_review_url||"",wifiPassword:cfgData.wifi_password||"",portalActivo:cfgData.portal_activo!==false,fotosLugar:cfgData.fotos_lugar||[]});
    if(!rc?.length && orgId) setOnboarding(true);

    // ── TIER 2: diferido — carga en background sin bloquear el render ─
    setTier2Loading(true);
    Promise.allSettled([
      supabase.from("pagos").select("*").eq("org_id",orgId).gte("fecha",cutoffStr).order("creado_en",{ascending:true}).limit(3000),
      supabase.from("gastos").select("*").eq("org_id",orgId).gte("fecha",cutoffStr).order("fecha",{ascending:false}).limit(1000),
      supabase.from("extras_reserva").select("*").eq("org_id",orgId).order("creado_en",{ascending:true}).limit(3000),
      supabase.from("servicios_extras").select("*").eq("org_id",orgId).eq("activo",true).order("creado_en",{ascending:true}).limit(200),
      supabase.from("tareas").select("*").eq("org_id",orgId).order("creado_en",{ascending:false}).limit(200),
      supabase.from("bloqueos").select("*").eq("org_id",orgId).gte("fecha",cutoffStr).order("fecha",{ascending:true}).limit(500),
      supabase.from("recordatorios").select("*").eq("org_id",orgId).neq("estado","Procesado").order("fecha_alerta",{ascending:true}).limit(200),
      supabase.from("temporadas_precio").select("*").eq("org_id",orgId).order("mes_desde",{ascending:true}).limit(100),
      supabase.from("comunicaciones").select("*").eq("org_id",orgId).order("creado_en",{ascending:false}).limit(500),
      supabase.from("consultas").select("*").eq("org_id",orgId).gte("fecha",cutoffStr).order("fecha",{ascending:false}).limit(1000),
      supabase.from("mercado_productos").select("*").eq("org_id",orgId).order("orden",{ascending:true}).limit(10),
      supabase.from("mercado_pedidos").select("*").eq("org_id",orgId).gte("creado_en",cutoffStr).order("creado_en",{ascending:false}).limit(500),
    ]).then(async _t2=>{
      const _t2d=(i)=>_t2[i].status==="fulfilled"?_t2[i].value?.data:null;
      const [p,g,er,se,t,bl,rec,tmp,com,cns,mprod,mped]=[0,1,2,3,4,5,6,7,8,9,10,11].map(_t2d);
      if(p?.length) setPagos(p.map(x=>({id:x.id,reservaId:x.reserva_id||"",monto:Number(x.monto)||0,fecha:x.fecha?.slice(0,10)||"",metodo:x.metodo||"Transferencia",notas:x.notas||"",comprobante:x.comprobante||"",creadoPor:x.creado_por||"",creadoEn:x.creado_en})));
      if(g?.length) setGastos(g.map(x=>({id:x.id,concepto:x.concepto||"",monto:Number(x.monto)||0,fecha:x.fecha?.slice(0,10)||"",categoria:x.categoria||"Otros",metodo:x.metodo||"Efectivo",creadoPor:x.creado_por||""})));
      if(er?.length) setExtrasReserva(er.map(x=>({id:x.id,reservaId:x.reserva_id||"",servicioId:x.servicio_id||"",descripcion:x.descripcion||"",cantidad:x.cantidad||1,precioHistorico:Number(x.precio_historico)||0})));
      setServiciosExtras(se?.length ? se.map(x=>({id:x.id,descripcion:x.descripcion||"",precioActual:Number(x.precio_actual)||0,activo:x.activo!==false,detalle:x.detalle||"",fotoUrl:x.foto_url||"",grupo:x.grupo||""})) : []);
      if(t?.length) setTareas(t.map(x=>({id:x.id,descripcion:x.descripcion||"",estado:x.estado||"pendiente",fechaRegistro:x.fecha_registro||""})));
      if(bl?.length) setBloqueos(bl.map(x=>({id:x.id,fecha:x.fecha?.slice(0,10)||"",turno:x.turno||"completo",motivo:x.motivo||"",creadoPor:x.creado_por||""})));
      if(rec?.length) setRecordatorios(rec.map(x=>({id:x.id,reservaId:x.reserva_id||"",clienteId:x.cliente_id||"",tipo:x.tipo||"",nota:x.nota||"",fechaAlerta:x.fecha_alerta?.slice(0,10)||"",horaAlerta:x.hora_alerta||"09:00",estado:x.estado||"Pendiente"})));
      if(com?.length) setComunicaciones(com.map(x=>({id:x.id,tipo:x.tipo||"",asunto:x.asunto||"",clienteId:x.cliente_id||"",reservaId:x.reserva_id||"",destino:x.destino||"",creadoPor:x.creado_por||"",creadoEn:x.creado_en})));
      if(cns?.length) setConsultas(cns.map(x=>({id:x.id,fecha:x.fecha?.slice(0,10)||"",canal:x.canal||"Otro",cantidad:x.cantidad||1,creadoEn:x.creado_en})));
      if(mprod?.length) setMercadoProductos(mprod.map(x=>({id:x.id,nombre:x.nombre||"",emoji:x.emoji||"📦",precio:Number(x.precio)||0,orden:x.orden||0,activo:x.activo!==false,creadoEn:x.creado_en})));
      if(mped?.length) setMercadoPedidos(mped.map(x=>({id:x.id,reservaId:x.reserva_id||"",productoNombre:x.producto_nombre||"",productoEmoji:x.producto_emoji||"📦",cantidad:x.cantidad||1,precioUnitario:Number(x.precio_unitario)||0,total:Number(x.total)||0,estado:x.estado||"pendiente",creadoEn:x.creado_en})));
      if(tmp?.length){
        setTemporadasPrecio(tmp.map(x=>({id:x.id,orgId:x.org_id,recursoId:x.recurso_id,nombre:x.nombre||"Temporada",mesDesde:x.mes_desde,diaDesde:x.dia_desde,mesHasta:x.mes_hasta,diaHasta:x.dia_hasta})));
        const {data:ptData}=await supabase.from("precios_temporada").select("*").in("temporada_id",tmp.map(t=>t.id));
        if(ptData?.length) setPreciosTemporada(ptData.map(x=>({id:x.id,temporadaId:x.temporada_id,turnoId:x.turno_id,precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:x.activo!==false})));
      }
      const _t2failed=_t2.filter(x=>x.status==="rejected").length;
      if(_t2failed>0) showToast(`${_t2failed} sección(es) secundaria(s) no cargaron. Recargá si falta información.`,"error");
      setTier2Loading(false);
    }).catch(()=>{ setTier2Loading(false); });
    } finally {
      _loadingRef.current = false;
      _lastFetchRef.current = Date.now();
    }
  };

  const handleLogin=async(user)=>{
    setCurrentOrgId(user.orgId);
    lsSet("qb_user",JSON.stringify(user));
    // Cargar datos ANTES de setCurrentUser para que el efecto de onboarding
    // no vea recursos vacíos y dispare el wizard prematuramente
    if(user.orgId) await cargarDatos(user.orgId, true);
    setCurrentUser(user);
  };
  const handleLogout=async()=>{
    try{ await supabase.auth.signOut(); }catch(e){}
    // Limpiar cache y estado para que el próximo login arranque limpio
    _lastFetchRef.current = 0;
    _loadingRef.current = false;
    setCurrentUser(null);
    // Resetear todos los datos para evitar flash de datos ajenos en dispositivos compartidos
    setClientes([]); setReservas([]); setPagos([]); setGastos([]);
    setRecursos([]); setTurnosRecurso([]); setExtrasReserva([]);
    setServiciosExtras(DEFAULT_SERVICIOS); setTareas([]); setBloqueos([]);
    setRecordatorios([]); setTemporadasPrecio([]); setPreciosTemporada([]);
    setNegocio({ nombreNegocio:"", ciudad:"", direccion:"", telefono:"", logoUrl:"", msgRecordatorio:"", msgPostEvento:"", recordatorioActivo:true, postEventoActivo:true, portalActivo:true, fotosLugar:[] });
    lsRemove("qb_user");
    lsRemove("qb_access_token");
    lsRemove(`sb-${SUPA_URL.split("//")[1].split(".")[0]}-auth-token`);
  };
  const saveConfig=async(cfg)=>{
    setConfig(cfg);
    lsSet("quincho_config",JSON.stringify(cfg));
    await supabase.from("config").upsert({org_id:getCurrentOrgId(),precios:cfg.precios,actualizado_en:new Date().toISOString()},{onConflict:"org_id"});
  };
  const removeUsuario = async id => { await sb.remove("usuarios", id); setUsuarios(u=>u.filter(x=>x.id!==id)); };
  const saveC =async d=>{const prev=clientes;setClientes(d);const r=await sb.upsert("clientes",d.map(mapCliente));if(!r){setClientes(prev);showToast("Error al guardar cliente. Intentá de nuevo.","error");}};
  const saveR =async d=>{const prev=reservas;setReservas(d);const r=await sb.upsert("reservas",d.map(mapReserva));if(!r){setReservas(prev);showToast(getUltimoError()||"Error al guardar reserva. Intentá de nuevo.","error");}};
  const saveP =async d=>{const prev=pagos;setPagos(d);const r=await sb.upsert("pagos",d.map(mapPago));if(!r){setPagos(prev);showToast(getUltimoError()||"Error al guardar pago. Intentá de nuevo.","error");}};
  const saveG =async d=>{const prev=gastos;setGastos(d);const r=await sb.upsert("gastos",d.map(mapGasto));if(!r){setGastos(prev);showToast(getUltimoError()||"Error al guardar gasto. Intentá de nuevo.","error");}};
  const saveER=async d=>{const prev=extrasReserva;setExtrasReserva(d);const r=await sb.upsert("extras_reserva",d.map(mapExtra));if(!r){setExtrasReserva(prev);showToast(getUltimoError()||"Error al guardar extra. Intentá de nuevo.","error");}};
  const saveTareas=async d=>{const prev=tareas;setTareas(d);const r=await sb.upsert("tareas",d.map(mapTarea));if(!r){setTareas(prev);showToast(getUltimoError()||"Error al guardar tarea. Intentá de nuevo.","error");}};
  const saveCons=async d=>{const prev=consultas;setConsultas(d);const r=await sb.upsert("consultas",d.map(mapConsulta));if(!r){setConsultas(prev);showToast(getUltimoError()||"Error al guardar consultas. Intentá de nuevo.","error");}};
  const saveMercadoProductos=async d=>{const prev=mercadoProductos;setMercadoProductos(d);const r=await sb.upsert("mercado_productos",d.map(mapMercadoProducto));if(!r){setMercadoProductos(prev);showToast(getUltimoError()||"Error al guardar productos.","error");}};
  const removeMercadoProducto=async(id)=>{setMercadoProductos(prev=>prev.filter(p=>p.id!==id));const r=await sb.remove("mercado_productos",id);if(!r){showToast("Error al eliminar producto","error");}};
  const toggleMercadoReserva=async(reservaId,activo)=>{setReservas(prev=>prev.map(r=>r.id===reservaId?{...r,mercadoActivo:activo}:r));await supabase.from("reservas").update({mercado_activo:activo}).eq("id",reservaId);};
  const toggleMercadoProducto=async(prodId,activo)=>{setMercadoProductos(prev=>prev.map(p=>p.id===prodId?{...p,activo}:p));await supabase.from("mercado_productos").update({activo}).eq("id",prodId);};
  const removeTarea=async(id)=>{setTareas(prev=>prev.filter(t=>t.id!==id));const r=await sb.remove("tareas",id);if(!r){showToast("Error al eliminar tarea","error");}};
  const saveBloqueos=async d=>{const prev=bloqueos;setBloqueos(d);const r=await sb.upsert("bloqueos",d.map(mapBloqueo));if(!r){setBloqueos(prev);showToast(getUltimoError()||"Error al guardar bloqueo. Intentá de nuevo.","error");}};
  const saveRecordatorios=async d=>{const prev=recordatorios;setRecordatorios(d);const r=await sb.upsert("recordatorios",d.map(mapRecordatorio));if(!r){setRecordatorios(prev);showToast(getUltimoError()||"Error al guardar recordatorio. Intentá de nuevo.","error");}};

  const [savingReserva,setSavingReserva]=useState(false);
  const [savingPago,setSavingPago]=useState(false);
  const [savingGasto,setSavingGasto]=useState(false);
  const [editGasto,setEditGasto]=useState(null);
  const [savingExtra,setSavingExtra]=useState(false);
  const handleSaveReserva=async(data)=>{
    if(savingReserva) return;
    setSavingReserva(true);
    try{
      if(!editReserva){
        // Chequeo límite de reservas — verificación server-side (RPC) + fallback cliente
        const limiteServer = await verificarLimiteServidor("reserva");
        if(!limiteServer.permitido){
          showToast(`🔒 ${limiteServer.motivo||"Límite del plan alcanzado. Contactá al administrador."}`, "err");
          return;
        }
        // Fallback cliente (por si la RPC no existe aún)
        const limits = getPlanLimits(currentUser?.plan);
        if(limits.reservasMes !== null){
          const mesActual = toDateStr(new Date()).slice(0,7);
          const reservasMes = reservas.filter(r=>r.creadoEn?.slice(0,7)===mesActual && r.estado!=="cancelada").length;
          if(reservasMes >= limits.reservasMes){
            showToast(`Tu plan permite hasta ${limits.reservasMes} reservas por mes. Límite alcanzado.`, "error");
            return;
          }
        }
        const {data:dbConflicts}=await supabase.from("reservas").select("id,cliente_id,turno,turno_id,recurso_id").eq("fecha",data.fecha).eq("org_id",getCurrentOrgId()).neq("estado","cancelada");
        const conflict=dbConflicts?.find(r=>r.recurso_id===data.recursoId&&(
          data.turnoId
            ? (r.turno_id===data.turnoId || r.turno==="completo")
            : (r.turno===data.turno||r.turno==="completo"||data.turno==="completo"||!!r.turno_id)
        ));
        if(conflict){const c=clientes.find(x=>x.id===conflict.cliente_id);showToast("Conflicto: ya existe una reserva de "+clientName(c)+" en ese espacio, día y turno.","error");return;}
        const bloqueoConflict=bloqueos.find(b=>b.fecha===data.fecha&&(b.turno===data.turnoId||b.turno===data.turno||b.turno==="completo"||(data.turno==="completo"&&b.turno)));
        if(bloqueoConflict){showToast("Fecha bloqueada: "+bloqueoConflict.motivo+". Desbloqueala primero desde el calendario.","error");return;}
      }
      if(editReserva){
        await saveR(reservas.map(r=>r.id===editReserva.id?{...r,...data}:r));
      } else {
        const nuevaReserva={id:genId(),...data,shareToken:genId(),editToken:genId(),creadoEn:new Date().toISOString(),fechaCreacion:toDateStr(new Date()),creadoPor:currentUser?.nombre||"",recordatorioEnviado:false,postEventoProcesado:false};
        const {error:insErr}=await supabase.from("reservas").insert(mapReserva(nuevaReserva));
        if(insErr){
          if(insErr.code==="23505") return showToast("⚠️ Ya existe una reserva en ese espacio, día y turno. Alguien más acaba de tomarlo.","warn");
          const amigable=mensajeErrorGuardado(insErr);
          if(amigable) return showToast(amigable,"error");
          return showToast("Error al guardar la reserva: "+insErr.message,"error");
        }
        setReservas(prev=>[...prev,nuevaReserva]);

        // Mail de confirmación si el cliente tiene email y la reserva es Confirmada
        if(data.estado==="Confirmada" || data.estado==="confirmada"){
          supabase.from("clientes").select("nombre,apellido,email").eq("id",data.clienteId).single().then(({data:freshCli})=>{
            if(!freshCli?.email) return;
            const recurso = recursos.find(r=>r.id===data.recursoId);
            const turno = turnosRecurso.find(t=>t.id===data.turnoId);
            const totalPagos = data.sena ? Number(data.sena) : 0;
            supabase.auth.getSession().then(({data:{session}})=>{
            fetch("/api/mail-reserva", {
              method:"POST",
              headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},
              body: JSON.stringify({
                clienteEmail:   freshCli.email,
                clienteNombre:  [freshCli.nombre,freshCli.apellido].filter(Boolean).join(" "),
                negocioNombre:  negocio?.nombreNegocio || "",
                negocioLogo:    negocio?.logoUrl || "",
                negocioTelefono:negocio?.telefono || "",
                espacioNombre:  recurso?.nombre || data.turno || "",
                fecha:          data.fecha,
                turnoNombre:    turno?.nombre || data.turno || "",
                horaInicio:     turno?.horaInicio || "",
                horaFin:        turno?.horaFin || "",
                cantInvitados:  data.cantInvitados || "",
                tipoEvento:     data.tipoEvento || "",
                montoPactado:   data.montoPactado,
                sena:           totalPagos,
                saldo:          data.montoPactado - totalPagos,
                metodoPago:     data.metodoPago || "",
                notas:          data.notas || "",
                condiciones:    negocio?.condicionesEmail || "",
                eventoUrl:      negocio?.portalActivo!==false && nuevaReserva.shareToken ? (window.location.origin + "/evento/" + nuevaReserva.shareToken) : "",
              }),
            }).then(()=>{logCom("email","Confirmación de reserva",data.clienteId,nuevaReserva.id,freshCli.email);}).catch(()=>{});
            }).catch(()=>{});
          }).catch(()=>{});
        }
      }
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
    if(resCheck&&['cancelada','finalizada','visita'].includes(resCheck.estado)){showToast("No se puede registrar un pago en una reserva "+resCheck.estado+".","error");return;}
    if(resCheck){
      const yaP=pagos.filter(p=>p.reservaId===data.reservaId).reduce((s,p)=>s+p.monto,0);
      const totalEvCheck=resCheck.montoPactado+getTotalExtras(resCheck.id,extrasReserva);
      if(yaP+data.monto>totalEvCheck){showToast(`El pago de ${fmtCurrency(data.monto,"warn")} supera el total del evento (${fmtCurrency(totalEvCheck)}). Ya cobrado: ${fmtCurrency(yaP)}.`);return;}
    }
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
        // Auto-limpiar próximo pago si el cobro cubre el monto acordado
        const ppLimpiado = res.proximoPagoMonto && tot >= res.proximoPagoMonto;
        if(newEstado!==res.estado || ppLimpiado){
          saveR(reservas.map(r=>r.id===data.reservaId?{...r,estado:newEstado,...(ppLimpiado?{proximoPagoFecha:null,proximoPagoMonto:null}:{})}:r));
          if(newEstado==="senada"||newEstado==="confirmada"){
            supabase.from("clientes").select("nombre,apellido,email").eq("id",res.clienteId).single().then(({data:freshCli})=>{
              if(!freshCli?.email){ showToast("⚠️ Reserva "+newEstado+", pero el cliente no tiene mail registrado","warn"); return; }
              const recurso=recursos.find(r=>r.id===res.recursoId);
              const turno=turnosRecurso.find(t=>t.id===res.turnoId);
              supabase.auth.getSession().then(({data:{session:s}})=>{
              fetch("/api/mail-reserva",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s?.access_token}`},body:JSON.stringify({
                clienteEmail:freshCli.email,clienteNombre:[freshCli.nombre,freshCli.apellido].filter(Boolean).join(" "),
                negocioNombre:negocio?.nombreNegocio||"",negocioLogo:negocio?.logoUrl||"",negocioTelefono:negocio?.telefono||"",
                espacioNombre:recurso?.nombre||res.turno||"",fecha:res.fecha,
                turnoNombre:turno?.nombre||res.turno||"",horaInicio:turno?.horaInicio||"",horaFin:turno?.horaFin||"",
                cantInvitados:res.cantInvitados||"",montoPactado:res.montoPactado,
                sena:tot,saldo:res.montoPactado-tot,
                metodoPago:data.metodo||"",notas:res.notas||"",
                condiciones:negocio?.condicionesEmail||"",
                estado:newEstado,
                eventoUrl:negocio?.portalActivo!==false&&res.shareToken?(window.location.origin+"/evento/"+res.shareToken):"",
              })}).then(()=>{showToast("📧 Mail enviado a "+freshCli.email,"ok");logCom("email","Actualización de pago ("+newEstado+")",res.clienteId,res.id,freshCli.email);}).catch(()=>showToast("📧 Mail no se pudo enviar","error"));
              }).catch(()=>{});
            }).catch(()=>{ showToast("⚠️ Reserva "+newEstado+", pero no se pudo verificar el mail","warn"); });
          }
        }
      }
    }
    if(shouldPrint){
      var res2=reservas.find(r=>r.id===data.reservaId);
      var cli=clientes.find(c=>c.id===res2?.clienteId);
      var resExt=extrasReserva.filter(function(e){return e.reservaId===data.reservaId;});
      var resPag=newPagos.filter(function(p){return p.reservaId===data.reservaId;});
      var docData=printRecibo(newP,res2,cli,negocio,resExt,resPag);
      if(cli&&cli.whatsapp){
        var negNombre=negocio?.nombreNegocio||"nuestro negocio";
        var teWa=resExt.reduce(function(s,e){return s+(e.precioHistorico*e.cantidad);},0);
        var tpWa=resPag.reduce(function(s,p){return s+p.monto;},0);
        var saldoWa=res2?(res2.montoPactado+teWa)-tpWa:0;
        var waMsg="*🏠 Comprobante de Pago*\n*"+negNombre+"*\n\n"+
          "👤 "+clientName(cli)+"\n"+
          "📅 Evento: "+fmtDate(res2?res2.fecha:"")+(res2&&TURNOS[res2.turno]?" · "+TURNOS[res2.turno].label:"")+"\n"+
          "💰 *Cobrado: "+fmtCurrency(newP.monto)+"*\n"+
          "💳 Método: "+newP.metodo+"\n"+
          "📆 Fecha: "+fmtDate(newP.fecha)+"\n"+
          (saldoWa>0?"\n📊 Saldo pendiente: "+fmtCurrency(saldoWa)+"\n":"\n✅ *Cuenta saldada*\n")+
          "\n_Gracias por tu confianza_ 🙌";
        docData={...docData,waPhone:cli.whatsapp,waMsg:waMsg};
      }
      setPrintData(docData);
    }
    setModal(null);setPagoReservaId(null);
    }finally{setSavingPago(false);}
  };
  const handleSaveGasto=async(data)=>{
    if(savingGasto) return;
    setSavingGasto(true);
    try{
      if(editGasto){
        await saveG(gastos.map(g=>g.id===editGasto.id?{...editGasto,...data}:g));
        setEditGasto(null);
      } else {
        await saveG([...gastos,{id:genId(),...data,creadoEn:new Date().toISOString()}]);
      }
      setModal(null);
    } finally{ setSavingGasto(false); }
  };
  const handleDeleteGasto=async(gasto)=>{
    await sb.remove("gastos",gasto.id);
    setGastos(gastos.filter(g=>g.id!==gasto.id));
    showToast("Gasto eliminado","info");
  };
  const handleSaveConsultas=async(entries)=>{
    await saveCons([...consultas,...entries]);
    setModal(null);
    showToast(entries.reduce((s,e)=>s+e.cantidad,0)+" consultas registradas","ok");
  };
  const handleSaveExtra=async(data)=>{
    if(savingExtra) return;
    const res=reservas.find(r=>r.id===data.reservaId);
    if(res&&['cancelada','finalizada','visita'].includes(res.estado)){showToast("No se puede agregar un extra a una reserva en estado "+res.estado+".","error");return;}
    setSavingExtra(true);
    try{ await saveER([...extrasReserva,{id:genId(),...data,creadoEn:new Date().toISOString()}]); setModal(null); setExtraReservaId(null); }
    finally{ setSavingExtra(false); }
  };
  const handleDeleteReserva=async(id)=>{
    const prevReservas=reservas; const prevPagos=pagos; const prevExtras=extrasReserva;
    const {error}=await supabase.from("reservas").delete().eq("id",id);
    if(error){ showToast("Error al eliminar la reserva. Intentá de nuevo.","error"); return; }
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
    const conflict=reservas.find(r=>{
      if(r.fecha!==date||r.estado==="cancelada") return false;
      if(turno==="completo") return true; // bloquear día completo choca con cualquier reserva
      if(r.turno==="completo"||r.turnoId===null&&r.turno===turno) return true; // reserva cubre ese turno legacy
      if(r.turnoId===turno) return true; // reserva custom en ese slot
      // verificar solapamiento horario entre turnos custom
      const tA=turnosRecurso.find(t=>t.id===turno);
      const tB=turnosRecurso.find(t=>t.id===r.turnoId);
      if(tA&&tB){
        const toMin=s=>{const[h,m]=(s+":0").split(":");return Number(h)*60+Number(m||0);};
        return toMin(tA.horaInicio)<toMin(tB.horaFin)&&toMin(tB.horaInicio)<toMin(tA.horaFin);
      }
      return false;
    });
    if(conflict){const c=clientes.find(x=>x.id===conflict.clienteId);return showToast("No se puede bloquear: hay una reserva de "+clientName(c,"error")+" en ese turno.");}
    saveBloqueos([...bloqueos,{id:genId(),fecha:date,turno,motivo,creadoPor:currentUser?.nombre||"",creadoEn:new Date().toISOString()}]);
    setBloqueoModal(null);setDayModal(null);
  };
  const handleDesbloquear=async(bloqueoId)=>{
    await sb.remove("bloqueos", bloqueoId);
    setBloqueos(bloqueos.filter(b=>b.id!==bloqueoId));
    setBloqueoModal(null);setDayModal(null);
  };
  const logCom=async(tipo,asunto,clienteId,reservaId,destino)=>{
    const entry={id:genId(),tipo,asunto,clienteId:clienteId||null,reservaId:reservaId||null,destino:destino||"",creadoPor:currentUser?.nombre||"",creadoEn:new Date().toISOString()};
    setComunicaciones(prev=>[entry,...prev]);
    supabase.from("comunicaciones").insert({id:entry.id,org_id:getCurrentOrgId(),cliente_id:entry.clienteId,reserva_id:entry.reservaId,tipo,asunto,destino:entry.destino,creado_por:entry.creadoPor}).catch(()=>{});
  };
  const handleSaveRating=(reservaId, calificacion)=>{
    saveR(reservas.map(r=>r.id===reservaId?{...r,calificacion}:r));
    setRatingQueue(q=>q.filter(r=>r.id!==reservaId));
  };
  const handleDeleteCliente=async(id)=>{
    const cli=clientes.find(c=>c.id===id);
    if(!window.confirm(`¿Eliminar a ${cli?.nombre||"este cliente"}? Se borrarán sus pagos, extras y recordatorios. El historial de reservas se conserva.`)) return;
    const resIds=reservas.filter(r=>r.clienteId===id).map(r=>r.id);
    // 1. Borrar recordatorios del cliente y de sus reservas
    await supabase.from("recordatorios").delete().eq("cliente_id",id);
    if(resIds.length) await supabase.from("recordatorios").delete().in("reserva_id",resIds);
    // 2. Borrar pagos y extras de cada reserva
    if(resIds.length){
      await supabase.from("pagos").delete().in("reserva_id",resIds);
      await supabase.from("extras_reserva").delete().in("reserva_id",resIds);
    }
    // 3. Soft delete cliente (preserva historial de reservas, pagos y extras)
    const {error}=await supabase.from("clientes").update({deleted_at: new Date().toISOString()}).eq("id",id);
    if(error){ showToast("Error al eliminar el cliente: "+error.message,"error"); return; }
    // 4. Actualizar estado local (filtrar de vista, datos siguen en DB)
    setClientes(prev=>prev.filter(c=>c.id!==id));
    setDetailCliente(null);
    showToast("Cliente eliminado. El historial se preserva.","ok");
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
    <div style={{fontFamily:"'DM Sans', sans-serif",background:"#FDF8F3",minHeight:"100vh", ...(isDesktop ? {display:"flex",flexDirection:"row"} : {maxWidth:480,margin:"0 auto",position:"relative"})}}>
    {isDesktop && <DesktopNav negocio={negocio} onNavigate={setTab} tab={tab} currentUser={currentUser} onNewCobro={()=>{setPagoReservaId(null);setModal("pago");}} onNewGasto={()=>setModal("gasto")} onNewConsulta={()=>setModal("consultas")} onLogout={handleLogout} />}
    <div style={isDesktop ? {flex:1,minWidth:0,position:"relative",maxWidth:"calc(100% - 220px)"} : {}}>
      <style>{`
        /* fonts loaded via index.html preconnect + stylesheet link */
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:0;height:0;}
        input,select,textarea,button{font-family:'DM Sans',sans-serif;}
        input:focus,select:focus,textarea:focus{border-color:#C4602B!important;box-shadow:0 0 0 3px rgba(196,96,43,0.12);}
      `}</style>

      {/* Banner demo */}
      {currentUser?.suscripcionEstado === "demo" && <BannerDemo diasRestantes={currentUser.diasRestantes ?? 0} />}

      {/* Top Bar */}
      <div style={{position:"sticky",top:0,background:"rgba(253,248,243,0.95)",backdropFilter:"blur(10px)",zIndex:100,padding:"12px 16px",display:isDesktop?"none":"flex",alignItems:"center",gap:12,borderBottom:"1px solid #EDE0D0"}}>
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
                {/* Ayuda */}
                <button
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 16px",background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:"#C4602B",fontFamily:"inherit",textAlign:"left",borderBottom:"1px solid #EDE0D0"}}
                  onClick={()=>{setShowRootMenu(false);window.location.href="https://eventos.solucionesmdp.com.ar/ayuda";}}>
                  📖 Ayuda
                </button>
                {/* Soporte WhatsApp */}
                <a href={`https://wa.me/5492236965481?text=${encodeURIComponent(`Hola, soy usuario de App Eventos y necesito soporte.\nMi mail: ${currentUser?.email || '(no tengo)'}\nMi problema es: `)}`} target="_blank" rel="noreferrer"
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

      {/* Header desktop — título de sección */}
      {isDesktop && (
        <div style={{padding:"18px 24px 10px",borderBottom:"1px solid #EDE0D0"}}>
          <h1 style={{margin:0,fontSize:20,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display', serif"}}>{PAGE_TITLES[tab]}</h1>
        </div>
      )}

      {/* Views */}
      {tab==="inicio" && <InicioView reservas={reservas} clientes={clientes} pagos={pagos} extrasReserva={extrasReserva} serviciosExtras={serviciosExtras} bloqueos={bloqueos} tareas={tareas} saveTareas={saveTareas} removeTarea={removeTarea} onOpenBriefing={()=>setShowBriefing(true)} calDate={{year:calYear,month:calMonth}} setCalDate={(fn)=>{const r=fn({year:calYear,month:calMonth});setCalYear(r.year);setCalMonth(r.month);}} onDayClick={(ds,dr,ef)=>{
  const filtro=ef||"all";
  if(filtro==="all"&&recursos.length>1){
    setEspacioPicker({date:ds,reservas:dr});
  } else {
    setDayModal({date:ds,reservas:dr,espacioFiltro:filtro});
  }
}} onReservaClick={r=>setDetailReserva(r)} onNavigate={setTab} setModal={setModal} currentUser={currentUser} saveReservas={saveR} negocio={negocio} recursos={recursos} turnosRecurso={turnosRecurso} isDesktop={isDesktop} mercadoProductos={mercadoProductos} mercadoPedidos={mercadoPedidos} setMercadoPedidos={setMercadoPedidos} toggleMercadoReserva={toggleMercadoReserva} toggleMercadoProducto={toggleMercadoProducto} />}
      {tab==="reservas" && <Suspense fallback={<ViewLoader/>}><ReservasViewLazy reservas={reservas} clientes={clientes} pagos={pagos} recursos={recursos} turnosRecurso={turnosRecurso} extrasReserva={extrasReserva} bloqueos={bloqueos} onReservaClick={r=>setDetailReserva(r)} onNewReserva={(fecha)=>{setEditReserva(null);if(fecha)setInitDate(fecha);setModal("reserva");}} onCobrar={r=>{setPagoReservaId(r.id);setModal("pago");}} negocio={negocio} /></Suspense>}
      {tab==="clientes" && <Suspense fallback={<ViewLoader/>}><ClientesViewLazy clientes={clientes} reservas={reservas} onClienteClick={c=>setDetailCliente(c)} onNewCliente={()=>{setEditCliente(null);setModal("cliente");}} recursos={recursos} negocio={negocio} onDescartarSeguimiento={(r)=>{const updated={...r,seguimientoDescartado:true};saveR(reservas.map(x=>x.id===r.id?updated:x));showToast("Potencial descartado del seguimiento","info");}} /></Suspense>}
      {tab==="gastos" && <ErrorBoundary><Suspense fallback={<ViewLoader/>}><GastosViewLazy gastos={gastos} onNewGasto={()=>{setEditGasto(null);setModal("gasto");}} onEditGasto={(g)=>{setEditGasto(g);setModal("gasto");}} onDeleteGasto={handleDeleteGasto} /></Suspense></ErrorBoundary>}
      {tab==="recursos" && <RecursosView recursos={recursos} setRecursos={setRecursos} serviciosExtras={serviciosExtras} />}
      {tab==="config" && <ConfigView config={config} saveConfig={saveConfig} serviciosExtras={serviciosExtras} setServiciosExtras={setServiciosExtras} recursos={recursos} setRecursos={setRecursos} usuarios={usuarios} setUsuarios={setUsuarios} currentUser={currentUser} removeUsuario={removeUsuario} perfilesUsuarios={perfilesUsuarios} setPerfilesUsuarios={setPerfilesUsuarios} negocio={negocio} setNegocio={setNegocio} turnosRecurso={turnosRecurso} setTurnosRecurso={setTurnosRecurso} setTemporadasPrecio={setTemporadasPrecio} setPreciosTemporada={setPreciosTemporada} onGoMiPlan={()=>setTab("miplan")} mercadoProductos={mercadoProductos} saveMercadoProductos={saveMercadoProductos} removeMercadoProducto={removeMercadoProducto} />}
      {tab==="miplan" && <MiPlanView currentUser={currentUser} onBack={()=>setTab("config")} />}
      {tab==="recordatorios" && <Suspense fallback={<ViewLoader/>}><RecordatoriosViewLazy recordatorios={recordatorios} setRecordatorios={saveRecordatorios} reservas={reservas} clientes={clientes} pagos={pagos} extrasReserva={extrasReserva} onVerCliente={c=>{setDetailCliente(c);setTab("clientes");}} onVerEvento={r=>{setDetailReserva(r);setTab("reservas");}} onNewPago={(rid)=>{setPagoReservaId(rid);setModal("pago");}} negocio={negocio} /></Suspense>}
      {tab==="usuarios" && <UsuariosView usuarios={usuarios} setUsuarios={setUsuarios} currentUser={currentUser} />}
      {tab==="reportes" && <ErrorBoundary><Suspense fallback={<ViewLoader/>}><ReportesViewLazy pagos={pagos} gastos={gastos} reservas={reservas} extrasReserva={extrasReserva} serviciosExtras={serviciosExtras} clientes={clientes} negocio={negocio} turnosRecurso={turnosRecurso} recursos={recursos} bloqueos={bloqueos} tareas={tareas} consultas={consultas} /></Suspense></ErrorBoundary>}

      {/* Bottom Tab Bar — oculto en desktop, la nav está en el sidebar */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#FFF",borderTop:"1px solid #EDE0D0",display:isDesktop?"none":"flex",zIndex:500,boxShadow:"0 -4px 20px rgba(0,0,0,0.07)"}}>
        {[{id:"inicio",icon:"🏠",label:"Inicio"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"reservas",icon:"📋",label:"Reservas"},{id:"reportes",icon:"📈",label:"Reportes"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0 12px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
            <span style={{fontSize:22}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:t.id===tab?800:500,color:t.id===tab?"#C4602B":"#8B7355"}}>{t.label}</span>
            {t.id===tab && <div style={{width:20,height:2.5,background:"#C4602B",borderRadius:2}} />}
          </button>
        ))}
      </div>

      {/* FAB — solo en mobile */}
      {!isDesktop && <FAB onNewPago={()=>{setPagoReservaId(null);setModal("pago");}} onNewGasto={()=>setModal("gasto")} onNewConsulta={()=>setModal("consultas")} />}

      {/* Side Menu */}
      <SideMenu open={sideOpen} onClose={()=>setSideOpen(false)} onNavigate={setTab} tab={tab} currentUser={currentUser} negocio={negocio} />

      {/* Modals */}
      {modal==="reserva" && <ReservaModal reservas={reservas} onClose={()=>{setModal(null);setEditReserva(null);setInitDate(null);setInitTurno(null);}} onSave={handleSaveReserva} clientes={clientes} recursos={recursos} reserva={editReserva} initialDate={initDate} initialTurno={initTurno} config={config} saving={savingReserva} turnosRecurso={turnosRecurso} temporadasPrecio={temporadasPrecio} preciosTemporada={preciosTemporada} />}
      {modal==="cliente" && <ClienteModal onClose={()=>{setModal(null);setEditCliente(null);}} onSave={handleSaveCliente} cliente={editCliente} clientes={clientes} />}
      {modal==="pago" && <PagoModal onClose={()=>{setModal(null);setPagoReservaId(null);}} onSave={handleSavePago} reservas={reservas} clientes={clientes} pagos={pagos} extrasReserva={extrasReserva} initialReservaId={pagoReservaId} recursos={recursos} turnosRecurso={turnosRecurso} />}
      {modal==="gasto" && <GastoModal onClose={()=>{setModal(null);setEditGasto(null);}} onSave={handleSaveGasto} gasto={editGasto} />}
      {modal==="extra" && <ExtrasModal onClose={()=>{setModal(null);setExtraReservaId(null);}} onSave={handleSaveExtra} servicios={serviciosExtras} reservaId={extraReservaId} />}
      {modal==="consultas" && <ConsultasModal onClose={()=>setModal(null)} onSave={handleSaveConsultas} />}

      {/* Detail Panels */}
      {detailReserva && <ReservaDetail
        reserva={detailReserva}
        clientes={clientes}
        recursos={recursos}
        pagos={pagos}
        extrasReserva={extrasReserva}
        serviciosExtras={serviciosExtras}
        turnosRecurso={turnosRecurso}
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
        onEditProximoPago={(fecha,monto)=>{
          const updated={...detailReserva,proximoPagoFecha:fecha,proximoPagoMonto:monto};
          saveR(reservas.map(r=>r.id===detailReserva.id?updated:r));
          setDetailReserva(updated);
        }}
        negocio={negocio}
        plan={currentUser?.plan}
        logCom={logCom}
        comunicaciones={comunicaciones}
        onSaveShareConfig={async(cfg)=>{
          const updated={...detailReserva,...cfg};
          saveR(reservas.map(r=>r.id===detailReserva.id?updated:r));
          setDetailReserva(updated);
          showToast("Link de evento actualizado","ok");
        }}
        onConfirmVisita={()=>{
          const cli = clientes.find(c=>c.id===detailReserva.clienteId);
          const updatedRes = {...detailReserva, estado:"pendiente", fechaVisita:null, horaVisita:null};
          saveR(reservas.map(r=>r.id===detailReserva.id?updatedRes:r));
          if(cli && cli.estadoCrm === "Potencial"){
            saveC(clientes.map(c=>c.id===cli.id?{...c,estadoCrm:"Cliente"}:c));
          }
          setDetailReserva(updatedRes);
          showToast("Visita confirmada — reserva activa","ok");
        }}
        onNoConcreto={(motivo)=>{
          const updatedRes = {...detailReserva, estado:"cancelada", motivoNoConcreto:motivo||null};
          saveR(reservas.map(r=>r.id===detailReserva.id?updatedRes:r));
          setDetailReserva(null);
          showToast("Visita no concretada — fecha liberada","info");
        }}
      />}
      {detailCliente && <ClienteDetail cliente={detailCliente} reservas={reservas} turnosRecurso={turnosRecurso} comunicaciones={comunicaciones}
        onClose={()=>setDetailCliente(null)}
        onEdit={()=>{setEditCliente(detailCliente);setDetailCliente(null);setModal("cliente");}}
        onReactivar={(r)=>{
          saveR(reservas.map(x=>x.id===r.id?{...x,estado:"pendiente",fechaVisita:null,horaVisita:null,seguimientoDescartado:false,motivoNoConcreto:null}:x));
          const cli=clientes.find(c=>c.id===r.clienteId);
          if(cli&&cli.estadoCrm==="Potencial") saveC(clientes.map(c=>c.id===cli.id?{...c,estadoCrm:"Cliente"}:c));
          showToast("Reserva reactivada","ok");
        }} />}
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
      {showBriefing && <DailyBriefing reservas={reservas} clientes={clientes} pagos={pagos} extrasReserva={extrasReserva} recursos={recursos} servicios={serviciosExtras} turnosRecurso={turnosRecurso} negocio={negocio} recordatorios={recordatorios} tareas={tareas} onClose={()=>{markBriefingShown();setShowBriefing(false);}}
        onConfirmVisita={(r)=>{
          const cli=clientes.find(c=>c.id===r.clienteId);
          const updated={...r,estado:"pendiente",fechaVisita:null,horaVisita:null};
          saveR(reservas.map(x=>x.id===r.id?updated:x));
          if(cli&&cli.estadoCrm==="Potencial") saveC(clientes.map(c=>c.id===cli.id?{...c,estadoCrm:"Cliente"}:c));
          showToast("Visita confirmada — reserva activa","ok");
        }}
        onPosponerVisita={(r,horas)=>{
          const ahora=new Date();
          ahora.setHours(ahora.getHours()+horas);
          const nuevaFecha=`${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,"0")}-${String(ahora.getDate()).padStart(2,"0")}`;
          const nuevaHora=`${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
          const updated={...r,fechaVisita:nuevaFecha,horaVisita:nuevaHora};
          saveR(reservas.map(x=>x.id===r.id?updated:x));
          showToast(`Visita pospuesta ${horas}hs — ${nuevaFecha} ${nuevaHora}`,"info");
        }}
        onReprogramarVisita={(r,fecha,hora)=>{
          const updated={...r,fechaVisita:fecha,horaVisita:hora||r.horaVisita};
          saveR(reservas.map(x=>x.id===r.id?updated:x));
          showToast("Visita reprogramada","ok");
        }}
        onNoConcreto={(r,motivo)=>{
          saveR(reservas.map(x=>x.id===r.id?{...r,estado:"cancelada",motivoNoConcreto:motivo||null}:x));
          showToast("Visita no concretada — fecha liberada","info");
        }}
        onEditVisita={(r)=>{
          setShowBriefing(false);
          setEditReserva(r);
          setModal("reserva");
        }}
      />}
      {printData && <PrintModal data={printData} onClose={()=>setPrintData(null)} />}
      {inactivityWarning && (
        <div style={{position:"fixed",inset:0,background:"rgba(28,14,8,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{background:"#FFF",borderRadius:16,padding:"28px 32px",maxWidth:380,width:"90%",textAlign:"center",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{fontSize:36,marginBottom:12}}>&#x23F3;</div>
            <h3 style={{margin:"0 0 8px",fontSize:17,fontWeight:800,color:"#1C1C1E"}}>¿Seguís ahí?</h3>
            <p style={{margin:"0 0 20px",fontSize:13,color:"#8B7355"}}>Tu sesión se cerrará en 2 minutos por inactividad.</p>
            <button onClick={()=>{lastActivityRef.current=Date.now();setInactivityWarning(false);}} style={{background:"#C4602B",color:"#FFF",border:"none",borderRadius:10,padding:"10px 28px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Seguir conectado</button>
          </div>
        </div>
      )}
      {onboarding && <OnboardingWizard
        userName={currentUser?.nombre || currentUser?.email?.split('@')[0] || ''}
        onFinish={async(data)=>{
          try {
            // 1. Guardar config del negocio
            const row={org_id:getCurrentOrgId(),nombre_negocio:data.negocio.nombreNegocio,ciudad:data.negocio.ciudad,direccion:data.negocio.direccion,telefono:data.negocio.telefono,logo_url:"",msg_recordatorio:MSG_REC_DEFAULT,msg_post_evento:MSG_POST_DEFAULT,recordatorio_activo:true,post_evento_activo:true};
            await supabase.from("config").upsert(row,{onConflict:"org_id"});
            setNegocio({...negocio,...data.negocio,logoUrl:""});
            // 2. Guardar espacio
            const recId=genId();
            const modoEsp=data.espacio.modo||"fijo";
            const sc=data.slotCfg||{};
            const {error:recErr}=await supabase.from("recursos").insert({id:recId,nombre:data.espacio.nombre,capacidad_max:Number(data.espacio.capacidadMax)||0,modo:modoEsp,slot_hora_inicio:sc.horaInicio||"08:00",slot_hora_fin:sc.horaFin||"22:00",slot_duracion_min:Number(sc.duracion)||60,slot_intervalo_min:Number(sc.intervalo)||0,org_id:getCurrentOrgId(),creado_en:new Date().toISOString()});
            if(recErr) throw new Error("Error al guardar espacio: "+recErr.message);
            // 3. Generar turnos (manuales o slots automáticos)
            const nuevoRec={id:recId,nombre:data.espacio.nombre,capacidadMax:Number(data.espacio.capacidadMax)||0,modo:modoEsp,slotHoraInicio:sc.horaInicio||"08:00",slotHoraFin:sc.horaFin||"22:00",slotDuracionMin:Number(sc.duracion)||60,slotIntervaloMin:Number(sc.intervalo)||0,orgId:getCurrentOrgId()};
            let turnosInsert=[];
            if(modoEsp==="slot"){
              const [h1,m1]=(sc.horaInicio||"08:00").split(":").map(Number);
              const [h2,m2]=(sc.horaFin||"22:00").split(":").map(Number);
              const dur=Number(sc.duracion)||60;
              const intv=Number(sc.intervalo)||0;
              let cur=h1*60+m1, fin=h2*60+m2;
              const hh=v=>String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0");
              while(cur+dur<=fin){
                turnosInsert.push({recurso_id:recId,org_id:getCurrentOrgId(),nombre:`${hh(cur)} – ${hh(cur+dur)}`,icono:"📌",hora_inicio:hh(cur),hora_fin:hh(cur+dur),precio_semana:Number(sc.precioSemana)||0,precio_finde:Number(sc.precioFinde)||0,activo:true});
                cur+=dur+intv;
              }
            } else {
              turnosInsert=data.turnos.map(t=>({recurso_id:recId,org_id:getCurrentOrgId(),nombre:t.nombre,icono:t.icono||"📌",hora_inicio:t.horaInicio,hora_fin:t.horaFin,precio_semana:Number(t.precioSemana)||0,precio_finde:Number(t.precioFinde)||0,activo:true}));
            }
            let mappedTurnos=[];
            if(turnosInsert.length>0){
              const {data:td,error:tErr}=await supabase.from("turnos_recurso").insert(turnosInsert).select();
              if(tErr) throw new Error("Error al guardar turnos: "+tErr.message);
              mappedTurnos=(td||[]).map(x=>({id:x.id,recursoId:x.recurso_id,orgId:x.org_id,nombre:x.nombre||"",icono:x.icono||"📌",horaInicio:x.hora_inicio||"",horaFin:x.hora_fin||"",precioSemana:Number(x.precio_semana)||0,precioFinde:Number(x.precio_finde)||0,activo:true}));
            }
            setRecursos([nuevoRec]);
            setTurnosRecurso(mappedTurnos);
            setOnboarding(false);
          } catch(e) {
            showToast(e.message||"Error al guardar. Intentá de nuevo.","error");
          }
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
        temporadasPrecio={temporadasPrecio}
        preciosTemporada={preciosTemporada}
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
      <ToastContainer />

      {/* Banner: nueva versión disponible */}
      {nuevaVersion && (
        <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:isDesktop?800:480,background:"#1D4ED8",color:"#FFF",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:9999,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
          <span style={{fontSize:13,fontWeight:600}}>🔄 Hay una actualización lista</span>
          <button onClick={(e)=>{
            e.currentTarget.textContent="Aplicando...";
            e.currentTarget.disabled=true;
            setTimeout(()=>window.location.reload(), 400);
          }} style={{background:"#FFF",color:"#1D4ED8",border:"none",borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Aplicar</button>
        </div>
      )}

      {/* Indicador sutil de carga tier 2 (pagos, gastos, extras) */}
      {tier2Loading && loaded && (
        <div style={{position:"fixed",bottom:72,left:"50%",transform:"translateX(-50%)",background:"rgba(196,96,43,0.9)",color:"#FFF",padding:"5px 14px",borderRadius:20,fontSize:11,fontWeight:600,zIndex:800,pointerEvents:"none",display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:10,height:10,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#FFF",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
          Cargando datos...
        </div>
      )}
    </div>
    </div>
  );
}
