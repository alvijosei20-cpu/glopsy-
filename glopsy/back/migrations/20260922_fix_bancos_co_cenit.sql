-- ============================================================
-- Corrige el catálogo de bancos de Colombia a los códigos CENIT
-- oficiales (Banco de la República) y agrega las billeteras/fintech.
--
-- El seed original tenía los códigos CENIT correctos pero los NOMBRES
-- cruzados (p. ej. 1001 decía "Banco de Occidente" cuando 1001 es
-- "Banco de Bogotá"). Aquí:
--   1) se corrige el nombre de cada código,
--   2) se agregan los códigos que faltaban (incl. Nequi y Nu),
--   3) se desactivan códigos que no existen en CENIT (1005, 1080-1082),
--   4) se remapea la cuenta guardada de cada tienda por NOMBRE (que era
--      el dato que el usuario realmente eligió) al código correcto.
-- ============================================================

CREATE TEMP TABLE tmp_bancos_co (codigo VARCHAR(20) PRIMARY KEY, nombre VARCHAR(120)) ON COMMIT DROP;

INSERT INTO tmp_bancos_co (codigo, nombre) VALUES
  ('1001', 'Banco de Bogotá'),
  ('1002', 'Banco Popular'),
  ('1006', 'Banco Itaú'),
  ('1007', 'Bancolombia'),
  ('1009', 'Citibank Colombia'),
  ('1012', 'Banco GNB Sudameris'),
  ('1013', 'BBVA Colombia'),
  ('1019', 'Banco Scotiabank Colpatria'),
  ('1023', 'Banco de Occidente'),
  ('1032', 'Banco Caja Social'),
  ('1040', 'Banco Agrario'),
  ('1042', 'BNP Paribas'),
  ('1047', 'Banco Mundo Mujer'),
  ('1051', 'Banco Davivienda'),
  ('1052', 'Banco AV Villas'),
  ('1053', 'Banco WWB (Banco W)'),
  ('1058', 'BAN100'),
  ('1059', 'Bancamía'),
  ('1060', 'Banco Pichincha'),
  ('1061', 'Bancoomeva'),
  ('1062', 'Banco Falabella'),
  ('1063', 'Banco Finandina'),
  ('1065', 'Banco Santander'),
  ('1066', 'Banco Coopcentral'),
  ('1067', 'Banco Compartir (Mibanco)'),
  ('1069', 'Banco Serfinanza'),
  ('1070', 'Lulo Bank'),
  ('1071', 'Banco JP Morgan'),
  ('1507', 'Nequi'),
  ('1551', 'Daviplata'),
  ('1801', 'Movii'),
  ('1803', 'Powwi'),
  ('1805', 'Banco BTG Pactual'),
  ('1808', 'Bold'),
  ('1809', 'Nu Colombia'),
  ('1811', 'RappiPay'),
  ('1813', 'Santander Consumer'),
  ('1814', 'Global66');

-- 1) Corrige el nombre de los códigos ya existentes.
UPDATE bancos b
SET nombre = t.nombre, activo = true
FROM tmp_bancos_co t, paises p
WHERE b.pais_id = p.id AND p.codigo_iso = 'CO' AND b.codigo = t.codigo;

-- 2) Agrega los códigos faltantes.
INSERT INTO bancos (pais_id, codigo, nombre, activo)
SELECT p.id, t.codigo, t.nombre, true
FROM paises p CROSS JOIN tmp_bancos_co t
WHERE p.codigo_iso = 'CO'
ON CONFLICT (pais_id, codigo) DO NOTHING;

-- 3) Desactiva códigos que no pertenecen al catálogo CENIT oficial.
UPDATE bancos b
SET activo = false
FROM paises p
WHERE b.pais_id = p.id AND p.codigo_iso = 'CO'
  AND NOT EXISTS (SELECT 1 FROM tmp_bancos_co t WHERE t.codigo = b.codigo);

-- 4) Remapea las cuentas ya guardadas: el nombre era correcto, el código no.
UPDATE tiendas t
SET banco_codigo = m.new_codigo, banco_nombre = m.new_nombre
FROM (VALUES
  ('1001', 'Banco de Occidente',            '1023', 'Banco de Occidente'),
  ('1002', 'Banco de Bogotá',               '1001', 'Banco de Bogotá'),
  ('1005', 'Banco Davivienda',              '1051', 'Banco Davivienda'),
  ('1006', 'Banco Popular',                 '1002', 'Banco Popular'),
  ('1009', 'Banco Agrario',                 '1040', 'Banco Agrario'),
  ('1040', 'Banco Itaú',                    '1006', 'Banco Itaú'),
  ('1051', 'Banco AV Villas',               '1052', 'Banco AV Villas'),
  ('1052', 'Banco GNB Sudameris',           '1012', 'Banco GNB Sudameris'),
  ('1053', 'Banco Falabella',               '1062', 'Banco Falabella'),
  ('1058', 'Banco Pichincha',               '1060', 'Banco Pichincha'),
  ('1062', 'Bancoomeva',                    '1061', 'Bancoomeva'),
  ('1063', 'Banco W',                       '1053', 'Banco WWB (Banco W)'),
  ('1069', 'Banco Santander',               '1065', 'Banco Santander'),
  ('1070', 'Banco Finandina',               '1063', 'Banco Finandina'),
  ('1071', 'Banco Serfinanza',              '1069', 'Banco Serfinanza'),
  ('1080', 'Lulo Bank',                     '1070', 'Lulo Bank'),
  ('1081', 'Banco Compartir',               '1067', 'Banco Compartir (Mibanco)'),
  ('1082', 'Banco Cooperativo Coopcentral', '1066', 'Banco Coopcentral')
) AS m(old_codigo, old_nombre, new_codigo, new_nombre)
WHERE t.banco_codigo = m.old_codigo AND t.banco_nombre = m.old_nombre;

-- 5) Nequi/Nu guardados con un código distinto (añadidos a mano en producción).
UPDATE tiendas SET banco_codigo = '1507', banco_nombre = 'Nequi'
WHERE banco_codigo <> '1507' AND lower(banco_nombre) = 'nequi';

UPDATE tiendas SET banco_codigo = '1809', banco_nombre = 'Nu Colombia'
WHERE banco_codigo <> '1809'
  AND lower(banco_nombre) IN ('nu', 'nu colombia', 'nu bank', 'nubank');
