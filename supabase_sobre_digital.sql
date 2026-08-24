-- Agregar columna sobre_digital a reservas (config del sobre por reserva)
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS sobre_digital JSONB DEFAULT NULL;

-- Tabla para mensajes del mural (escritos por invitados sin auth)
CREATE TABLE IF NOT EXISTS mensajes_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  share_token TEXT NOT NULL,
  nombre TEXT NOT NULL DEFAULT '',
  mensaje TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_evento_token ON mensajes_evento(share_token);

-- RPC para que invitados (sin auth) dejen un mensaje
CREATE OR REPLACE FUNCTION public_agregar_mensaje(p_share_token TEXT, p_nombre TEXT, p_mensaje TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id FROM reservas WHERE share_token = p_share_token LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Evento no encontrado');
  END IF;
  INSERT INTO mensajes_evento (org_id, share_token, nombre, mensaje)
  VALUES (v_org_id, p_share_token, LEFT(p_nombre, 50), LEFT(p_mensaje, 500));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC para obtener mensajes de un evento (público, sin auth)
CREATE OR REPLACE FUNCTION public_obtener_mensajes(p_share_token TEXT)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'nombre', nombre, 'mensaje', mensaje, 'creadoEn', creado_en)
    ORDER BY creado_en DESC
  ), '[]'::jsonb)
  FROM mensajes_evento
  WHERE share_token = p_share_token;
$$;

-- RPC para obtener config del sobre digital (público, sin auth)
CREATE OR REPLACE FUNCTION public_obtener_sobre(p_share_token TEXT)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(sobre_digital, '{}'::jsonb)
  FROM reservas
  WHERE share_token = p_share_token
  LIMIT 1;
$$;

-- RLS para mensajes_evento (los usuarios autenticados ven los de su org)
ALTER TABLE mensajes_evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensajes_evento_org" ON mensajes_evento
  FOR ALL USING (org_id = (SELECT org_id FROM user_orgs WHERE user_id = auth.uid() LIMIT 1));
