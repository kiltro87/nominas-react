import { describe, expect, it } from 'vitest';
import { calculateIrpfBreakdownMadrid } from './irpf';

describe('calculateIrpfBreakdownMadrid', () => {
  it('returns zero values for zero base', () => {
    const result = calculateIrpfBreakdownMadrid(0);
    expect(result.cuotaTotal).toBe(0);
    expect(result.tipoEfectivo).toBe(0);
    expect(result.tramos).toHaveLength(0);
  });

  it('calculates combined marginal rate up to 45%', () => {
    const result = calculateIrpfBreakdownMadrid(320000);
    expect(result.tipoMarginal).toBe(45);
    expect(result.cuotaTotal).toBeGreaterThan(0);
  });

  it('contains tramo split with state and madrid parts', () => {
    const result = calculateIrpfBreakdownMadrid(50000);
    expect(result.tramos.length).toBeGreaterThan(1);
    expect(result.tramos[0]).toHaveProperty('rateState');
    expect(result.tramos[0]).toHaveProperty('rateMadrid');
  });
});
