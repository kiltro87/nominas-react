import { hasSupabaseConfig, supabase } from './supabaseClient';

/**
 * Transforms a raw `payroll_metrics_mv` row into the shape expected by the app.
 *
 * @param {object} row - Raw row from Supabase.
 * @param {object} row.annual_by_year - Map of year → annual metrics.
 * @param {Array}  [row.tax_brackets] - Pre-computed IRPF bracket data.
 * @param {Array}  [row.vesting_schedule] - Upcoming RSU/ESPP vesting events.
 * @param {string} [row.updated_at] - ISO timestamp of the last MV refresh.
 * @returns {{ annualByYear: object, taxBrackets: Array, vestingSchedule: Array, updatedAt: string|null }}
 */
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

/**
 * Fetches payroll metrics from the `payroll_metrics_mv` materialized view.
 *
 * Requires an authenticated Supabase session — Row Level Security on the view
 * ensures each user only reads their own data.
 *
 * @throws {Error} If env vars are missing, the user is not authenticated, or
 *                 the materialized view is empty (needs a manual refresh).
 * @returns {Promise<ReturnType<typeof normalizePayrollMetricsPayload>>}
 */
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
