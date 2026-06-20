-- ================================================================
-- QUINCHO-BERE — Patch de Seguridad, Integridad y Performance
-- Correr en Supabase SQL Editor (pmohyepcqfvkwijmljee)
-- ================================================================

-- ── 1. get_my_org_id con LIMIT 1 (defensa en profundidad) ────────
-- Aunque user_id ya es PK (único), LIMIT 1 evita cualquier edge case
-- si en el futuro se cambia la estructura de la tabla.
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT org_id FROM user_orgs WHERE user_id = auth.uid() LIMIT 1
$$;

-- ── 2. Unicidad de reservas (evita duplicados por doble click) ───
-- Partial index: solo cuando turno_id está asignado y no está cancelada.
-- Permite múltiples canceladas o reservas sin turno_id (compatibilidad legacy).
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_unica
  ON reservas (org_id, recurso_id, turno_id, fecha)
  WHERE turno_id IS NOT NULL AND estado != 'cancelada';

-- ── 3. Índices para temporadas y precios de temporada ───────────
CREATE INDEX IF NOT EXISTS idx_temporadas_org     ON temporadas_precio(org_id);
CREATE INDEX IF NOT EXISTS idx_temporadas_recurso ON temporadas_precio(recurso_id);
CREATE INDEX IF NOT EXISTS idx_precios_temp_id    ON precios_temporada(temporada_id);
CREATE INDEX IF NOT EXISTS idx_precios_temp_turno ON precios_temporada(turno_id);
CREATE INDEX IF NOT EXISTS idx_precios_temp_combo ON precios_temporada(temporada_id, turno_id);

-- ── 4. Índice en reservas por turno_id (para lookups de turno) ──
CREATE INDEX IF NOT EXISTS idx_reservas_turno_id ON reservas(turno_id) WHERE turno_id IS NOT NULL;

-- ── 5. Soft delete en entidades principales ─────────────────────
-- Agrega columna deleted_at para borrado lógico (preserva historial)
ALTER TABLE clientes      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE recursos      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE turnos_recurso ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Índices parciales para filtrar eliminados eficientemente
CREATE INDEX IF NOT EXISTS idx_clientes_activos ON clientes(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recursos_activos ON recursos(org_id) WHERE deleted_at IS NULL;

-- ── 6. RLS para temporadas_precio y precios_temporada ───────────
-- Estas tablas se crearon después de la migración inicial.
-- Aseguramos que tengan RLS y políticas correctas.
ALTER TABLE temporadas_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_temporada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "temporadas_precio_org" ON temporadas_precio;
CREATE POLICY "temporadas_precio_org" ON temporadas_precio
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

DROP POLICY IF EXISTS "precios_temporada_org" ON precios_temporada;
CREATE POLICY "precios_temporada_org" ON precios_temporada
  FOR ALL USING (org_id = get_my_org_id())
  WITH CHECK (org_id = get_my_org_id());

-- ── 7. Validación de estados válidos en reservas ─────────────────
ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
ALTER TABLE reservas ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('pendiente', 'senada', 'confirmada', 'finalizada', 'cancelada'));

-- ── 8. Índice de reservas_org_estado para consultas de activas ──
CREATE INDEX IF NOT EXISTS idx_reservas_org_estado ON reservas(org_id, estado)
  WHERE estado NOT IN ('cancelada', 'finalizada');

-- ── 9. Verificar RLS en todas las tablas nuevas ─────────────────
-- Si ya existían las políticas, DROP IF EXISTS + CREATE las renueva.
-- Solo aplica si las tablas ya existen con RLS mal configurado.

-- ── VERIFICACIÓN FINAL ───────────────────────────────────────────
-- Ejecutar esto para confirmar que todas las tablas tienen RLS:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
