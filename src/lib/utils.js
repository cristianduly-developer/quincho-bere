import { MONTHS } from "./constants.js";

export const genId      = () => crypto.randomUUID();
export const escHtml    = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export const fmtCurrency= (n=0) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
export const fmtDate    = (d) => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
export const toDateStr  = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
export const clientName = (c) => c ? `${c.nombre||""} ${c.apellido||""}`.trim()||"Sin nombre" : "Sin cliente";
export const monthKey   = (d) => d ? d.slice(0,7) : "";

export const getTotalExtras = (rid, extrasReserva) => extrasReserva.filter(e=>e.reservaId===rid).reduce((s,e)=>s+(e.precioHistorico*e.cantidad),0);
export const getTotalPagado = (rid, pagos)         => pagos.filter(p=>p.reservaId===rid).reduce((s,p)=>s+p.monto,0);
export const getSaldo       = (res, extrasReserva, pagos) => (res.montoPactado+getTotalExtras(res.id,extrasReserva))-getTotalPagado(res.id,pagos);

export const getTurnoNombre = (r) => r.turno || (r.turnoId ? r.turnoId : "—");

export const formatMes = (m, y) => `${MONTHS[m]} ${y}`;
