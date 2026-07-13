-- ══════════════════════════════════════════════════════════════
-- Fix E-04: Proteger columna plan en tabla config
-- El usuario puede UPDATE su config (nombre, colores, etc.)
-- pero NO debe poder cambiar el plan.
-- ══════════════════════════════════════════════════════════════

-- Trigger que impide que el usuario cambie config.plan
CREATE OR REPLACE FUNCTION proteger_config_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    RAISE EXCEPTION 'BLOQUEADO: No se puede modificar el plan desde la app';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_proteger_config_plan ON config;
CREATE TRIGGER trig_proteger_config_plan
  BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION proteger_config_plan();

-- Agregar límite de colaboradores a plan_limites
ALTER TABLE plan_limites ADD COLUMN IF NOT EXISTS max_colaboradores INT;
UPDATE plan_limites SET max_colaboradores = 2  WHERE plan = 'basico';
UPDATE plan_limites SET max_colaboradores = 5  WHERE plan = 'profesional';
UPDATE plan_limites SET max_colaboradores = 10 WHERE plan = 'premium';
UPDATE plan_limites SET max_colaboradores = 10 WHERE plan = 'sincargo';
UPDATE plan_limites SET max_colaboradores = 3  WHERE plan = 'demo';
