import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPA_URL,
  import.meta.env.VITE_SUPA_KEY
);

// org_id activo — se setea al login
let _currentOrgId = null;
export const getCurrentOrgId = () => _currentOrgId;
export const setCurrentOrgId = (id) => { _currentOrgId = id; };

// Traduce un error de Supabase a un mensaje claro para el usuario.
// Devuelve null si no es un caso especial (el caller usa su mensaje genérico).
// - 42501 / "row-level security": lo frenó una policy → suscripción vencida o feature no incluida en el plan.
export const mensajeErrorGuardado = (error) => {
  const msg = (error?.message || "").toLowerCase();
  const esRLS = error?.code === "42501" || msg.includes("row-level security") || msg.includes("row level security");
  if (esRLS) {
    if (msg.includes("feat_"))
      return "🔒 Esta función no está incluida en tu plan actual. Actualizá el plan para usarla.";
    return "🔒 Tu suscripción venció o está suspendida. Renovala para seguir cargando datos. Tus datos siguen guardados y podés verlos.";
  }
  return null;
};

// Último mensaje amigable de error (lo consultan los guardados que usan sb.upsert/remove).
let _ultimoError = null;
export const getUltimoError = () => _ultimoError;

export const sb = {
  async getAll(table, limit = 1000) {
    let q = supabase.from(table).select("*").order("creado_en", { ascending: true }).limit(limit);
    if (_currentOrgId) q = q.eq("org_id", _currentOrgId);
    const { data } = await q;
    return data || [];
  },
  async upsert(table, rows) {
    const arr = Array.isArray(rows) ? rows : [rows];
    if (!arr.length) return true;
    const { error } = await supabase.from(table).upsert(arr);
    if (error) { console.error("SB upsert error:", table, error); _ultimoError = mensajeErrorGuardado(error); return null; }
    _ultimoError = null;
    return true;
  },
  async remove(table, id) {
    let q = supabase.from(table).delete().eq("id", id);
    if (_currentOrgId) q = q.eq("org_id", _currentOrgId);
    const { error } = await q;
    if (error) { console.error("SB remove error:", table, error); _ultimoError = mensajeErrorGuardado(error); return null; }
    _ultimoError = null;
    return true;
  },
};

// Verifica límites de plan server-side via RPC
export const verificarLimiteServidor = async (accion) => {
  const orgId = _currentOrgId;
  if (!orgId) return { permitido: false, motivo: "Sin org_id" };
  const { data, error } = await supabase.rpc("verificar_limite_plan", {
    p_org_id: orgId,
    p_accion: accion,
  });
  if (error) {
    console.warn("verificar_limite_plan no disponible, usando fallback cliente:", error.message);
    // fail-open: el fallback cliente en App.jsx verifica el límite correctamente
    return { permitido: true };
  }
  return data || { permitido: false, motivo: "Respuesta inesperada del servidor." };
};
