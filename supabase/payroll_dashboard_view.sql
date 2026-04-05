-- Regular VIEW for current schema: public.payrolls
-- Columns expected in payrolls:
-- id, year, month, item, amount, category, subcategory, file_id, file_name, created_at
--
-- This view centralizes business formulas so the UI only renders.
-- Being a regular view it always reflects the latest data without manual refresh.

drop view if exists public.payroll_metrics_mv;

create view public.payroll_metrics_mv as
with base as (
  select
    n.year::int as year,
    n.month::int as month,
    trim(n.item) as concepto,
    trim(coalesce(n.category, '')) as categoria,
    trim(coalesce(n.subcategory, '')) as subcategoria,
    n.amount::numeric as amount
  from public.payrolls n
),
classified as (
  select
    year,
    month,
    concepto,
    categoria,
    subcategoria,
    amount,
    case
      when concepto ilike '%Tributación I.R.P.F%' then 'irpf'
      when concepto ilike '%IRPF%' and concepto like '%\%%' escape '\' then 'irpf_percent'
      when subcategoria = 'Seguridad Social' then 'ss'
      -- Pension: subcategoría takes priority over concept-name patterns.
      -- Company contribution has categoría=Ingreso; employee has categoría=Deducción.
      -- Both share subcategoría = 'Ahorro Jubilación'.
      when subcategoria = 'Ahorro Jubilación' and lower(categoria) = 'ingreso' then 'pp_company'
      when subcategoria = 'Ahorro Jubilación'                                   then 'pp_employee'
      -- Fallback patterns for older records without subcategoría populated
      when concepto ilike '%PLAN PENSIONES%' and (concepto ilike '%EMPRESA%' or concepto ilike '%COMPANY%') then 'pp_company'
      when concepto ilike '%PLAN PENSIONES%' or concepto ilike '%P. PENS.%'    then 'pp_employee'
      -- ESPP: prefer subcategoría, fall back to concepto patterns
      when subcategoria = 'Inversión Acciones (ESPP)' and concepto ilike '%DEDUCC%' then 'espp_deduction'
      when subcategoria = 'Inversión Acciones (ESPP)'                          then 'espp_refund'
      when concepto ilike '%ESPP DEDUCC%' then 'espp_deduction'
      when concepto ilike '%ESPP REFUND%' then 'espp_refund'
      -- RSU: prefer subcategoría, fall back to concepto patterns
      when subcategoria = 'Ingreso Variable (RSU)'                             then 'rsu'
      when concepto ilike '%RSU GAIN%' or concepto ilike '%STOCK OPTIONS%'     then 'rsu'
      -- Deferred/benefits in kind: prefer subcategoría
      when subcategoria = 'Beneficio en Especie'                               then 'deferred'
      when concepto ilike '%TICKET REST%' or concepto ilike '%TICKET TRANSPORTE%' or concepto ilike '%FITNESS%' or concepto ilike '%RETRIB. FLEXIBLE%' then 'deferred'
      else 'other'
    end as bucket
  from base
),
monthly as (
  select
    year,
    month,
    sum(case when lower(categoria) = 'ingreso' and amount > 0 then amount else 0 end) as bruto,
    avg(case when bucket = 'irpf_percent' and amount > 0 then amount end) as irpf_pct,
    sum(case when bucket = 'irpf' then abs(least(amount, 0)) else 0 end) as irpf_amount,
    sum(case when bucket = 'ss' then abs(least(amount, 0)) else 0 end) as ss_amount,
    sum(case when bucket = 'pp_company' then abs(amount) else 0 end) as pp_company,
    sum(case when bucket = 'pp_employee' then abs(amount) else 0 end) as pp_employee,
    sum(case when bucket = 'espp_deduction' then amount else 0 end) as espp_deduction,
    sum(case when bucket = 'espp_refund' then amount else 0 end) as espp_refund,
    sum(case when bucket = 'rsu' and amount > 0 then amount else 0 end) as rsu_amount,
    sum(case when bucket = 'deferred' then abs(amount) else 0 end) as deferred_misc
  from classified
  group by year, month
),
monthly_calc as (
  select
    year,
    month,
    bruto,
    coalesce(irpf_pct, 0) as irpf_pct,
    irpf_amount,
    ss_amount,
    pp_company,
    pp_employee,
    greatest(espp_refund - espp_deduction, 0) as espp_net,
    rsu_amount,
    deferred_misc,
    (deferred_misc + pp_company + pp_employee + greatest(espp_refund - espp_deduction, 0) + rsu_amount) as ahorro_diferido,
    (irpf_amount + ss_amount) as total_deducido
  from monthly
),
monthly_final as (
  select
    *,
    greatest(bruto - total_deducido - ahorro_diferido, 0) as neto_efectivo
  from monthly_calc
),
annual as (
  select
    year,
    sum(bruto) as bruto,
    sum(neto_efectivo) as neto,
    sum(irpf_amount) as total_impuestos,
    sum(ss_amount) as total_ss,
    avg(nullif(irpf_pct, 0)) as irpf_avg_pct,
    (sum(irpf_amount) / nullif(sum(bruto), 0) * 100) as irpf_efectivo,
    (sum(ss_amount) / nullif(sum(bruto), 0) * 100) as ss_avg_pct,
    sum(ahorro_diferido) as ahorro_total,
    sum(deferred_misc) as deferred_misc_total,
    sum(pp_company) as pension_company_total,
    sum(pp_employee) as pension_employee_total,
    sum(espp_net) as espp_ytd,
    sum(rsu_amount) as rsu_ytd
  from monthly_final
  group by year
),
history as (
  select
    year,
    jsonb_agg(
      jsonb_build_object(
        'month', (array['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'])[month],
        'bruto', round(bruto, 2),
        'tax', round(total_deducido, 2),
        'neto', round(neto_efectivo, 2)
      ) order by month
    ) as history
  from monthly_final
  group by year
),
monthly_summary as (
  select distinct on (year)
    year,
    month,
    bruto as bruto_last_month,
    neto_efectivo as neto_last_month
  from monthly_final
  order by year, month desc
),
annual_by_year as (
  select
    a.year,
    jsonb_build_object(
      'monthly', jsonb_build_object(
        'bruto', round(ms.bruto_last_month, 2),
        'neto', round((a.neto / nullif((select count(*) from monthly_final m where m.year = a.year), 0)), 2),
        'netoLastMonth', round(ms.neto_last_month, 2),
        'irpf', round(coalesce(a.irpf_avg_pct, a.irpf_efectivo), 2),
        'totalIngresos', round(ms.bruto_last_month, 2),
        'ahorroFiscal', round(a.ahorro_total, 2),
        'jubilacion', round(a.pension_company_total + a.pension_employee_total, 2),
        'especie', 0
      ),
      'annual', jsonb_build_object(
        'bruto', round(a.bruto, 2),
        'neto', round(a.neto, 2),
        'irpfEfectivo', round(coalesce(a.irpf_efectivo, 0), 2),
        'irpfAvgPct', round(coalesce(a.irpf_avg_pct, a.irpf_efectivo, 0), 2),
        'ssAvgPct', round(coalesce(a.ss_avg_pct, 0), 2),
        'ahorroTotal', round(a.ahorro_total, 2),
        'deferredAmount', round(a.ahorro_total, 2),
        'totalImpuestos', round(a.total_impuestos, 2),
        'totalSS', round(a.total_ss, 2),
        'totalDeducido', round(a.total_impuestos + a.total_ss, 2),
        'netoEfectivoAmount', round(a.neto, 2),
        'netoEfectivoPct', round((a.neto / nullif(a.bruto, 0) * 100), 2),
        'ahorroDiferidoPct', round((a.ahorro_total / nullif(a.bruto, 0) * 100), 2),
        'pensionCompanyTotal', round(a.pension_company_total, 2),
        'pensionEmployeeTotal', round(a.pension_employee_total, 2),
        'esppYtd', round(a.espp_ytd, 2),
        'rsuYtd', round(a.rsu_ytd, 2)
      ),
      'history', h.history
    ) as payload
  from annual a
  join history h using (year)
  join monthly_summary ms using (year)
)
select
  jsonb_object_agg(year::text, payload) as annual_by_year,
  '[]'::jsonb as tax_brackets,
  '[]'::jsonb as vesting_schedule,
  now() as updated_at
from annual_by_year;

grant select on public.payroll_metrics_mv to authenticated;
