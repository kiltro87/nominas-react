-- ─── concept_categories ──────────────────────────────────────────────────────
-- Single source of truth for payroll concept classification.
--
-- This table replaces the local "Categorias de conceptos.json" file.
-- It is used by:
--   1. extractor.py  — looks up category/subcategory during PDF parsing.
--   2. The React UI  — loads subcategory options for the inline concept editor.
--   3. payroll_metrics_mv.sql — NOT referenced directly (uses subcategoria column
--      on the payrolls table instead), but kept in sync via the UI edit flow.
--
-- When the user edits an unmatched concept in the UI, both the payrolls row and
-- this table are updated atomically so future imports resolve correctly.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.concept_categories (
  id           bigint generated always as identity primary key,
  concepto     text        not null unique,
  categoria    text        not null check (categoria in ('Ingreso', 'Deducción')),
  subcategoria text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-update updated_at on row changes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists concept_categories_updated_at on public.concept_categories;
create trigger concept_categories_updated_at
  before update on public.concept_categories
  for each row execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.concept_categories enable row level security;

drop policy if exists "authenticated users can read concept_categories"  on public.concept_categories;
drop policy if exists "authenticated users can write concept_categories" on public.concept_categories;

create policy "authenticated users can read concept_categories"
  on public.concept_categories for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can write concept_categories"
  on public.concept_categories for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── Initial data (mirrors Categorias de conceptos.json) ──────────────────────
insert into public.concept_categories (concepto, categoria, subcategoria) values
  -- Ingresos fijos
  ('Salario Base',                         'Ingreso',   'Ingreso Fijo'),
  ('Plus Convenio',                        'Ingreso',   'Ingreso Fijo'),
  ('Antigüedad',                           'Ingreso',   'Ingreso Fijo'),
  ('Paga Extra Verano',                    'Ingreso',   'Ingreso Fijo'),
  ('Paga Extra Navidad',                   'Ingreso',   'Ingreso Fijo'),
  ('Salario Extranjero 7.P',               'Ingreso',   'Ingreso Fijo'),
  ('Mej Vol Absorb',                       'Ingreso',   'Ingreso Fijo'),
  ('Car Allowance',                        'Ingreso',   'Ingreso Fijo'),
  ('Teletrabajo',                          'Ingreso',   'Ingreso Fijo'),
  -- Ingresos variables (bonus)
  ('SPOT Bonus',                           'Ingreso',   'Ingreso Variable (Bonus)'),
  ('Commissions Deferred',                 'Ingreso',   'Ingreso Variable (Bonus)'),
  -- Ingresos variables (dividendos)
  ('Dividend Pay',                         'Ingreso',   'Ingreso Variable (Dividendos)'),
  -- Ingresos variables (ESPP / RSU)
  ('ESPP Gain',                            'Ingreso',   'Ingreso Variable (ESPP)'),
  ('RSU Gain',                             'Ingreso',   'Ingreso Variable (RSU)'),
  ('Stock Options',                        'Ingreso',   'Ingreso Variable (RSU)'),
  -- Beneficios en especie
  ('Retrib. Flexible',                     'Ingreso',   'Beneficio en Especie'),
  ('Vision BIK',                           'Ingreso',   'Beneficio en Especie'),
  ('GIFT',                                 'Ingreso',   'Beneficio en Especie'),
  ('Ticket Restaurante - NO IRPF',         'Ingreso',   'Beneficio en Especie'),
  ('Ticket Restaurant - NO IRPF',          'Ingreso',   'Beneficio en Especie'),
  ('Ticket Restaurante - Exceso',          'Ingreso',   'Beneficio en Especie'),
  ('Seguro Médico Especie',                'Ingreso',   'Beneficio en Especie'),
  ('Seguro Médico Especie NO IRPF',        'Ingreso',   'Beneficio en Especie'),
  ('Seg. Médico Especie NO IRPF',          'Ingreso',   'Beneficio en Especie'),
  ('Seguro Vida',                          'Ingreso',   'Beneficio en Especie'),
  ('Fitness Reimb.',                       'Ingreso',   'Beneficio en Especie'),
  ('Ticket Transporte - NO IRPF',          'Ingreso',   'Beneficio en Especie'),
  ('Seguro Acc. Especie',                  'Ingreso',   'Beneficio en Especie'),
  -- Ahorro jubilación (empresa)
  ('Plan Pensiones - Aport Empresa',       'Ingreso',   'Ahorro Jubilación'),
  -- Impuestos
  ('Tributación I.R.P.F.',                 'Deducción', 'Impuestos (IRPF)'),
  ('Tributación IRPF',                     'Deducción', 'Impuestos (IRPF)'),
  ('Tax Refund',                           'Deducción', 'Impuestos (Ajustes)'),
  ('Imp. Ingr. A. Cta. Valores Especie',   'Deducción', 'Impuestos (Ajustes)'),
  -- Seguridad Social
  ('Cotización Cont. Comu',                'Deducción', 'Seguridad Social'),
  ('Cotizacion Cont.Comu',                 'Deducción', 'Seguridad Social'),
  ('Cotización MEI',                       'Deducción', 'Seguridad Social'),
  ('Cotización Adic. Solidaridad',         'Deducción', 'Seguridad Social'),
  ('Cotizacion Formación',                 'Deducción', 'Seguridad Social'),
  ('Cotizacion Desempleo',                 'Deducción', 'Seguridad Social'),
  -- Ahorro jubilación (empleado)
  ('Aport. Empleado P. Pens.',             'Deducción', 'Ahorro Jubilación'),
  -- Inversión en acciones (ESPP)
  ('ESPP Deducción',                       'Deducción', 'Inversión Acciones (ESPP)'),
  ('-ESPP Refund',                         'Deducción', 'Inversión Acciones (ESPP)'),
  -- Ajustes contables
  ('Dcto Conceptos en Especie',            'Deducción', 'Ajuste Contable'),
  ('Impm. Ingr. A Cta. Esp. CG.',          'Deducción', 'Ajuste Contable')
on conflict (concepto) do update
  set categoria    = excluded.categoria,
      subcategoria = excluded.subcategoria,
      updated_at   = now();
