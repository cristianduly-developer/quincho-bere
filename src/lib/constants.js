export const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const DAYS_SHORT = ["L","M","X","J","V","S","D"];

export const STATUS = {
  visita:     { label:"Visita",     color:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" },
  pendiente:  { label:"Pendiente",  color:"#6B7280", bg:"#F3F4F6", border:"#D1D5DB" },
  senada:     { label:"Señada",     color:"#0284C7", bg:"#E0F2FE", border:"#7DD3FC" },
  confirmada: { label:"Confirmada", color:"#16A34A", bg:"#DCFCE7", border:"#86EFAC" },
  finalizada: { label:"Finalizada", color:"#1D4ED8", bg:"#DBEAFE", border:"#93C5FD" },
  cancelada:  { label:"Cancelada",  color:"#DC2626", bg:"#FEF2F2", border:"#FECACA" },
};

export const TURNOS = {
  dia:      { label:"Día",          icon:"☀️", color:"#D97706", bg:"#FEF3C7" },
  noche:    { label:"Tarde/Noche",  icon:"🌙", color:"#4F46E5", bg:"#EEF2FF" },
  completo: { label:"Día Completo", icon:"⭐", color:"#059669", bg:"#D1FAE5" },
};

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta"];
export const EXPENSE_CATS = ["Mantenimiento", "Limpieza", "Servicios", "Insumos", "Otros"];
export const CAT_COLORS = { Mantenimiento:"#6366F1", Limpieza:"#06B6D4", Servicios:"#F59E0B", Insumos:"#8B5CF6" };

export const DEFAULT_CONFIG = {
  precios: {
    dia_semana: { dia:80000,  noche:100000, completo:160000 },
    dia_finde:  { dia:120000, noche:150000, completo:250000 },
  },
};

export const PLAN_LIMITS = {
  basico:      { reservasMes:50,  colaboradores:0, espacios:1, recordatorios:false, serviciosExtras:false },
  profesional: { reservasMes:100, colaboradores:1, espacios:3, recordatorios:true,  serviciosExtras:true  },
  premium:     { reservasMes:null,colaboradores:3, espacios:5, recordatorios:true,  serviciosExtras:true  },
  sincargo:    { reservasMes:null,colaboradores:3, espacios:5, recordatorios:true,  serviciosExtras:true  },
  demo:        { reservasMes:100, colaboradores:1, espacios:3, recordatorios:true,  serviciosExtras:true  },
};
export const getPlanLimits = (plan) => PLAN_LIMITS[plan] || PLAN_LIMITS.basico;
