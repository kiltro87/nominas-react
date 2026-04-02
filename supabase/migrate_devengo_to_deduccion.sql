-- Step 1: Drop the stale trigger + function that tries to REFRESH a materialized view
-- (payroll_metrics_mv was converted to a regular view; no refresh needed)
drop trigger if exists refresh_payroll_metrics_mv_trigger on public.nominas;
drop function if exists public.refresh_payroll_metrics_mv();

-- Step 2: Rename 'Devengo' → 'Deducción' in nominas.categoría
update public.nominas
set "categoría" = 'Deducción'
where "categoría" = 'Devengo';
