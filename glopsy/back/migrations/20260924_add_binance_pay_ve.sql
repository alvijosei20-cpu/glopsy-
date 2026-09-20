-- ============================================================
-- Venezuela: agregar Binance Pay como opción de cobro/liquidación.
-- Se registra en el catálogo de "bancos" del país para que aparezca
-- en el select de la cuenta de pagos del proveedor.
-- ============================================================

INSERT INTO bancos (pais_id, codigo, nombre)
SELECT p.id, v.codigo, v.nombre
FROM paises p
CROSS JOIN (VALUES
  ('BINANCE_PAY', 'Binance Pay')
) AS v(codigo, nombre)
WHERE p.codigo_iso = 'VE'
ON CONFLICT (pais_id, codigo) DO NOTHING;
