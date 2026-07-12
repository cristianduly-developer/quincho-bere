-- ══════════════════════════════════════════════════════════════
-- Fix E-01: Enforcar límite de reservas/mes server-side
-- El frontend aplica getPlanLimits() pero es bypasseable.
-- Este trigger valida contra plan_limites.max_reservas_mes.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_reservas_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_max  INT;
  v_count INT;
BEGIN
  v_plan := plan_tenant(NEW.org_id::uuid);

  SELECT max_reservas_mes INTO v_max
  FROM plan_limites WHERE plan = v_plan;

  -- NULL = sin límite
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM reservas
  WHERE org_id = NEW.org_id
    AND fecha >= date_trunc('month', CURRENT_DATE)
    AND fecha < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'LIMITE_PLAN: Alcanzaste el límite de % reservas/mes del plan %', v_max, v_plan;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_check_reservas_limit ON reservas;
CREATE TRIGGER trig_check_reservas_limit
  BEFORE INSERT ON reservas
  FOR EACH ROW EXECUTE FUNCTION check_reservas_limit();

-- ══════════════════════════════════════════════════════════════
-- Límite de espacios (recursos) por plan
-- ══════════════════════════════════════════════════════════════

-- Primero agregar columna max_espacios a plan_limites si no existe
ALTER TABLE plan_limites ADD COLUMN IF NOT EXISTS max_espacios INT;
UPDATE plan_limites SET max_espacios = 1 WHERE plan = 'basico';
UPDATE plan_limites SET max_espacios = 3 WHERE plan = 'profesional';
UPDATE plan_limites SET max_espacios = 5 WHERE plan = 'premium';
UPDATE plan_limites SET max_espacios = 5 WHERE plan = 'sincargo';

CREATE OR REPLACE FUNCTION check_espacios_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_max  INT;
  v_count INT;
BEGIN
  v_plan := plan_tenant(NEW.org_id::uuid);

  SELECT max_espacios INTO v_max
  FROM plan_limites WHERE plan = v_plan;

  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM recursos WHERE org_id = NEW.org_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'LIMITE_PLAN: Alcanzaste el límite de % espacios del plan %', v_max, v_plan;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_check_espacios_limit ON recursos;
CREATE TRIGGER trig_check_espacios_limit
  BEFORE INSERT ON recursos
  FOR EACH ROW EXECUTE FUNCTION check_espacios_limit();
