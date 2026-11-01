export const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const DAYS_SHORT = ["L","M","X","J","V","S","D"];

export const STATUS = {
  visita:     { label:"Visita",     color:"#7C3AED", bg:"var(--qb-st-visita-bg)",     border:"var(--qb-st-visita-border)" },
  pendiente:  { label:"Pendiente",  color:"#6B7280", bg:"var(--qb-st-pendiente-bg)",  border:"var(--qb-st-pendiente-border)" },
  senada:     { label:"Señada",     color:"#0284C7", bg:"var(--qb-st-senada-bg)",     border:"var(--qb-st-senada-border)" },
  confirmada: { label:"Confirmada", color:"#16A34A", bg:"var(--qb-st-confirmada-bg)", border:"var(--qb-st-confirmada-border)" },
  finalizada: { label:"Finalizada", color:"#1D4ED8", bg:"var(--qb-st-finalizada-bg)", border:"var(--qb-st-finalizada-border)" },
  cancelada:  { label:"Cancelada",  color:"#DC2626", bg:"var(--qb-st-cancelada-bg)",  border:"var(--qb-st-cancelada-border)" },
};

export const TURNOS = {
  dia:      { label:"Día",          icon:"☀️", color:"#D97706", bg:"#FEF3C7" },
  noche:    { label:"Tarde/Noche",  icon:"🌙", color:"#4F46E5", bg:"#EEF2FF" },
  completo: { label:"Día Completo", icon:"⭐", color:"#059669", bg:"#D1FAE5" },
};

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta"];
export const EXPENSE_CATS = ["Mantenimiento", "Limpieza", "Servicios", "Insumos", "Publicidad", "Otros"];
export const CAT_COLORS = { Mantenimiento:"#6366F1", Limpieza:"#06B6D4", Servicios:"#F59E0B", Insumos:"#8B5CF6", Publicidad:"#EC4899" };

export const DEFAULT_CONFIG = {
  precios: {
    dia_semana: { dia:80000,  noche:100000, completo:160000 },
    dia_finde:  { dia:120000, noche:150000, completo:250000 },
  },
};

export const PLAN_LIMITS = {
  basico:      { reservasMes:50,  colaboradores:0, espacios:1, recordatorios:false, serviciosExtras:false, portal:false },
  profesional: { reservasMes:100, colaboradores:1, espacios:3, recordatorios:true,  serviciosExtras:true,  portal:true  },
  premium:     { reservasMes:null,colaboradores:3, espacios:5, recordatorios:true,  serviciosExtras:true,  portal:true  },
  sincargo:    { reservasMes:null,colaboradores:3, espacios:5, recordatorios:true,  serviciosExtras:true,  portal:true  },
  demo:        { reservasMes:100, colaboradores:1, espacios:3, recordatorios:true,  serviciosExtras:true,  portal:true  },
};
export const getPlanLimits = (plan) => PLAN_LIMITS[plan] || PLAN_LIMITS.basico;
