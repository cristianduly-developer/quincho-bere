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

export const calcEstadoReserva = (totalPagado, totalEvento) => {
  if (totalPagado <= 0) return "pendiente";
  if (totalPagado >= totalEvento) return "confirmada";
  return "senada";
};

export const formatMes = (m, y) => `${MONTHS[m]} ${y}`;

// Normaliza número argentino para wa.me: saca 15, agrega 549 si falta
export const waNumber = (raw) => {
  if (!raw) return "";
  let n = raw.replace(/\D/g, "");
  // Si empieza con 0 (ej: 0223, 011) → sacar el 0 y agregar 54
  if (n.startsWith("0")) n = "54" + n.slice(1);
  // Si no empieza con 54, agregar 54
  if (!n.startsWith("54")) n = "54" + n;
  // Sacar el 9 después de 54 si existe, para re-agregarlo consistente
  if (n.startsWith("549")) n = "54" + n.slice(3);
  // Sacar el 15 después del código de área
  // Buenos Aires (11): 5411 15 XXXXXXXX → 5411XXXXXXXX
  if (n.startsWith("5411") && n.length > 12) n = "5411" + n.slice(4).replace(/^15/, "");
  // Otras ciudades (223, 351, etc.): 54XXX 15 XXXXXXX → 54XXXXXXXXX
  else if (n.length > 12) n = n.slice(0, 4) + n.slice(4).replace(/^15/, "");
  // Agregar 9 después de 54 (formato celular argentino para WhatsApp)
  if (n.startsWith("54") && !n.startsWith("549")) n = "549" + n.slice(2);
  return n;
};
