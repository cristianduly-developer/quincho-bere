-- ================================================================
-- QUINCHO-BERE — Migración SaaS Multi-tenant
-- Correr en Supabase SQL Editor (pmohyepcqfvkwijmljee)
-- ================================================================

-- ── 1. ELIMINAR TABLAS VIEJAS DE AUTH ────────────────────────
DROP TABLE IF EXISTS perfiles_usuarios CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ── 2. TABLA user_orgs: mapeo auth.uid() → org_id ────────────
-- Cuando un usuario se loguea, se inserta aquí su org_id
-- RLS lo usa para saber qué datos puede ver
CREATE TABLE IF NOT EXISTS user_orgs (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id   uuid NOT NULL,
  creado_en timestamptz DEFAULT now()
);

-- Función helper para RLS: devuelve el org_id del usuario actual
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
$$;

-- ── 3. AGREGAR org_id A TODAS LAS TABLAS ─────────────────────
ALTER TABLE clientes          ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE reservas          ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE pagos             ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE gastos            ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE extras_reserva    ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE servicios_extras  ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE recursos          ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE tareas            ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE bloqueos          ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE recordatorios     ADD COLUMN IF NOT EXISTS org_id uuid;

-- ── 4. REDISEÑO DE RECURSOS (espacios con modo turnos) ────────
ALTER TABLE recursos
  ADD COLUMN IF NOT EXISTS modo text DEFAULT 'fijo' CHECK (modo IN ('fijo', 'slot')),
  ADD COLUMN IF NOT EXISTS slot_duracion_min int,
  ADD COLUMN IF NOT EXISTS slot_hora_inicio text,
  ADD COLUMN IF NOT EXISTS slot_hora_fin text;

-- ── 5. NUEVA TABLA: turnos_recurso ────────────────────────────
-- Cada espacio tiene sus propios turnos con precios independientes
-- Modo fijo: se crean manualmente (ej: "Noche" 19:00-23:59)
-- Modo slot: se generan automáticamente cada N minutos (ej: cada 60 min)
CREATE TABLE IF NOT EXISTS turnos_recurso (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id      text NOT NULL REFERENCES recursos(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL,
  nombre          text NOT NULL,           -- "Día", "Noche", "20:00-21:00"
  hora_inicio     text NOT NULL,           -- "11:00"
  hora_fin        text NOT NULL,           -- "17:00"
  precio_semana   numeric DEFAULT 0,
  precio_finde    numeric DEFAULT 0,
  activo          boolean DEFAULT true,
  creado_en       timestamptz DEFAULT now()
);

-- Agregar turno_id a reservas (referencia al turno seleccionado)
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES turnos_recurso(id) ON DELETE SET NULL;

-- ── 6. REDISEÑO DE CONFIG (white-label + mensajes WhatsApp) ───
DROP TABLE IF EXISTS config CASCADE;
CREATE TABLE config (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL UNIQUE,
  nombre_negocio    text DEFAULT '',
  ciudad            text DEFAULT '',
  telefono          text DEFAULT '',
  logo_url          text DEFAULT '',
  msg_recordatorio  text DEFAULT 'Hola {nombre}! 👋 Te recordamos tu evento en {nombre_negocio} mañana {fecha} a las {horario}. Saldo pendiente: {saldo}. ¡Nos vemos!',
  msg_post_evento   text DEFAULT 'Hola {nombre}! 🎉 Esperamos que el evento en {nombre_negocio} haya sido un éxito. ¡Gracias por elegirnos!',
  creado_en         timestamptz DEFAULT now()
);

-- ── 7. HABILITAR RLS EN TODAS LAS TABLAS ─────────────────────
ALTER TABLE user_orgs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras_reserva    ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_extras  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recursos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos_recurso    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE config            ENABLE ROW LEVEL SECURITY;

-- ── 8. POLÍTICAS RLS ─────────────────────────────────────────
-- Cada usuario solo ve y opera sobre los datos de su org

-- user_orgs: cada usuario ve y escribe solo su propio mapping
CREATE POLICY "user_orgs_policy" ON user_orgs
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- clientes
CREATE POLICY "clientes_org" ON clientes
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- reservas
CREATE POLICY "reservas_org" ON reservas
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- pagos
CREATE POLICY "pagos_org" ON pagos
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- gastos
CREATE POLICY "gastos_org" ON gastos
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- extras_reserva
CREATE POLICY "extras_reserva_org" ON extras_reserva
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- servicios_extras
CREATE POLICY "servicios_extras_org" ON servicios_extras
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- recursos
CREATE POLICY "recursos_org" ON recursos
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- turnos_recurso
CREATE POLICY "turnos_recurso_org" ON turnos_recurso
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- tareas
CREATE POLICY "tareas_org" ON tareas
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- bloqueos
CREATE POLICY "bloqueos_org" ON bloqueos
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- recordatorios
CREATE POLICY "recordatorios_org" ON recordatorios
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- config
CREATE POLICY "config_org" ON config
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- ── 9. ÍNDICES DE PERFORMANCE ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_org         ON clientes(org_id);
CREATE INDEX IF NOT EXISTS idx_reservas_org         ON reservas(org_id);
CREATE INDEX IF NOT EXISTS idx_reservas_org_fecha   ON reservas(org_id, fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_org            ON pagos(org_id);
CREATE INDEX IF NOT EXISTS idx_gastos_org           ON gastos(org_id);
CREATE INDEX IF NOT EXISTS idx_extras_org           ON extras_reserva(org_id);
CREATE INDEX IF NOT EXISTS idx_servicios_org        ON servicios_extras(org_id);
CREATE INDEX IF NOT EXISTS idx_recursos_org         ON recursos(org_id);
CREATE INDEX IF NOT EXISTS idx_turnos_org           ON turnos_recurso(org_id);
CREATE INDEX IF NOT EXISTS idx_turnos_recurso       ON turnos_recurso(recurso_id);
CREATE INDEX IF NOT EXISTS idx_tareas_org           ON tareas(org_id);
CREATE INDEX IF NOT EXISTS idx_bloqueos_org         ON bloqueos(org_id);
CREATE INDEX IF NOT EXISTS idx_recordatorios_org    ON recordatorios(org_id);
CREATE INDEX IF NOT EXISTS idx_config_org           ON config(org_id);

-- ── 10. REGISTRAR app "quincho" EN EL SUPABASE CENTRAL ───────
-- IMPORTANTE: esto hay que correrlo en el Supabase CENTRAL
-- (ngymvfvlknaltsvsrvjm), NO en este.
-- Solo si no existe ya el registro:
--
-- INSERT INTO apps_config (id, nombre, icono, descripcion, activa)
-- VALUES ('quincho', 'App Quincho', '🏡', 'Gestión de alquiler de espacios para eventos', true)
-- ON CONFLICT (id) DO NOTHING;
