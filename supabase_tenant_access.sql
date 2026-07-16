-- ══════════════════════════════════════════════════════════════
-- Quincho (App Eventos) — Espejo de acceso/plan por tenant
-- STAGE 1: solo crea tablas y funciones. NO enforca nada.
-- Correr en el Supabase de Quincho.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenant_access (
  tenant_id   UUID PRIMARY KEY,
  plan        TEXT,
  valid_until TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '3650 days'
);
ALTER TABLE tenant_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS plan_limites (
  plan                 TEXT PRIMARY KEY,
  max_reservas_mes     INT,
  usa_recordatorios    BOOLEAN NOT NULL DEFAULT FALSE,
  usa_servicios_extras BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO plan_limites (plan, max_reservas_mes, usa_recordatorios, usa_servicios_extras) VALUES
  ('basico',      50,   FALSE, FALSE),
  ('profesional', 100,  TRUE,  TRUE),
  ('premium',     NULL, TRUE,  TRUE),
  ('sincargo',    NULL, TRUE,  TRUE)
ON CONFLICT (plan) DO UPDATE SET
  max_reservas_mes     = EXCLUDED.max_reservas_mes,
  usa_recordatorios    = EXCLUDED.usa_recordatorios,
  usa_servicios_extras = EXCLUDED.usa_servicios_extras;

CREATE OR REPLACE FUNCTION tiene_acceso(tid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valid_until > now() FROM tenant_access WHERE tenant_id = tid), FALSE);
$$;

CREATE OR REPLACE FUNCTION plan_tenant(tid UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT plan FROM tenant_access WHERE tenant_id = tid),
    'basico'
  );
$$;

CREATE OR REPLACE FUNCTION plan_permite(tid UUID, feature TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE feature
      WHEN 'recordatorios'    THEN usa_recordatorios
      WHEN 'servicios_extras' THEN usa_servicios_extras
      ELSE TRUE END
    FROM plan_limites WHERE plan = plan_tenant(tid)
  ), TRUE);
$$;

-- ══════════════════════════════════════════════════════════════
-- FIN STAGE 1. La app empezará a poblar tenant_access en cada login.
-- Verificá: SELECT * FROM tenant_access;
-- Cuando se llene, correr STAGE 2 (enforcement).
-- ══════════════════════════════════════════════════════════════
