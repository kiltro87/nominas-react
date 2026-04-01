-- Portfolio transactions table
-- One row per processed PDF (RSU release, ESPP acquisition, or trade/sell).
-- Populated by pipeline/portfolio_ingestor.py reading the Excel from Google Drive.

CREATE TABLE IF NOT EXISTS public.portfolio_transactions (
  id               BIGSERIAL PRIMARY KEY,
  file_name        TEXT        NOT NULL UNIQUE,  -- deduplication key (source PDF filename)
  operation_date   DATE,                         -- RELEASE_PURCHASE_TRADE_DATE
  settlement_date  DATE,                         -- SETL_DATE (trades/sells only)
  award_number     TEXT,                         -- RSU award ID
  quantity         NUMERIC     NOT NULL,          -- negative for sells
  stock_price_usd  NUMERIC,
  net_amount_usd   NUMERIC,
  aeat_tipo        TEXT,                          -- 'AD' (adquisicion) | 'TR' (venta)
  aeat_fecha       DATE,
  aeat_num_titulos NUMERIC,                       -- always positive
  conversion_rate  NUMERIC,                       -- USD → EUR rate used
  aeat_importe_eur NUMERIC,
  ordering         INTEGER,                       -- yyyymmdd for chronological sort
  cumulative_qty   NUMERIC,                       -- running total of shares held after this tx
  ingested_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_transactions_ordering_idx
  ON public.portfolio_transactions (ordering ASC);

CREATE INDEX IF NOT EXISTS portfolio_transactions_aeat_tipo_idx
  ON public.portfolio_transactions (aeat_tipo);

ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read portfolio"
  ON public.portfolio_transactions
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.portfolio_transactions TO authenticated;
