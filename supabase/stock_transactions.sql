-- =============================================================================
-- Tabla: stock_transactions
-- =============================================================================
-- Almacena las operaciones de acciones (RSU y ESPP) de Salesforce (CRM)
-- procesadas desde el fichero BenefitHistory.xlsx exportado desde E*TRADE.
--
-- Origen del dato:
--   E*TRADE Benefits → My Account → Benefits → Benefit History → Export
--   El fichero contiene dos pestañas: "ESPP" y "Restricted Stock".
--
-- Tipos de operación (op_type):
--   'AD' – Adquisición: entrega de acciones (vest RSU o compra ESPP).
--   'TR' – Transmisión/Venta: venta inmediata de acciones para cubrir la
--          retención fiscal (RSU) o venta explícita (ESPP Sell event).
--
-- Tipos de plan (plan_type):
--   'RSU' – Restricted Stock Units (pestaña "Restricted Stock").
--   'ESPP' – Employee Stock Purchase Plan (pestaña "ESPP").
--
-- Campos AEAT:
--   aeat_num_titulos – Número de títulos declarables (= quantity_gross).
--   amount_eur       – Importe en euros calculado con el tipo BDE del día
--                      del evento (con lookback de hasta 10 días hábiles).
--   rate_used        – Tipo de cambio USD/EUR efectivamente aplicado.
--
-- Notas:
--   • La columna cumulative_quantity (acumulado de acciones en cartera)
--     NO se almacena en DB — se calcula dinámicamente en el frontend
--     ordenando por event_date y sumando/restando según op_type.
--   • Para RSU, cada vest genera DOS filas:
--       AD con quantity_gross = Vested Qty (base AEAT) y
--       TR con quantity_gross = Sellable Qty (acciones vendidas por el
--          broker E*TRADE para pagar la retención en España, ~47%).
-- =============================================================================

create table if not exists public.stock_transactions (
    id               uuid default gen_random_uuid() primary key,
    grant_id         text,                  -- Grant Number de E*TRADE (solo RSU)
    event_date       date not null,         -- Fecha del evento (vest / compra / venta)
    quantity_gross   numeric(12, 4) not null, -- Cantidad bruta (base para AEAT)
    quantity_net     numeric(12, 4),        -- Cantidad neta recibida (tras venta fiscal)
    price_usd        numeric(12, 4),        -- Precio de mercado en USD en la fecha del evento
    amount_eur       numeric(12, 4),        -- Importe EUR = (aeat_num_titulos × price_usd) / rate_used
    rate_used        numeric(12, 6),        -- Tipo de cambio USD/EUR aplicado (fuente: BDE)
    op_type          text not null,         -- 'AD' (adquisición) | 'TR' (transmisión/venta)
    plan_type        text not null,         -- 'RSU' | 'ESPP'
    aeat_num_titulos numeric(12, 4),        -- = quantity_gross; duplicado explícito para AEAT
    created_at       timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.stock_transactions enable row level security;

create policy "authenticated can read stock_transactions"
  on public.stock_transactions for select
  to authenticated using (true);

create policy "authenticated can insert stock_transactions"
  on public.stock_transactions for insert
  to authenticated with check (true);

create policy "authenticated can update stock_transactions"
  on public.stock_transactions for update
  to authenticated using (true);

grant select, insert, update on public.stock_transactions to authenticated;
