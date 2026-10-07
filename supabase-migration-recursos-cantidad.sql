-- Migración: Agregar campos cantidad y cantidad_disponible a tabla recursos
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar nuevos campos
ALTER TABLE recursos
  ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cantidad_disponible INTEGER DEFAULT 1;

-- 2. Actualizar registros existentes para que tengan cantidad = 1 y cantidad_disponible = 1
UPDATE recursos
SET
  cantidad = COALESCE(cantidad, 1),
  cantidad_disponible = COALESCE(cantidad_disponible, COALESCE(cantidad, 1))
WHERE cantidad IS NULL OR cantidad_disponible IS NULL;

-- 3. Agregar constraint para validar que cantidad_disponible esté entre 0 y cantidad
ALTER TABLE recursos
  DROP CONSTRAINT IF EXISTS chk_cantidad;

ALTER TABLE recursos
  ADD CONSTRAINT chk_cantidad CHECK (
    cantidad > 0
    AND cantidad_disponible >= 0
    AND cantidad_disponible <= cantidad
  );

-- 4. Verificar que los datos estén correctos
SELECT
  COUNT(*) as total_recursos,
  COUNT(*) FILTER (WHERE cantidad IS NULL) as sin_cantidad,
  COUNT(*) FILTER (WHERE cantidad_disponible IS NULL) as sin_cantidad_disponible
FROM recursos;
