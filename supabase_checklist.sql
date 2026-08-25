-- Agregar campo checklist a reservas (JSON array)
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT NULL;
