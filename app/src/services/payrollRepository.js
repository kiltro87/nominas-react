import { hasSupabaseConfig, supabase } from './supabaseClient';

/**
 * Fetches all payroll line-items (conceptos) for the given year from the
 * `nominas` table, grouped by month.
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
    .from('nominas')
    .select('id, concepto, "categoría", "subcategoría", importe, mes')
    .eq('año', Number(year))
    .order('mes', { ascending: true });

  if (error || !data?.length) return EMPTY;

  const byMonth = {};
  for (const row of data) {
    // Skip rows with invalid or unrecognised categoría values (e.g. 'Impuesto')
    if (row['categoría'] !== 'Ingreso' && row['categoría'] !== 'Deducción') continue;
    if (!byMonth[row.mes]) byMonth[row.mes] = { ingresos: [], deducciones: [] };
    if (row['categoría'] === 'Ingreso') {
      byMonth[row.mes].ingresos.push(row);
    } else {
      byMonth[row.mes].deducciones.push(row);
    }
  }
  for (const mes of Object.keys(byMonth)) {
    byMonth[mes].ingresos.sort((a, b) => b.importe - a.importe);
    byMonth[mes].deducciones.sort((a, b) => a.importe - b.importe);
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

/**
 * Updates a single nominas row's concepto, categoría, and subcategoría.
 * Called when the user edits an unrecognized (or incorrectly classified) concept
 * in the Mi Nómina concept tables.
 *
 * @param {number} id - Primary key of the nominas row.
 * @param {{ concepto: string, categoria: string, subcategoria: string }} fields
 * @returns {Promise<void>}
 */
export const updateNominaConcept = async (id, { concepto, categoria, subcategoria }) => {
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase
    .from('nominas')
    .update({ concepto, 'categoría': categoria, 'subcategoría': subcategoria })
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
