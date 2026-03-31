import { describe, expect, it } from 'vitest';
import { calcTrend } from './trends';

const mockData = {
  '2024': { annual: { neto: 100, irpfEfectivo: 30 } },
  '2025': { annual: { neto: 120, irpfEfectivo: 33 } },
};

describe('calcTrend', () => {
  it('calculates positive trend', () => {
    const result = calcTrend({
      selectedYear: '2025',
      annualByYear: mockData,
      field: 'neto',
    });
    expect(result).toBe(20);
  });

  it('returns null when previous year is missing', () => {
    const result = calcTrend({
      selectedYear: '2024',
      annualByYear: mockData,
      field: 'neto',
    });
    expect(result).toBeNull();
  });

  it('returns null when previous value is zero', () => {
    const result = calcTrend({
      selectedYear: '2025',
      annualByYear: {
        '2024': { annual: { neto: 0 } },
        '2025': { annual: { neto: 100 } },
      },
      field: 'neto',
    });
    expect(result).toBeNull();
  });
});
