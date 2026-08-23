-- Agregar columna fotos_lugar a la tabla config (array JSON de {url, alt})
ALTER TABLE config ADD COLUMN IF NOT EXISTS fotos_lugar JSONB DEFAULT '[]'::jsonb;

-- Función pública para obtener las fotos del lugar por org_id
-- Solo devuelve fotos_lugar, no expone otros datos de config
CREATE OR REPLACE FUNCTION get_fotos_lugar(p_org_id UUID)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(fotos_lugar, '[]'::jsonb)
  FROM config
  WHERE org_id = p_org_id
  LIMIT 1;
$$;
