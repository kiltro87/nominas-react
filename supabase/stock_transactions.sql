-- Tabla Acciones (Consolidada)
create table if not exists public.stock_transactions (
    id            uuid default gen_random_uuid() primary key,
    grant_id      text,
    event_date    date,
    quantity_gross  numeric(12, 4),
    quantity_net    numeric(12, 4),
    price_usd       numeric(12, 4),
    amount_eur      numeric(12, 4),
    rate_used       numeric(12, 6),
    op_type         text,
    plan_type       text,
    aeat_num_titulos numeric(12, 4),
    created_at    timestamptz not null default now()
);

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