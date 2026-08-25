-- ══════════════════════════════════════
-- MERCADO DEL EVENTO
-- ══════════════════════════════════════

-- Catálogo de productos (max 10 por org)
CREATE TABLE IF NOT EXISTS mercado_productos (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📦',
  precio INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mercado_productos_org ON mercado_productos(org_id);

ALTER TABLE mercado_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_mercado_productos" ON mercado_productos
  FOR ALL USING (true) WITH CHECK (true);

-- Pedidos durante eventos
CREATE TABLE IF NOT EXISTS mercado_pedidos (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL,
  reserva_id TEXT NOT NULL,
  producto_nombre TEXT NOT NULL,
  producto_emoji TEXT NOT NULL DEFAULT '📦',
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mercado_pedidos_org ON mercado_pedidos(org_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pedidos_reserva ON mercado_pedidos(reserva_id);

ALTER TABLE mercado_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_mercado_pedidos" ON mercado_pedidos
  FOR ALL USING (true) WITH CHECK (true);

-- Permitir insert anónimo para pedidos desde el portal
CREATE POLICY "anon_insert_mercado_pedidos" ON mercado_pedidos
  FOR INSERT TO anon WITH CHECK (true);
-- Permitir select anónimo para ver pedidos propios
CREATE POLICY "anon_select_mercado_pedidos" ON mercado_pedidos
  FOR SELECT TO anon USING (true);

-- Campo en reservas para activar/desactivar mercado por evento
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS mercado_activo BOOLEAN DEFAULT false;
