-- Tabla de analytics del portal — registra cada acción de usuarios
CREATE TABLE IF NOT EXISTS portal_eventos (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL,
  reserva_id TEXT NOT NULL,
  evento TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_eventos_reserva ON portal_eventos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_portal_eventos_org ON portal_eventos(org_id);
CREATE INDEX IF NOT EXISTS idx_portal_eventos_evento ON portal_eventos(evento);

-- RLS: permitir INSERT desde anon (portales publicos) y SELECT para authenticated
ALTER TABLE portal_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_portal_eventos" ON portal_eventos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "authenticated_select_portal_eventos" ON portal_eventos
  FOR SELECT USING (true);
