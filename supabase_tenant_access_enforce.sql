-- ══════════════════════════════════════════════════════════════
-- Quincho (App Eventos) — ENFORCEMENT (items 8 + 9)
-- Correr DESPUÉS de supabase_tenant_access.sql
-- Gatea ESCRITURA por acceso vigente + features del plan.
-- LECTURA queda intacta. Todo RESTRICTIVE. Reversible.
-- ══════════════════════════════════════════════════════════════

-- ── A. Gate de ACCESO vigente en escritura ──
DO $$
DECLARE t TEXT;
DECLARE tablas TEXT[] := ARRAY[
  'reservas','pagos','gastos','recursos','turnos_recurso','extras_reserva',
  'servicios_extras','tareas','bloqueos','recordatorios','temporadas_precio',
  'precios_temporada','config','clientes'
];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = t AND column_name = 'org_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS acc_ins_%1$s ON %1$s', t);
      EXECUTE format('DROP POLICY IF EXISTS acc_upd_%1$s ON %1$s', t);
      EXECUTE format('CREATE POLICY acc_ins_%1$s ON %1$s AS RESTRICTIVE FOR INSERT WITH CHECK (tiene_acceso(org_id::uuid))', t);
      EXECUTE format('CREATE POLICY acc_upd_%1$s ON %1$s AS RESTRICTIVE FOR UPDATE WITH CHECK (tiene_acceso(org_id::uuid))', t);
    END IF;
  END LOOP;
END $$;

-- ── B. Gate de FEATURES por plan ──
DROP POLICY IF EXISTS feat_ins_extras ON extras_reserva;
CREATE POLICY feat_ins_extras ON extras_reserva AS RESTRICTIVE
  FOR INSERT WITH CHECK (plan_permite(org_id::uuid, 'servicios_extras'));

DROP POLICY IF EXISTS feat_ins_recordatorios ON recordatorios;
CREATE POLICY feat_ins_recordatorios ON recordatorios AS RESTRICTIVE
  FOR INSERT WITH CHECK (plan_permite(org_id::uuid, 'recordatorios'));

-- ══════════════════════════════════════════════════════════════
-- ROLLBACK:
-- DO $$ DECLARE t TEXT; DECLARE tablas TEXT[] := ARRAY['reservas','pagos','gastos','recursos','turnos_recurso','extras_reserva','servicios_extras','tareas','bloqueos','recordatorios','temporadas_precio','precios_temporada','config','clientes'];
-- BEGIN FOREACH t IN ARRAY tablas LOOP
--   EXECUTE format('DROP POLICY IF EXISTS acc_ins_%1$s ON %1$s', t);
--   EXECUTE format('DROP POLICY IF EXISTS acc_upd_%1$s ON %1$s', t);
-- END LOOP; END $$;
-- DROP POLICY IF EXISTS feat_ins_extras ON extras_reserva;
-- DROP POLICY IF EXISTS feat_ins_recordatorios ON recordatorios;
-- ══════════════════════════════════════════════════════════════
