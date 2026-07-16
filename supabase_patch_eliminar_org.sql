-- ══════════════════════════════════════════════════════════════
-- Fix H-04: Eliminación transaccional de datos de una org
-- Todas las tablas se borran en una sola transacción.
-- Si falla en el medio, no queda estado inconsistente.
-- Correr en el Supabase de Quincho (satelital).
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION eliminar_datos_org(p_org_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM user_orgs WHERE org_id = p_org_id LIMIT 1;

  DELETE FROM extras_reserva      WHERE org_id = p_org_id;
  DELETE FROM pagos               WHERE org_id = p_org_id;
  DELETE FROM recordatorios       WHERE org_id = p_org_id;
  DELETE FROM reservas            WHERE org_id = p_org_id;
  DELETE FROM bloqueos            WHERE org_id = p_org_id;
  DELETE FROM clientes            WHERE org_id = p_org_id;
  DELETE FROM gastos              WHERE org_id = p_org_id;
  DELETE FROM tareas              WHERE org_id = p_org_id;
  DELETE FROM precios_temporada   WHERE org_id = p_org_id;
  DELETE FROM temporadas_precio   WHERE org_id = p_org_id;
  DELETE FROM servicios_extras    WHERE org_id = p_org_id;
  DELETE FROM turnos_recurso      WHERE org_id = p_org_id;
  DELETE FROM recursos            WHERE org_id = p_org_id;
  DELETE FROM config              WHERE org_id = p_org_id;
  DELETE FROM tenant_access       WHERE tenant_id = p_org_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM user_orgs WHERE user_id = v_user_id;
  END IF;
END;
$$;
