-- Migración v4: modelo multi-ciudad
-- Ejecutar en orden; hace rollback automático si algo falla.

BEGIN;

-- 1. Tabla ciudades
CREATE TABLE IF NOT EXISTS ciudades (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  estado         VARCHAR(80)  NOT NULL DEFAULT 'Oaxaca',
  pais           CHAR(2)      NOT NULL DEFAULT 'MX',
  lat            DECIMAL(9,6),
  lng            DECIMAL(9,6),
  radio_cobertura_km SMALLINT NOT NULL DEFAULT 10,
  activa         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed: ciudades iniciales
INSERT INTO ciudades (id, nombre, lat, lng, radio_cobertura_km)
VALUES
  (1, 'Puerto Escondido',    15.860000, -97.070000, 10),
  (2, 'Santa María Zacatepec', 16.350000, -97.980000, 10)
ON CONFLICT (id) DO NOTHING;

SELECT setval('ciudades_id_seq', (SELECT MAX(id) FROM ciudades));

-- 2. Agregar ciudad_id a usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ciudad_id INTEGER REFERENCES ciudades(id) ON DELETE SET NULL;

-- 3. Agregar ciudad_id a negocios
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS ciudad_id INTEGER REFERENCES ciudades(id) ON DELETE SET NULL;

-- Negocios existentes → Zacatepec (legacy)
UPDATE negocios SET ciudad_id = 2 WHERE ciudad_id IS NULL;

-- 4. Agregar ciudad_id a repartidores
ALTER TABLE repartidores
  ADD COLUMN IF NOT EXISTS ciudad_id INTEGER REFERENCES ciudades(id) ON DELETE SET NULL;

UPDATE repartidores SET ciudad_id = 2 WHERE ciudad_id IS NULL;

-- 5. Agregar ciudad_id a pedidos (denormalizado para queries rápidas)
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS ciudad_id INTEGER REFERENCES ciudades(id) ON DELETE SET NULL;

UPDATE pedidos SET ciudad_id = 2 WHERE ciudad_id IS NULL;

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_negocios_ciudad     ON negocios(ciudad_id);
CREATE INDEX IF NOT EXISTS idx_repartidores_ciudad ON repartidores(ciudad_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_ciudad      ON pedidos(ciudad_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_ciudad     ON usuarios(ciudad_id);

COMMIT;
