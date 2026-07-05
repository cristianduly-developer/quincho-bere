-- ================================================================
-- QUINCHO-BERE — Patch #3: Seguridad — Triggers de integridad
-- Correr en Supabase SQL Editor (pmohyepcqfvkwijmljee)
-- ================================================================

-- ── 1. user_orgs: org_id inmutable después del primer set ───────
-- Un usuario autenticado no puede cambiar su propia org_id una vez asignada.
-- Previene escalada de privilegios entre tenants.
CREATE OR REPLACE FUNCTION prevent_org_id_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.org_id IS NOT NULL AND OLD.org_id != NEW.org_id THEN
    RAISE EXCEPTION 'No podés cambiar la organización asignada.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_orgs_immutable_org ON user_orgs;
CREATE TRIGGER user_orgs_immutable_org
  BEFORE UPDATE ON user_orgs
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();

-- ── 2. reservas: transiciones de estado válidas ─────────────────
-- Máquina de estados: pendiente → senada → confirmada → finalizada
--                                       ↘ cancelada (desde cualquier estado activo)
-- Impide que una reserva finalizada o cancelada vuelva a estado activo.
CREATE OR REPLACE FUNCTION validate_reserva_estado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Solo validar si el estado cambia
  IF OLD.estado = NEW.estado THEN RETURN NEW; END IF;

  -- Estados finales: no se puede salir de ellos
  IF OLD.estado IN ('finalizada', 'cancelada') THEN
    RAISE EXCEPTION 'No se puede cambiar el estado de una reserva % a %.', OLD.estado, NEW.estado;
  END IF;

  -- Transiciones válidas desde estados activos
  IF OLD.estado = 'pendiente'   AND NEW.estado NOT IN ('senada','confirmada','cancelada') THEN
    RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
  END IF;
  IF OLD.estado = 'senada'      AND NEW.estado NOT IN ('confirmada','cancelada') THEN
    RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
  END IF;
  IF OLD.estado = 'confirmada'  AND NEW.estado NOT IN ('finalizada','cancelada') THEN
    RAISE EXCEPTION 'Transición de estado inválida: % → %', OLD.estado, NEW.estado;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservas_estado_transition ON reservas;
CREATE TRIGGER reservas_estado_transition
  BEFORE UPDATE OF estado ON reservas
  FOR EACH ROW EXECUTE FUNCTION validate_reserva_estado();

-- ── VERIFICACIÓN ─────────────────────────────────────────────────
-- Confirmar que los triggers existen:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- ORDER BY event_object_table, trigger_name;
