import * as XLSX from 'xlsx';

/**
 * Normalizes a date value from the Excel to a YYYY-MM-DD string.
 * Handles: Excel serial numbers, MM/DD/YYYY, DD-MMM-YYYY strings.
 */
const MONTH_ABBR = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function normalizeDate(raw) {
  if (!raw && raw !== 0) return null;

  // Excel serial number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }

  const s = String(raw).trim();

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;

  // DD-MMM-YYYY
  const dmy = s.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
  if (dmy) {
    const m = MONTH_ABBR[dmy[2].toUpperCase()];
    if (m) return `${dmy[3]}-${m}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
}

function toNumber(raw) {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Reads an ArrayBuffer and returns { rsu: [...], espp: [...] }.
 *
 * RSU rows (from "Restricted Stock" sheet):
 *   Source: 'Vest Schedule' rows matched with their 'Tax Withholding' rows.
 *   Fields: grant_id, event_date, quantity_gross, quantity_net, price_usd, op_type='AD', plan_type='RSU'
 *
 * ESPP rows (from "ESPP" sheet):
 *   Source: 'Event' sub-rows (PURCHASE → AD, SELL → TR).
 *   Fields: grant_id=null, event_date, quantity_gross, quantity_net, price_usd (purchase only), op_type, plan_type='ESPP'
 */
export function parseBenefitHistory(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  return {
    rsu: parseRSU(wb),
    espp: parseESPP(wb),
  };
}

// ─── RSU ─────────────────────────────────────────────────────────────────────

function parseRSU(wb) {
  const sheetName = wb.SheetNames.find((n) => /restricted\s*stock/i.test(n));
  if (!sheetName) throw new Error('Hoja "Restricted Stock" no encontrada en el Excel');

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    blankrows: false,
  });

  // Build a map of (grantNumber + vestPeriod) → taxableGain from Tax Withholding rows
  const taxMap = {};
  for (const row of rows) {
    if (row[0] !== 'Tax Withholding') continue;
    // ['Tax Withholding', grantNumber, vestPeriod, country, taxableGain, rate%, withholdingAmt]
    const key = `${row[1]}_${row[2]}`;
    taxMap[key] = toNumber(row[4]); // taxable gain in USD
  }

  const result = [];
  for (const row of rows) {
    if (row[0] !== 'Vest Schedule') continue;
    // ['Vest Schedule', ?, grantNumber, vestPeriod, vestDate, ?, ?, vestedQty, releasedQty, ?, ?, ?, withholdingAmt]
    const grantNumber = String(row[2]).trim();
    const vestPeriod  = String(row[3]).trim();
    const eventDate   = normalizeDate(row[4]);
    const vestedQty   = toNumber(row[7]);
    const releasedQty = toNumber(row[8]);

    if (!eventDate || vestedQty == null || vestedQty === 0) continue;

    const taxableGain = taxMap[`${grantNumber}_${vestPeriod}`] ?? null;
    const priceUsd    = taxableGain != null ? taxableGain / vestedQty : null;

    result.push({
      grant_id:       grantNumber,
      event_date:     eventDate,
      quantity_gross: vestedQty,
      quantity_net:   releasedQty ?? vestedQty,
      price_usd:      priceUsd,
      op_type:        'AD',
      plan_type:      'RSU',
      // filled later by lookback
      rate_used:      null,
      amount_eur:     null,
      aeat_num_titulos: vestedQty,
      status:         priceUsd == null ? 'WARN_NO_PRICE' : 'PENDING',
      error_msg:      priceUsd == null ? 'Sin taxable gain para calcular precio' : null,
    });
  }

  return result;
}

// ─── ESPP ────────────────────────────────────────────────────────────────────

function parseESPP(wb) {
  const sheetName = wb.SheetNames.find((n) => /espp/i.test(n));
  if (!sheetName) throw new Error('Hoja "ESPP" no encontrada en el Excel');

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    blankrows: false,
  });

  const result = [];
  let currentPurchasePrice = null;

  for (const row of rows) {
    const recordType = String(row[0]).trim();

    if (recordType === 'Purchase') {
      // ['Purchase', symbol, purchaseDate, purchasePrice, purchasedQty, ...]
      currentPurchasePrice = toNumber(row[3]);
      continue;
    }

    if (recordType === 'Event') {
      // ['Event', date, eventType, qty]
      const eventType = String(row[2]).trim().toUpperCase();
      const eventDate = normalizeDate(row[1]);
      const qty       = toNumber(row[3]);

      if (!eventDate || qty == null) continue;

      if (eventType === 'PURCHASE') {
        result.push({
          grant_id:        null,
          event_date:      eventDate,
          quantity_gross:  qty,
          quantity_net:    qty,
          price_usd:       currentPurchasePrice,
          op_type:         'AD',
          plan_type:       'ESPP',
          rate_used:       null,
          amount_eur:      null,
          aeat_num_titulos: qty,
          status:          currentPurchasePrice == null ? 'WARN_NO_PRICE' : 'PENDING',
          error_msg:       currentPurchasePrice == null ? 'Sin precio de compra en fila Purchase' : null,
        });
      } else if (eventType === 'SELL') {
        result.push({
          grant_id:        null,
          event_date:      eventDate,
          quantity_gross:  qty,
          quantity_net:    qty,
          price_usd:       null,
          op_type:         'TR',
          plan_type:       'ESPP',
          rate_used:       null,
          amount_eur:      null,
          aeat_num_titulos: qty,
          status:          'PENDING',
          error_msg:       null,
        });
      }
    }
  }

  return result;
}
