import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPA_URL,
  import.meta.env.VITE_SUPA_KEY
);

export const supabaseCentral = createClient(
  import.meta.env.VITE_CENTRAL_URL,
  import.meta.env.VITE_CENTRAL_KEY
);

// org_id activo — se setea al login
let _currentOrgId = null;
export const getCurrentOrgId = () => _currentOrgId;
export const setCurrentOrgId = (id) => { _currentOrgId = id; };

export const sb = {
  async getAll(table) {
    let q = supabase.from(table).select("*").order("creado_en", { ascending: true });
    if (_currentOrgId) q = q.eq("org_id", _currentOrgId);
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
    let q = supabase.from(table).delete().eq("id", id);
    if (_currentOrgId) q = q.eq("org_id", _currentOrgId);
    const { error } = await q;
    if (error) { console.error("SB remove error:", table, error); return null; }
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
    console.error("verificar_limite_plan error:", error);
    return { permitido: true }; // fail-open para no bloquear por error técnico
  }
  return data || { permitido: true };
};
