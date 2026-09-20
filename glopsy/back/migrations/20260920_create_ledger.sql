-- ============================================================
-- Sistema contable (ledger de doble entrada) para glopsy.
--
-- Modelo: una cuenta central de la plataforma recibe los pagos
-- (Bold en Colombia, Binance internacional) y luego liquida a los
-- proveedores (payout diario). Los saldos NO se guardan de forma
-- mutable: se derivan de los asientos (ledger_postings).
--
-- Saldo del proveedor:
--   bucket = 'provider_deferred'  -> ventas no entregadas o en ventana
--   bucket = 'provider_available' -> entregadas y fuera de ventana (2 días hábiles)
-- ============================================================

-- Reglas de comisión de la plataforma (por producto o categoría).
-- Precedencia: producto+tienda > producto > categoría+tienda > categoría > global+tienda > global.
CREATE TABLE IF NOT EXISTS commission_rules (
  id SERIAL PRIMARY KEY,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'categoria', 'producto')),
  scope_id INTEGER,
  tienda_id BIGINT REFERENCES tiendas(usrid) ON DELETE CASCADE,
  porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_lookup
  ON commission_rules(scope, scope_id, tienda_id) WHERE activo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_rules_scope
  ON commission_rules(scope, COALESCE(scope_id, 0), COALESCE(tienda_id, 0));

-- Cuentas contables. kind define el signo del saldo; bucket agrupa el rol.
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind VARCHAR(12) NOT NULL CHECK (kind IN ('asset', 'liability', 'revenue', 'expense')),
  bucket VARCHAR(30) NOT NULL CHECK (bucket IN (
    'processor', 'bank', 'provider_deferred', 'provider_available',
    'commission', 'withholding', 'payout_pending'
  )),
  provider_ref TEXT,
  moneda VARCHAR(10) NOT NULL,
  tienda_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_provider
  ON ledger_accounts(provider_ref, moneda) WHERE provider_ref IS NOT NULL;

-- Cabecera de cada movimiento contable.
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('sale', 'release', 'refund', 'payout', 'adjustment')),
  order_id BIGINT,
  provider_ref TEXT,
  tienda_id BIGINT,
  provider VARCHAR(30),
  moneda VARCHAR(10) NOT NULL,
  referencia_externa TEXT,
  descripcion TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_tx_order ON ledger_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_provider ON ledger_transactions(provider_ref, moneda);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_tipo ON ledger_transactions(tipo, created_at);
-- Una sola venta (y una sola liberación) por orden.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_tx_sale_order
  ON ledger_transactions(order_id) WHERE tipo = 'sale' AND order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_tx_release_order
  ON ledger_transactions(order_id) WHERE tipo = 'release' AND order_id IS NOT NULL;

-- Asientos: débitos y créditos. Σ(debit) = Σ(credit) por transacción.
CREATE TABLE IF NOT EXISTS ledger_postings (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
  debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ledger_postings_un_sentido CHECK (NOT (debit > 0 AND credit > 0)),
  CONSTRAINT ledger_postings_monto CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_postings_account ON ledger_postings(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_postings_tx ON ledger_postings(transaction_id);

-- Lotes de pago (liquidación diaria a proveedores).
CREATE TABLE IF NOT EXISTS payouts (
  id BIGSERIAL PRIMARY KEY,
  provider_ref TEXT NOT NULL,
  moneda VARCHAR(10) NOT NULL,
  total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'fallido')),
  metodo VARCHAR(30),
  referencia TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_provider ON payouts(provider_ref, moneda, estado);

CREATE TABLE IF NOT EXISTS payout_items (
  id BIGSERIAL PRIMARY KEY,
  payout_id BIGINT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  order_id BIGINT,
  monto NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_items_payout ON payout_items(payout_id);

-- Saldo por cuenta (derivado). kind asset/expense -> débito - crédito;
-- liability/revenue -> crédito - débito.
CREATE OR REPLACE VIEW ledger_account_balances AS
SELECT
  a.id,
  a.code,
  a.kind,
  a.bucket,
  a.provider_ref,
  a.moneda,
  a.tienda_id,
  CASE
    WHEN a.kind IN ('asset', 'expense')
      THEN COALESCE(SUM(p.debit - p.credit), 0)
    ELSE COALESCE(SUM(p.credit - p.debit), 0)
  END AS balance
FROM ledger_accounts a
LEFT JOIN ledger_postings p ON p.account_id = a.id
GROUP BY a.id;
