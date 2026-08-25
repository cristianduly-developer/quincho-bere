-- Agregar campo grupo a servicios_extras
ALTER TABLE servicios_extras ADD COLUMN IF NOT EXISTS grupo TEXT DEFAULT NULL;
