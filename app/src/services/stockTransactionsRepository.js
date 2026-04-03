import { supabase } from './supabaseClient';

/**
 * Fetches all exchange rates from Supabase for a date range.
 * Returns a Map<'YYYY-MM-DD', number>.
 */
async function fetchRatesForRange(minDate, maxDate) {
  if (!supabase) throw new Error('Supabase no está configurado');

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('exchange_date, usd_per_eur')
    .gte('exchange_date', minDate)
    .lte('exchange_date', maxDate);

  if (error) throw new Error(`Error al leer tipos de cambio: ${error.message}`);

  const map = new Map();
  for (const row of data ?? []) {
    map.set(row.exchange_date, row.usd_per_eur);
  }
  return map;
}

/**
 * Looks up the exchange rate for a given date, going back up to maxDays if
 * the exact date is missing (weekends / holidays).
 * Returns { rate, dateUsed } or null if not found within maxDays.
 */
function lookback(ratesMap, dateStr, maxDays = 10) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));

  for (let i = 0; i <= maxDays; i++) {
    const candidate = new Date(base);
    candidate.setUTCDate(base.getUTCDate() - i);
    const key = candidate.toISOString().slice(0, 10);
    if (ratesMap.has(key)) return { rate: ratesMap.get(key), dateUsed: key };
  }
  return null;
}

/**
 * Takes an array of parsed rows (from benefitHistoryParser) and applies the
 * BDE lookback to fill `rate_used`, `amount_eur` and `status`/`error_msg`.
 *
 * Rows with op_type='TR' (sells) get rate + date but amount_eur=null
 * since we don't have a price for sells (only quantity matters for AEAT TR).
 */
export async function applyExchangeRates(rows) {
  if (!rows.length) return rows;

  const dates = rows.map((r) => r.event_date).filter(Boolean);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  const ratesMap = await fetchRatesForRange(minDate, maxDate);

  return rows.map((row) => {
    if (row.status && row.status !== 'PENDING') return row; // already has an error

    const found = lookback(ratesMap, row.event_date);

    if (!found) {
      return {
        ...row,
        status: 'ERROR',
        error_msg: `Falta cambio BDE para ${row.event_date} (lookback 10 días sin resultado)`,
      };
    }

    const amountEur =
      row.price_usd != null
        ? (row.aeat_num_titulos * row.price_usd) / found.rate
        : null;

    return {
      ...row,
      rate_used:  found.rate,
      amount_eur: amountEur != null ? Math.round(amountEur * 100) / 100 : null,
      status:     'OK',
      error_msg:  null,
    };
  });
}

/**
 * Inserts validated rows into the `stock_transactions` table.
 * Skips rows with status='ERROR'.
 */
export async function saveStockTransactions(rows) {
  if (!supabase) throw new Error('Supabase no está configurado');

  const toSave = rows
    .filter((r) => r.status === 'OK' || r.status === 'WARN_NO_PRICE')
    .map(({ grant_id, event_date, quantity_gross, quantity_net, price_usd,
             amount_eur, rate_used, op_type, plan_type, aeat_num_titulos }) => ({
      grant_id,
      event_date,
      quantity_gross,
      quantity_net,
      price_usd,
      amount_eur,
      rate_used,
      op_type,
      plan_type,
      aeat_num_titulos,
    }));

  if (!toSave.length) throw new Error('No hay filas válidas para guardar');

  const { error } = await supabase.from('stock_transactions').insert(toSave);
  if (error) throw new Error(`Error al guardar en Supabase: ${error.message}`);

  return toSave.length;
}

/**
 * Exports rows to a downloadable CSV blob (AEAT-friendly format).
 */
export function exportToCSV(rows) {
  const headers = [
    'Plan', 'Tipo', 'Fecha', 'Grant', 'Qty Bruta', 'Qty Neta',
    'Precio USD', 'Cambio BDE', 'Importe EUR', 'Estado', 'Error',
  ];
  const lines = [headers.join(';')];

  for (const r of rows) {
    lines.push([
      r.plan_type,
      r.op_type,
      r.event_date,
      r.grant_id ?? '',
      r.quantity_gross ?? '',
      r.quantity_net ?? '',
      r.price_usd != null ? r.price_usd.toFixed(4) : '',
      r.rate_used != null ? r.rate_used.toFixed(6) : '',
      r.amount_eur != null ? r.amount_eur.toFixed(2) : '',
      r.status,
      r.error_msg ?? '',
    ].join(';'));
  }

  return new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}
