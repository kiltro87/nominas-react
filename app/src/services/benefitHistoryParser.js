import * as XLSX from 'xlsx';

// ─── Column index map (verified against real BenefitHistory.xlsx from E*TRADE) ──
//
// Source: E*TRADE Benefits → My Account → Benefits → Benefit History → Export
//
// ESPP sheet (tab "ESPP"):
//   Purchase row:  [0]=Record Type, [3]=Purchase Price, [4]=Purchased Qty,
//                  [11]=Grant Date FMV (used as price_usd for AEAT)
//   Event row:     [0]=Record Type, [19]=Date, [20]=Event Type (PURCHASE|SELL), [21]=Qty
//   Totals row:    ignored
//
// Restricted Stock sheet (tab "Restricted Stock"):
//   Grant row:           [0]=Record Type, [10]=Grant Number
//   Event row:           ignored (summarised by Vest Schedule rows)
//   Vest Schedule row:   [0]=Record Type, [10]=Grant Number, [24]=Vest Period,
//                        [25]=Vest Date,  [32]=Vested Qty (gross, base AEAT),
//                        [33]=Released Qty, [35]=Sellable Qty (sold by broker for tax),
//                        [36]=Blocked Qty (shares actually held after tax)
//   Tax Withholding row: [0]=Record Type, [10]=Grant Number, [24]=Vest Period,
//                        [38]=Country, [39]=Taxable Gain USD, [40]=Tax Rate%, [41]=Withholding Amt
//   Totals row:          ignored

const MONTH_ABBR = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function normalizeDate(raw) {
  if (raw == null || raw === '') return null;

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
  const n = parseFloat(String(raw).replace(/[$,%]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Parses a BenefitHistory.xlsx file exported from E*TRADE Benefits
 * (section: My Account → Benefits → Benefit History).
 *
 * Returns { rsu: [...], espp: [...] } where each row has the shape:
 *   { grant_id, event_date, quantity_gross, quantity_net, price_usd,
 *     op_type ('AD'|'TR'), plan_type ('RSU'|'ESPP'),
 *     rate_used, amount_eur, aeat_num_titulos, status, error_msg }
 *
 * For RSU each vest event produces TWO rows:
 *   1. AD  – gross acquisition (vested qty, used as AEAT base)
 *   2. TR  – immediate tax-cover sale (sellable qty sold by broker to pay withholding tax)
 *
 * For ESPP each PURCHASE event produces one AD row and each SELL event one TR row.
 */
export function parseBenefitHistory(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: false });
  return {
    rsu:  parseRSU(wb),
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

  // Build taxable-gain map keyed by grantNumber_vestPeriod
  const taxMap = {};
  for (const row of rows) {
    if (row[0] !== 'Tax Withholding') continue;
    const key = `${row[10]}_${row[24]}`;
    taxMap[key] = toNumber(row[39]); // taxable gain in USD (idx 39)
  }

  const result = [];
  for (const row of rows) {
    if (row[0] !== 'Vest Schedule') continue;

    const grantNumber = String(row[10]).trim();
    const vestPeriod  = String(row[24]).trim();
    const eventDate   = normalizeDate(row[25]);
    const vestedQty   = toNumber(row[32]);
    const blockedQty  = toNumber(row[36]); // shares actually kept after broker sells for taxes
    const sellableQty = toNumber(row[35]); // shares sold by broker immediately to cover tax withholding

    if (!eventDate || !vestedQty) continue;

    const taxableGain = taxMap[`${grantNumber}_${vestPeriod}`] ?? null;
    const priceUsd    = taxableGain != null && vestedQty > 0
      ? Math.round((taxableGain / vestedQty) * 10000) / 10000
      : null;

    const baseRow = {
      grant_id:  grantNumber,
      event_date: eventDate,
      price_usd:  priceUsd,
      plan_type:  'RSU',
      rate_used:  null,
      amount_eur: null,
      status:     priceUsd == null ? 'WARN_NO_PRICE' : 'PENDING',
      error_msg:  priceUsd == null ? 'Sin taxable gain para calcular precio' : null,
    };

    // AD – gross acquisition (AEAT base: full vested qty)
    result.push({
      ...baseRow,
      quantity_gross:   vestedQty,
      quantity_net:     blockedQty ?? vestedQty,
      op_type:          'AD',
      aeat_num_titulos: vestedQty,
    });

    // TR – immediate sale of tax-cover shares by E*TRADE broker (sellable qty)
    if (sellableQty != null && sellableQty > 0) {
      result.push({
        ...baseRow,
        quantity_gross:   sellableQty,
        quantity_net:     sellableQty,
        op_type:          'TR',
        aeat_num_titulos: sellableQty,
      });
    }
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
      currentPurchasePrice = toNumber(row[11]); // Grant Date FMV at index 11
      continue;
    }

    if (recordType === 'Event') {
      const eventDate = normalizeDate(row[19]); // Date at index 19
      const eventType = String(row[20]).trim().toUpperCase(); // Event Type at index 20
      const qty       = toNumber(row[21]); // Qty at index 21

      if (!eventDate || qty == null) continue;

      if (eventType === 'PURCHASE') {
        result.push({
          grant_id:         null,
          event_date:       eventDate,
          quantity_gross:   qty,
          quantity_net:     qty,
          price_usd:        currentPurchasePrice,
          op_type:          'AD',
          plan_type:        'ESPP',
          rate_used:        null,
          amount_eur:       null,
          aeat_num_titulos: qty,
          status:           currentPurchasePrice == null ? 'WARN_NO_PRICE' : 'PENDING',
          error_msg:        currentPurchasePrice == null ? 'Sin precio en fila Purchase' : null,
        });
      } else if (eventType === 'SELL') {
        result.push({
          grant_id:         null,
          event_date:       eventDate,
          quantity_gross:   qty,
          quantity_net:     qty,
          price_usd:        null,
          op_type:          'TR',
          plan_type:        'ESPP',
          rate_used:        null,
          amount_eur:       null,
          aeat_num_titulos: qty,
          status:           'PENDING',
          error_msg:        null,
        });
      }
    }
  }

  return result;
}
