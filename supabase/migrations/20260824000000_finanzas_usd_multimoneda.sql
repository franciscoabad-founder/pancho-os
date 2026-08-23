-- Finanzas: USD como moneda base, gastos multimoneda, cuentas reales de Pancho
-- y `por_pagar` como espejo de `por_cobrar`.
--
-- Contexto: el modulo venia con MXN por defecto (heredado de un arranque en
-- Mexico) y sin ningun dato. Pancho es ecuatoriano y Ecuador esta dolarizado,
-- asi que la base pasa a USD; cuando viaja registra en otras monedas y el OS
-- guarda ademas el equivalente en USD para poder sumar.
--
-- Idempotente: se puede correr dos veces sin romper nada.

-- ---------------------------------------------------------------------------
-- 1. Tasas de cambio cacheadas a diario (fuente open.er-api.com, base USD).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fx_rates (
  fecha       date PRIMARY KEY,
  base        text NOT NULL DEFAULT 'USD',
  tasas       jsonb NOT NULL,
  fuente      text NOT NULL DEFAULT 'open.er-api.com',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Gastos multimoneda.
--    `monto` sigue siendo la cifra en la moneda en que se pago (no se toca,
--    porque el MCP finanzas_log_gasto y el UI viejo la leen tal cual).
--    `monto_usd` es el numero con el que se suma en todo el modulo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS moneda                text    NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS monto_original        numeric,
  ADD COLUMN IF NOT EXISTS moneda_original       text,
  ADD COLUMN IF NOT EXISTS monto_usd             numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasa_usd              numeric,
  ADD COLUMN IF NOT EXISTS conversion_aproximada boolean NOT NULL DEFAULT false;

-- Backfill: lo que ya existia se asume registrado en la moneda base.
UPDATE public.gastos
   SET monto_original  = COALESCE(monto_original, monto),
       moneda_original = COALESCE(moneda_original, moneda),
       monto_usd       = CASE WHEN monto_usd = 0 AND moneda = 'USD' THEN monto ELSE monto_usd END,
       tasa_usd        = COALESCE(tasa_usd, 1)
 WHERE monto_original IS NULL OR moneda_original IS NULL OR tasa_usd IS NULL;

CREATE INDEX IF NOT EXISTS gastos_fecha_idx ON public.gastos (fecha DESC);

-- ---------------------------------------------------------------------------
-- 3. Cuentas: tipo, estado, moneda base USD y cuentas compartidas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.cuentas
  ADD COLUMN IF NOT EXISTS estado         text NOT NULL DEFAULT 'activa',
  ADD COLUMN IF NOT EXISTS compartida_con text;

-- La moneda por defecto pasa de MXN a USD.
ALTER TABLE public.cuentas ALTER COLUMN moneda SET DEFAULT 'USD';
UPDATE public.cuentas SET moneda = 'USD' WHERE moneda = 'MXN';

DO $$ BEGIN
  ALTER TABLE public.cuentas ADD CONSTRAINT cuentas_tipo_chk
    CHECK (tipo IS NULL OR tipo IN ('banco','wallet_crypto','exchange','fintech','efectivo','compartida'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cuentas ADD CONSTRAINT cuentas_estado_chk
    CHECK (estado IN ('activa','bloqueada','cerrada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. Semilla: las cuentas que Pancho realmente usa. Saldo siempre manual, sin
--    sincronizacion automatica con Metamask, Binance ni ningun banco.
-- ---------------------------------------------------------------------------
INSERT INTO public.cuentas (nombre, tipo, saldo, moneda, estado, compartida_con, notas)
SELECT v.nombre, v.tipo, v.saldo, v.moneda, v.estado, v.compartida_con, v.notas
  FROM (VALUES
    ('Metamask',          'wallet_crypto', 0, 'USD', 'activa',    NULL,   'Wallet cripto. Saldo manual, sin API.'),
    ('Binance',           'exchange',      0, 'USD', 'activa',    NULL,   'Exchange. Saldo manual, sin API.'),
    ('Wise',              'fintech',       0, 'USD', 'activa',    NULL,   'Multimoneda. Saldo manual.'),
    ('Takenos',           'fintech',       0, 'USD', 'activa',    NULL,   'Fintech LATAM. Saldo manual.'),
    ('UglyCash',          'fintech',       0, 'USD', 'activa',    NULL,   'Cripto / USD. Saldo manual.'),
    ('Cuentas con mama',  'compartida',    0, 'USD', 'activa',    'Mama', 'Cuentas compartidas: el saldo no es 100% propio.'),
    ('Banco Ecuador',     'banco',         0, 'USD', 'bloqueada', NULL,   'Congelada por coactiva. Saldo 0, no disponible.')
  ) AS v(nombre, tipo, saldo, moneda, estado, compartida_con, notas)
 WHERE NOT EXISTS (SELECT 1 FROM public.cuentas c WHERE c.nombre = v.nombre);

-- ---------------------------------------------------------------------------
-- 5. `por_pagar`: espejo de `por_cobrar` para deudas puntuales a personas o
--    servicios. Distinta de `deudas`, que es el pasivo estructural de largo
--    plazo (con tasa y cuota).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.por_pagar (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  beneficiario text NOT NULL,
  concepto     text,
  monto        numeric NOT NULL DEFAULT 0,
  moneda       text NOT NULL DEFAULT 'USD',
  estado       text NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','comprometido','pagado')),
  fecha_limite date,
  notas        text
);

CREATE INDEX IF NOT EXISTS por_pagar_estado_idx ON public.por_pagar (estado);

-- ---------------------------------------------------------------------------
-- 6. Por cobrar y deudas: alinear la moneda base a USD.
-- ---------------------------------------------------------------------------
ALTER TABLE public.por_cobrar ALTER COLUMN moneda SET DEFAULT 'USD';

ALTER TABLE public.deudas
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'USD';

-- ---------------------------------------------------------------------------
-- 7. Permisos PostgREST para las tablas nuevas (mismo patron que el resto).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  EXECUTE 'GRANT ALL ON public.por_pagar, public.fx_rates TO service_role';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'GRANT ALL ON public.por_pagar, public.fx_rates TO authenticated, anon';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
