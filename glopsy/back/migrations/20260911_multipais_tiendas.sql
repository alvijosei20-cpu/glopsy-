-- Fase 1 multicountry: cada tienda pertenece a un país. Determina moneda,
-- locale, zona horaria y dominio raíz (root) desde donde vive la tienda.
-- Venezuela opera en USD (pagos PayPal) — bolívares fuera.

-- 1) Skip si ya se aplicó (idempotencia por re-ejecución de migraciones no versionadas).

-- 2) País por tienda (NULL = Colombia por defecto).
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS pais_id INTEGER REFERENCES public.paises(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tiendas_pais ON public.tiendas(pais_id);

-- 3) Moneda, locale y dominio raíz a nivel de país (config por país).
ALTER TABLE public.paises ADD COLUMN IF NOT EXISTS moneda VARCHAR(10);
ALTER TABLE public.paises ADD COLUMN IF NOT EXISTS locale VARCHAR(20);
ALTER TABLE public.paises ADD COLUMN IF NOT EXISTS dominio_raiz VARCHAR(80);

-- 4) Campo heredable por tienda (NULL => usa config del país).
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS moneda VARCHAR(10);
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS locale VARCHAR(20);
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS dominio_raiz VARCHAR(80);

-- 5) Colombia y Venezuela con su moneda/locale/dominio (Venezuela en USD, pago PayPal).
INSERT INTO paises (nombre, codigo_iso, moneda, locale, dominio_raiz)
VALUES ('Colombia', 'CO', 'COP', 'es-CO', 'glopsy.shop')
ON CONFLICT (nombre) DO UPDATE SET codigo_iso = EXCLUDED.codigo_iso, moneda = EXCLUDED.moneda, locale = EXCLUDED.locale, dominio_raiz = EXCLUDED.dominio_raiz;

-- NOTA: Venezuela aún no tiene dominio propio registrado, por eso comparte el
-- root glopsy.shop (moneda USD). Cuando exista un dominio .ve registrado,
-- actualizar dominio_raiz de esta fila (ej. 'glopsy.com.ve').
INSERT INTO paises (nombre, codigo_iso, moneda, locale, dominio_raiz)
VALUES ('Venezuela', 'VE', 'USD', 'es-VE', 'glopsy.shop')
ON CONFLICT (nombre) DO UPDATE SET codigo_iso = EXCLUDED.codigo_iso, moneda = EXCLUDED.moneda, locale = EXCLUDED.locale, dominio_raiz = EXCLUDED.dominio_raiz;

-- 6) Backfill: las tiendas existentes son de Colombia.
UPDATE public.tiendas SET pais_id = (SELECT id FROM public.paises WHERE codigo_iso = 'CO') WHERE pais_id IS NULL;