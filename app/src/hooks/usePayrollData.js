import { useEffect, useMemo, useState } from 'react';
import { payrollData } from '../data/payrollData';
import { calcTrend } from '../utils/trends';
import { calculateIrpfBreakdownMadrid } from '../utils/irpf';
import { fetchPayrollDataFromSupabase } from '../services/payrollRepository';

export const usePayrollData = (selectedYear, enabled = true, forceMock = false) => {
  const [dataset, setDataset] = useState(payrollData);
  const [sourceStatus, setSourceStatus] = useState({
    source: 'mock',
    error: null,
    updatedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (forceMock) return () => {};
    if (import.meta.env.MODE === 'test' || !enabled) return () => {};

    const load = async () => {
      try {
        const remoteData = await fetchPayrollDataFromSupabase();
        if (cancelled) return;
        setDataset(remoteData);
        setSourceStatus({ source: 'supabase', error: null, updatedAt: remoteData.updatedAt ?? null });
      } catch (error) {
        if (cancelled) return;
        setSourceStatus({
          source: 'mock',
          error: error instanceof Error ? error.message : 'Unknown data source error',
          updatedAt: null,
        });
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [enabled, forceMock]);

  return useMemo(() => {
    const effectiveDataset = forceMock ? payrollData : dataset;
    const effectiveSourceStatus = forceMock
      ? { source: 'mock-manual', error: null, updatedAt: null }
      : sourceStatus;
    const availableYears = Object.keys(effectiveDataset.annualByYear).sort(
      (a, b) => Number(b) - Number(a),
    );
    if (!availableYears.length) {
      return {
        year: selectedYear,
        availableYears: [],
        selectedData: {
          monthly: {
            bruto: 0,
            neto: 0,
            irpf: 0,
            totalIngresos: 0,
            ahorroFiscal: 0,
            jubilacion: 0,
            especie: 0,
          },
          annual: {
            bruto: 0,
            neto: 0,
            irpfEfectivo: 0,
            ahorroTotal: 0,
            totalImpuestos: 0,
            totalSS: 0,
          },
          history: [],
        },
        annual: {
          bruto: 0,
          neto: 0,
          irpfEfectivo: 0,
          ahorroTotal: 0,
          totalImpuestos: 0,
          totalSS: 0,
        },
        irpf: calculateIrpfBreakdownMadrid(0),
        history: [],
        vestingSchedule: [],
        trend: () => null,
        sourceStatus: effectiveSourceStatus,
      };
    }
    const fallbackYear = availableYears[0];
    const year = effectiveDataset.annualByYear[selectedYear] ? selectedYear : fallbackYear;
    const selectedData = effectiveDataset.annualByYear[year];
    const annual = selectedData.annual;
    const history = selectedData.history;
    const estimatedTaxableBase = Math.max(annual.bruto - annual.totalSS - annual.deferredAmount, 0);
    const irpf = calculateIrpfBreakdownMadrid(estimatedTaxableBase);

    const trend = (field, section = 'annual') =>
      calcTrend({
        selectedYear: year,
        annualByYear: effectiveDataset.annualByYear,
        field,
        section,
      });

    return {
      year,
      availableYears,
      selectedData,
      annual,
      irpf,
      history,
      vestingSchedule: effectiveDataset.vestingSchedule,
      trend,
      sourceStatus: effectiveSourceStatus,
    };
  }, [selectedYear, dataset, sourceStatus, forceMock]);
};
