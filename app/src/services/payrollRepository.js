import { hasSupabaseConfig, supabase } from './supabaseClient';

/**
 * Fetches all payroll line-items (conceptos) for the given year from the
 * `payrolls` table, grouped by month.
 *
 * @param {string|number} year - The selected year (e.g. '2025').
 * @returns {Promise<{
 *   byMonth: Record<number, { ingresos: Array, deducciones: Array }>,
 *   availableMonths: number[]
 * }>}
 */
export const fetchAllYearConcepts = async (year) => {
  const EMPTY = { byMonth: {}, availableMonths: [] };
  if (!hasSupabaseConfig || !supabase) return EMPTY;

  const { data, error } = await supabase
    .from('payrolls')
    .select('id, item, category, subcategory, amount, month')
    .eq('year', Number(year))
    .order('month', { ascending: true });

  if (error || !data?.length) return EMPTY;

  const byMonth = {};
  for (const row of data) {
    // Skip rows whose category is not a displayable payroll line
    // (e.g. 'Impuesto', 'No computable' — the latter stores the % IRPF applied)
    if (row['category'] !== 'Ingreso' && row['category'] !== 'Deducción') continue;
    if (!byMonth[row.month]) byMonth[row.month] = { ingresos: [], deducciones: [] };
    if (row['category'] === 'Ingreso') {
      byMonth[row.month].ingresos.push(row);
    } else {
      byMonth[row.month].deducciones.push(row);
    }
  }
  for (const month of Object.keys(byMonth)) {
    byMonth[month].ingresos.sort((a, b) => b.amount - a.amount);
    byMonth[month].deducciones.sort((a, b) => a.amount - b.amount);
  }

  const availableMonths = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
  return { byMonth, availableMonths };
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
 *                 the view returns no data (payrolls table is empty).
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
    throw new Error('No rows found in payroll_metrics_mv. La tabla payrolls puede estar vacía.');
  }
  return normalizePayrollMetricsPayload(data);
};

/**
 * Updates a single payrolls row's item, category, and subcategory.
 * Called when the user edits an unrecognized (or incorrectly classified) concept
 * in the Mi Nómina concept tables.
 *
 * @param {number} id - Primary key of the payrolls row.
 * @param {{ item: string, category: string, subcategory: string }} fields
 * @returns {Promise<void>}
 */
export const updateNominaConcept = async (id, { item, category, subcategory }) => {
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase
    .from('payrolls')
    .update({ item, category, subcategory })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Inserts or updates a concept_categories row so future PDF imports classify
 * this concept correctly without user intervention.
 *
 * Uses ON CONFLICT (concepto) DO UPDATE so it is safe to call repeatedly.
 *
 * @param {{ concepto: string, categoria: string, subcategoria: string }} fields
 * @returns {Promise<void>}
 */
export const upsertConceptCategory = async ({ concepto, categoria, subcategoria }) => {
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase
    .from('concept_categories')
    .upsert({ concepto, categoria, subcategoria }, { onConflict: 'concepto' });
  if (error) throw error;
};
