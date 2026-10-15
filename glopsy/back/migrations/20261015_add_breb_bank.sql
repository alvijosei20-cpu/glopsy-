-- Bre-B (transferencia instantánea, BanRep Colombia) como método de pago/liquidación.
-- En la cuenta de pagos, la "cuenta" es la llave Bre-B (celular, correo, cédula o alias).
INSERT INTO bancos (pais_id, codigo, nombre, activo)
SELECT 2, 'BREB', 'Bre-B', true
WHERE NOT EXISTS (SELECT 1 FROM bancos WHERE pais_id = 2 AND codigo = 'BREB');
