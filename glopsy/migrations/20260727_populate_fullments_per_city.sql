-- Poblar la tabla fullments con un registro para cada ciudad existente en la tabla ciudades
INSERT INTO fullments (ciudad_id, costo_kg, costo_dms, estado)
SELECT id, 5.00, 2.50, 'activo'
FROM ciudades
ON CONFLICT (ciudad_id) DO NOTHING;
