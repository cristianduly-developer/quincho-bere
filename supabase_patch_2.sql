-- ================================================================
-- QUINCHO-BERE — Patch #2: Integridad, Atomicidad y Plan Enforcement
-- Correr en Supabase SQL Editor (pmohyepcqfvkwijmljee)
-- ================================================================

-- ── 1. UNIQUE en user_orgs(user_id) ─────────────────────────────
-- Evita que get_my_org_id() devuelva múltiples filas → RLS no falla
-- Si ya hay duplicados, este comando falla: primero limpiar con el query del final
ALTER TABLE user_orgs ADD CONSTRAINT user_orgs_user_id_unique UNIQUE (user_id);

-- ── 2. Columna plan en config (para RLS de plan enforcement) ────
-- Necesario para que RLS pueda verificar el plan sin llamar a la central DB
ALTER TABLE config ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basico'
  CHECK (plan IN ('basico','profesional','premium','demo','sincargo'));

-- ── 3. Función para obtener el plan de la org actual ────────────
CREATE OR REPLACE FUNCTION get_my_plan()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(plan, 'basico') FROM config WHERE org_id = get_my_org_id() LIMIT 1
$$;

-- ── 4. RLS en extras_reserva: solo planes que permiten extras ───
-- Plan 'basico' no tiene servicios extras según la matriz de permisos
ALTER TABLE extras_reserva ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extras_reserva_org" ON extras_reserva;
CREATE POLICY "extras_reserva_org" ON extras_reserva
  FOR SELECT USING (org_id = get_my_org_id());

DROP POLICY IF EXISTS "extras_reserva_insert_plan" ON extras_reserva;
CREATE POLICY "extras_reserva_insert_plan" ON extras_reserva
  FOR INSERT WITH CHECK (
    org_id = get_my_org_id()
    AND get_my_plan() IN ('profesional','premium','demo')
  );

DROP POLICY IF EXISTS "extras_reserva_update_plan" ON extras_reserva;
CREATE POLICY "extras_reserva_update_plan" ON extras_reserva
  FOR UPDATE USING (org_id = get_my_org_id())
  WITH CHECK (
    org_id = get_my_org_id()
    AND get_my_plan() IN ('profesional','premium','demo')
  );

DROP POLICY IF EXISTS "extras_reserva_delete" ON extras_reserva;
CREATE POLICY "extras_reserva_delete" ON extras_reserva
  FOR DELETE USING (org_id = get_my_org_id());

-- ── 5. RPC atómica: crear temporada + precios en una transacción ─
CREATE OR REPLACE FUNCTION crear_temporada_con_precios(
  p_org_id uuid,
  p_recurso_id uuid,
  p_nombre text,
  p_mes_desde int,
  p_dia_desde int,
  p_mes_hasta int,
  p_dia_hasta int,
  p_precios jsonb  -- array de {turno_id, precio_semana, precio_finde}
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_temporada temporadas_precio;
  v_precios jsonb;
BEGIN
  -- Verificar que la org del caller coincide (seguridad adicional)
  IF p_org_id != get_my_org_id() THEN
    RAISE EXCEPTION 'org_id no autorizado';
  END IF;

  -- Insertar temporada
  INSERT INTO temporadas_precio (org_id, recurso_id, nombre, mes_desde, dia_desde, mes_hasta, dia_hasta)
  VALUES (p_org_id, p_recurso_id, p_nombre, p_mes_desde, p_dia_desde, p_mes_hasta, p_dia_hasta)
  RETURNING * INTO v_temporada;

  -- Insertar precios para cada turno (si se pasan)
  IF jsonb_array_length(p_precios) > 0 THEN
    INSERT INTO precios_temporada (org_id, temporada_id, turno_id, precio_semana, precio_finde, activo)
    SELECT
      p_org_id,
      v_temporada.id,
      (elem->>'turno_id')::uuid,
      (elem->>'precio_semana')::numeric,
      (elem->>'precio_finde')::numeric,
      true
    FROM jsonb_array_elements(p_precios) AS elem;
  END IF;

  -- Devolver temporada + precios creados
  SELECT jsonb_build_object(
    'temporada', row_to_json(v_temporada),
    'precios', COALESCE(
      (SELECT jsonb_agg(row_to_json(pt))
       FROM precios_temporada pt
       WHERE pt.temporada_id = v_temporada.id),
      '[]'::jsonb
    )
  ) INTO v_precios;

  RETURN v_precios;
END;
$$;

-- ── 6. FK en reservas.turno_id ───────────────────────────────────
-- IMPORTANTE: ejecutar solo si el tipo actual es uuid
-- Primero verificar: SELECT pg_typeof(turno_id) FROM reservas LIMIT 1;
-- Si es text, usar el bloque alternativo de abajo.

-- Opción A: si turno_id ya es uuid
ALTER TABLE reservas
  ADD CONSTRAINT reservas_turno_id_fk
  FOREIGN KEY (turno_id) REFERENCES turnos_recurso(id) ON DELETE SET NULL;

-- Opción B: si turno_id es text (descomentar si A falla):
-- ALTER TABLE reservas ADD COLUMN turno_id_ref uuid REFERENCES turnos_recurso(id) ON DELETE SET NULL;
-- UPDATE reservas SET turno_id_ref = turno_id::uuid WHERE turno_id ~ '^[0-9a-f-]{36}$';

-- ── DIAGNÓSTICO previo a ejecutar ───────────────────────────────
-- Verificar duplicados en user_orgs antes del UNIQUE:
-- SELECT user_id, COUNT(*) FROM user_orgs GROUP BY user_id HAVING COUNT(*) > 1;
-- Si hay duplicados, limpiar con:
-- DELETE FROM user_orgs a USING user_orgs b WHERE a.ctid > b.ctid AND a.user_id = b.user_id;

-- Verificar tipo de turno_id en reservas:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'reservas' AND column_name = 'turno_id';
