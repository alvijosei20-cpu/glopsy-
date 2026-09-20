-- ============================================================
-- Cuenta bancaria de pagos del proveedor + catálogo de bancos.
--
-- Las pasarelas (MP, Bold, ENVIA) pasan a ser globales de la
-- plataforma; cada tienda/proveedor solo configura dónde recibe
-- su liquidación (banco + tipo de cuenta + número).
-- ============================================================

CREATE TABLE IF NOT EXISTS bancos (
  id SERIAL PRIMARY KEY,
  pais_id INTEGER REFERENCES paises(id) ON DELETE CASCADE,
  codigo VARCHAR(20) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_banco_pais UNIQUE (pais_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_bancos_pais ON bancos(pais_id) WHERE activo;

-- Colombia
INSERT INTO bancos (pais_id, codigo, nombre)
SELECT p.id, v.codigo, v.nombre
FROM paises p
CROSS JOIN (VALUES
  ('1001', 'Banco de Occidente'),
  ('1002', 'Banco de Bogotá'),
  ('1005', 'Banco Davivienda'),
  ('1006', 'Banco Popular'),
  ('1007', 'Bancolombia'),
  ('1009', 'Banco Agrario'),
  ('1013', 'BBVA Colombia'),
  ('1019', 'Banco Scotiabank Colpatria'),
  ('1032', 'Banco Caja Social'),
  ('1040', 'Banco Itaú'),
  ('1051', 'Banco AV Villas'),
  ('1052', 'Banco GNB Sudameris'),
  ('1053', 'Banco Falabella'),
  ('1058', 'Banco Pichincha'),
  ('1062', 'Bancoomeva'),
  ('1063', 'Banco W'),
  ('1069', 'Banco Santander'),
  ('1070', 'Banco Finandina'),
  ('1071', 'Banco Serfinanza'),
  ('1080', 'Lulo Bank'),
  ('1081', 'Banco Compartir'),
  ('1082', 'Banco Cooperativo Coopcentral')
) AS v(codigo, nombre)
WHERE p.codigo_iso = 'CO'
ON CONFLICT (pais_id, codigo) DO NOTHING;

-- Venezuela
INSERT INTO bancos (pais_id, codigo, nombre)
SELECT p.id, v.codigo, v.nombre
FROM paises p
CROSS JOIN (VALUES
  ('0102', 'Banco de Venezuela'),
  ('0104', 'Venezolano de Crédito'),
  ('0105', 'Mercantil'),
  ('0108', 'BBVA Provincial'),
  ('0114', 'Bancaribe'),
  ('0115', 'Banco Exterior'),
  ('0128', 'Banco Caroní'),
  ('0134', 'Banesco'),
  ('0137', 'Sofitasa'),
  ('0138', 'Banco Plaza'),
  ('0151', 'BFC Banco Fondo Común'),
  ('0156', '100% Banco'),
  ('0157', 'DelSur'),
  ('0163', 'Banco del Tesoro'),
  ('0166', 'Banco Agrícola de Venezuela'),
  ('0168', 'Bancrecer'),
  ('0169', 'Mi Banco'),
  ('0171', 'Banco Activo'),
  ('0172', 'Bancamiga'),
  ('0174', 'Banplus'),
  ('0175', 'Banco Bicentenario'),
  ('0177', 'Banfanb'),
  ('0191', 'Banco Nacional de Crédito (BNC)')
) AS v(codigo, nombre)
WHERE p.codigo_iso = 'VE'
ON CONFLICT (pais_id, codigo) DO NOTHING;

-- Cuenta de liquidación por tienda/proveedor.
ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS banco_codigo VARCHAR(20);
ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(120);
ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS tipo_cuenta VARCHAR(20);
ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(40);
ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS titular_cuenta VARCHAR(150);
ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS titular_documento VARCHAR(40);
