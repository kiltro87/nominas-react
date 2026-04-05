/**
 * Derives the SankeyChart data shape from per-concept payroll line items
 * for a single month.
 *
 * Maps subcategoría strings (from "Categorias de conceptos.json") to the
 * five Sankey buckets: neto, irpf, ss, pension, esppRsu, flex.
 *
 * @param {{ ingresos: Array, deducciones: Array }} concepts - From fetchAllYearConcepts
 * @returns {{ bruto:number, neto:number, irpf:number, ss:number, pension:number, esppRsu:number, flex:number }}
 */

const sumBySub = (rows, sub) =>
  rows.filter((r) => r['subcategoría'] === sub).reduce((s, r) => s + (r.importe ?? 0), 0);

export function computeSankeyFromConcepts({ ingresos = [], deducciones = [] }) {
  const bruto = ingresos.filter((c) => c.importe > 0).reduce((s, c) => s + c.importe, 0);

  const irpf = Math.abs(
    sumBySub(deducciones, 'Impuestos (IRPF)') +
    sumBySub(deducciones, 'Impuestos (Ajustes)'),
  );
  const ss = Math.abs(sumBySub(deducciones, 'Seguridad Social'));

  // Pension = company contribution (Ingreso side) + employee deduction (Deducción side)
  const pension =
    sumBySub(ingresos, 'Ahorro Jubilación') +
    Math.abs(sumBySub(deducciones, 'Ahorro Jubilación'));

  // ESPP/RSU = variable income net of ESPP deduction
  const esppRsu =
    sumBySub(ingresos, 'Ingreso Variable (ESPP)') +
    sumBySub(ingresos, 'Ingreso Variable (RSU)') +
    sumBySub(ingresos, 'Ingreso Variable (Dividendos)') +
    sumBySub(deducciones, 'Inversión Acciones (ESPP)'); // already negative → reduces total

  // Flexible benefits (deferred / benefits-in-kind deductions)
  const flex = Math.abs(
    sumBySub(deducciones, 'Diferido') +
    sumBySub(deducciones, 'Ajuste Contable'),
  );

  const totalDeducido = deducciones.reduce((s, c) => s + c.importe, 0); // sum of negatives
  const neto = Math.max(0, bruto + totalDeducido); // bruto - |deducciones|

  return { bruto, neto, irpf, ss, pension, esppRsu, flex };
}
