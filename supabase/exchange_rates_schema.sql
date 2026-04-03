-- Table: exchange_rates
-- Stores daily USD/EUR rates sourced from the Banco de España REST API.
-- Run this once in the Supabase SQL Editor before using the BDE sync feature.

create table if not exists public.exchange_rates (
  exchange_date date        primary key,
  usd_per_eur   numeric(10, 6) not null,
  source        text        not null default 'BDE',
  updated_at    timestamptz not null default now()
);

-- RLS
alter table public.exchange_rates enable row level security;

create policy "authenticated can read exchange_rates"
  on public.exchange_rates for select
  to authenticated using (true);

create policy "authenticated can insert exchange_rates"
  on public.exchange_rates for insert
  to authenticated with check (true);

create policy "authenticated can update exchange_rates"
  on public.exchange_rates for update
  to authenticated using (true);

grant select, insert, update on public.exchange_rates to authenticated;
