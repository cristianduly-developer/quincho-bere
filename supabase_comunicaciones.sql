-- Tabla para registrar historial de comunicaciones con clientes
CREATE TABLE IF NOT EXISTS comunicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  cliente_id UUID,
  reserva_id UUID,
  tipo TEXT NOT NULL, -- 'whatsapp', 'email', 'portal'
  asunto TEXT NOT NULL, -- descripción corta: 'Envío portal', 'Recordatorio', 'Confirmación reserva', etc.
  destino TEXT, -- número WA o email destino
  creado_por TEXT DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_org ON comunicaciones(org_id);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_cliente ON comunicaciones(cliente_id);

ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunicaciones_org" ON comunicaciones
  FOR ALL USING (org_id = (SELECT org_id FROM user_orgs WHERE user_id = auth.uid() LIMIT 1));
