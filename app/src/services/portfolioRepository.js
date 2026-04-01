import { hasSupabaseConfig, supabase } from './supabaseClient';

/**
 * Fetches all portfolio transactions ordered chronologically.
 *
 * @throws {Error} If Supabase is not configured or the user is not authenticated.
 * @returns {Promise<{
 *   transactions: Array,
 *   currentQty: number,
 *   totalEurValue: number
 * }>}
 */
export const fetchPortfolioData = async () => {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Missing Supabase environment variables');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Auth required');

  const { data, error } = await supabase
    .from('portfolio_transactions')
    .select(
      'id,file_name,operation_date,settlement_date,award_number,quantity,' +
      'stock_price_usd,net_amount_usd,aeat_tipo,aeat_fecha,aeat_num_titulos,' +
      'conversion_rate,aeat_importe_eur,ordering,cumulative_qty'
    )
    .order('ordering', { ascending: true });

  if (error) throw error;

  const transactions = data ?? [];

  // The last row in ordering has the current running total
  const lastRow = transactions.length > 0 ? transactions[transactions.length - 1] : null;
  const currentQty = lastRow?.cumulative_qty ?? 0;

  // Total EUR value of all acquisitions (aeat_tipo = 'AD')
  const totalEurValue = transactions
    .filter((t) => t.aeat_tipo === 'AD')
    .reduce((sum, t) => sum + (t.aeat_importe_eur ?? 0), 0);

  return { transactions, currentQty, totalEurValue };
};
