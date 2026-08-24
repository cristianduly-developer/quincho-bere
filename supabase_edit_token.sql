-- Agregar edit_token separado para seguridad del portal del cliente
-- El share_token se comparte con invitados (solo lectura)
-- El edit_token es exclusivo del cliente (puede modificar config)
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS edit_token TEXT DEFAULT NULL;

-- Backfill: generar edit_token para reservas que ya tienen share_token
UPDATE reservas
SET edit_token = gen_random_uuid()::text
WHERE share_token IS NOT NULL AND edit_token IS NULL;

-- Index para lookups rapidos por edit_token
CREATE INDEX IF NOT EXISTS idx_reservas_edit_token ON reservas(edit_token) WHERE edit_token IS NOT NULL;
