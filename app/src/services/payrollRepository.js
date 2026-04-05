import { hasSupabaseConfig, supabase } from './supabaseClient';

/**
 * Fetches the individual payroll line-items (conceptos) for the latest month
 * of the given year from the `nominas` table.
 *
 * Returns two arrays: `ingresos` (categoría = 'Ingreso') and
 * `deducciones` (categoría = 'Deducción'), each sorted by |importe| desc.
 *
 * @param {string|number} year - The selected year (e.g. '2025').
 * @returns {Promise<{ ingresos: Array, deducciones: Array, mes: number|null }>}
 */
export const fetchLatestMonthConcepts = async (year) => {
  if (!hasSupabaseConfig || !supabase) return { ingresos: [], deducciones: [], mes: null };

  const { data, error } = await supabase
    .from('nominas')
    .select('concepto, "categoría", "subcategoría", importe, mes')
    .eq('anio', Number(year))
    .order('mes', { ascending: false });

  if (error || !data?.length) return { ingresos: [], deducciones: [], mes: null };

  const maxMes = Math.max(...data.map((r) => r.mes));
  const latest = data.filter((r) => r.mes === maxMes);

  const ingresos    = latest.filter((r) => r['categoría'] === 'Ingreso')   .sort((a, b) => b.importe - a.importe);
  const deducciones = latest.filter((r) => r['categoría'] === 'Deducción') .sort((a, b) => a.importe - b.importe);

  return { ingresos, deducciones, mes: maxMes };
};

/**
 * Transforms a raw `payroll_metrics_mv` row into the shape expected by the app.
 *
 * @param {object} row - Raw row from Supabase.
 * @param {object} row.annual_by_year - Map of year → annual metrics.
 * @param {Array}  [row.tax_brackets] - Pre-computed IRPF bracket data.
 * @param {Array}  [row.vesting_schedule] - Upcoming RSU/ESPP vesting events.
 * @param {string} [row.updated_at] - Timestamp of the query (view recalculates on every read).
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
 * Fetches payroll metrics from the `payroll_metrics_mv` view.
 *
 * Requires an authenticated Supabase session — Row Level Security on the view
 * ensures each user only reads their own data.
 *
 * @throws {Error} If env vars are missing, the user is not authenticated, or
 *                 the view returns no data (nominas table is empty).
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
    .select('annual_by_year,tax_brackets,vesting_schedule,updated_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('No rows found in payroll_metrics_mv. La tabla nominas puede estar vacía.');
  }
  return normalizePayrollMetricsPayload(data);
};
