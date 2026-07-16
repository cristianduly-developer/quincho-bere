-- ══════════════════════════════════════════════════════════════
-- M-07: Condiciones de alquiler configurables por negocio
-- Se incluyen en el email de confirmación de reserva.
-- Correr en el Supabase de Quincho (satelital).
-- ══════════════════════════════════════════════════════════════

ALTER TABLE config ADD COLUMN IF NOT EXISTS condiciones_email TEXT DEFAULT '';
