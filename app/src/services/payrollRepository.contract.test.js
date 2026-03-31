import { describe, expect, it } from 'vitest';
import { normalizePayrollMetricsPayload } from './payrollRepository';

describe('payroll metrics payload contract', () => {
  it('accepts valid materialized-view payload', () => {
    const payload = normalizePayrollMetricsPayload({
      annual_by_year: {
        '2026': {
          monthly: { neto: 1000, netoLastMonth: 1100, bruto: 2000, irpf: 30, totalIngresos: 2000, ahorroFiscal: 100, jubilacion: 50, especie: 0 },
          annual: { bruto: 24000, neto: 12000, irpfEfectivo: 25, totalImpuestos: 4000, totalSS: 2000, ahorroTotal: 3000, deferredAmount: 3000 },
          history: [{ month: 'Ene', bruto: 2000, tax: 500, neto: 1000 }],
        },
      },
      tax_brackets: [],
      vesting_schedule: [],
      updated_at: '2026-03-31T00:00:00Z',
    });

    expect(payload.annualByYear['2026'].annual.bruto).toBe(24000);
    expect(payload.updatedAt).toBe('2026-03-31T00:00:00Z');
  });

  it('throws if annual_by_year is missing', () => {
    expect(() => normalizePayrollMetricsPayload({})).toThrow();
  });
});
