-- Datos fiscales para la plantilla DIAN (resolución, vigencia, dirección y régimen).
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS numero_resolucion VARCHAR(40);
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS resolucion_fecha_desde DATE;
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS resolucion_fecha_hasta DATE;
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS direccion_fiscal VARCHAR(200);
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS regimen VARCHAR(5);
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS responsabilidad VARCHAR(10);
