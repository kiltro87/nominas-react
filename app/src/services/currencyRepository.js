import { supabase } from './supabaseClient';

const BDE_URL =
  'https://app.bde.es/bierest/resources/srdatosapp/listaSeries' +
  '?idioma=es&series=DTCCBCEUSDEUR.B&rango=36M';

/**
 * Fetches the last 36 months of USD/EUR exchange rates from the Banco de España
 * REST API and upserts them into the Supabase `exchange_rates` table.
 *
 * The BDE response nests data under ListaSeries → Serie → Datos → Dato.
 * Both uppercase (current REST API) and lowercase key variants are handled
 * for resilience against future API changes.
 *
 * @returns {Promise<number>} Number of rows upserted.
 */
export const syncExchangeRatesFromBDE = async () => {
  if (!supabase) throw new Error('Supabase no está configurado');

  const res = await fetch(BDE_URL);
  if (!res.ok) throw new Error(`BDE API respondió con error ${res.status}`);

  const json = await res.json();

  // BDE returns an array: [{ serie, fechas: [...ISO strings], valores: [...numbers|null] }]
  const serie = Array.isArray(json) ? json[0] : json;
  const fechas = serie?.fechas ?? [];
  const valores = serie?.valores ?? [];

  const rows = fechas
    .map((fecha, i) => ({ exchange_date: fecha.slice(0, 10), usd_per_eur: valores[i] }))
    .filter((r) => r.usd_per_eur != null && !isNaN(r.usd_per_eur));

  if (!rows.length) {
    throw new Error('La respuesta del BDE no contiene datos válidos. Comprueba la estructura del JSON.');
  }

  const { error } = await supabase
    .from('exchange_rates')
    .upsert(rows, { onConflict: 'exchange_date' });

  if (error) throw new Error(`Error al guardar en Supabase: ${error.message}`);

  return rows.length;
};
