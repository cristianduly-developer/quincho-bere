-- Tabla de consultas recibidas (contador de leads por canal)
CREATE TABLE IF NOT EXISTS consultas (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL,
  fecha DATE NOT NULL,
  canal TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultas_org ON consultas(org_id);
CREATE INDEX IF NOT EXISTS idx_consultas_fecha ON consultas(fecha);

ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_consultas" ON consultas
  FOR ALL USING (true) WITH CHECK (true);
