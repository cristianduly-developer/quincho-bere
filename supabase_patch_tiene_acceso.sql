-- ══════════════════════════════════════════════════════════════
-- Fix H-02: tiene_acceso() debe defaultear FALSE (no TRUE)
-- Si no existe fila en tenant_access para un org, bloquearlo
-- hasta que se cree su registro (en vez de darle acceso libre).
-- Correr en el Supabase de Quincho (satelital).
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION tiene_acceso(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valid_until > now() FROM tenant_access WHERE tenant_id = tid), FALSE);
$$;
