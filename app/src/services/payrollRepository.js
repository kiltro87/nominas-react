import { hasSupabaseConfig, supabase } from './supabaseClient';

export const normalizePayrollMetricsPayload = (row) => {
  if (!row?.annual_by_year) {
    throw new Error('payroll_metrics_mv has no annual_by_year payload');
  }
  return {
    annualByYear: row.annual_by_year,
    taxBrackets: Array.isArray(row.tax_brackets) ? row.tax_brackets : [],
    vestingSchedule: Array.isArray(row.vesting_schedule) ? row.vesting_schedule : [],
    updatedAt: row.updated_at ?? null,
  };
};

export const fetchPayrollDataFromSupabase = async () => {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Missing Supabase environment variables');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Auth required: inicia sesion en Supabase');

  const { data, error } = await supabase
    .from('payroll_metrics_mv')
    .select('annual_by_year,tax_brackets,vesting_schedule')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('No rows found in payroll_metrics_mv. Refresh the materialized view.');
  }
  return normalizePayrollMetricsPayload(data);
};
