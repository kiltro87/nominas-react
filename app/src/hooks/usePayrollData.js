import { useEffect, useMemo, useState } from 'react';
import { payrollData, mockConcepts } from '../data/payrollData';
import { calcTrend } from '../utils/trends';
import { calculateIrpfBreakdownMadrid } from '../utils/irpf';
import { fetchPayrollDataFromSupabase, fetchLatestMonthConcepts } from '../services/payrollRepository';

export const usePayrollData = (selectedYear, enabled = true, forceMock = false) => {
  const [dataset, setDataset] = useState(payrollData);
  const [sourceStatus, setSourceStatus] = useState({
    source: 'mock',
    error: null,
    updatedAt: null,
  });
  // Holds concepts fetched from Supabase (null = not yet fetched / not applicable)
  const [fetchedConcepts, setFetchedConcepts] = useState(null);

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

  // Fetch per-concept breakdown whenever year or auth state changes (real data only)
  useEffect(() => {
    if (forceMock || !enabled || import.meta.env.MODE === 'test') return;
    if (selectedYear === 'all') {
      setFetchedConcepts(null);
      return;
    }
    let cancelled = false;
    fetchLatestMonthConcepts(selectedYear).then((data) => {
      if (!cancelled) setFetchedConcepts(data);
    });
    return () => { cancelled = true; };
  }, [selectedYear, enabled, forceMock]);

  return useMemo(() => {
    const effectiveDataset = forceMock ? payrollData : dataset;
    const effectiveSourceStatus = forceMock
      ? { source: 'mock-manual', error: null, updatedAt: null }
      : sourceStatus;

    // Concepts: use mock data when in mock mode, fetched data otherwise
    const yr = selectedYear === 'all' ? '2025' : selectedYear;
    const latestMonthConcepts = forceMock || !fetchedConcepts
      ? (mockConcepts[yr] ?? mockConcepts['2025'] ?? { ingresos: [], deducciones: [], mes: null })
      : fetchedConcepts;
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
        latestMonthConcepts: { ingresos: [], deducciones: [], mes: null },
        trend: () => null,
        sourceStatus: effectiveSourceStatus,
      };
    }
    if (selectedYear === 'all') {
      const sortedYears = [...availableYears].sort((a, b) => Number(a) - Number(b));
      const allAnnual = sortedYears.map((y) => effectiveDataset.annualByYear[y].annual);
      const totalBruto = allAnnual.reduce((s, a) => s + (a.bruto ?? 0), 0);
      const totalMonths = sortedYears.reduce(
        (s, y) => s + (effectiveDataset.annualByYear[y].history?.length ?? 0),
        0,
      );
      const wAvg = (field) =>
        totalBruto > 0
          ? allAnnual.reduce((s, a) => s + (a[field] ?? 0) * (a.bruto ?? 0), 0) / totalBruto
          : 0;
      const totalNeto = allAnnual.reduce((s, a) => s + (a.neto ?? 0), 0);
      const totalAhorro = allAnnual.reduce((s, a) => s + (a.ahorroTotal ?? 0), 0);

      const annual = {
        bruto: totalBruto,
        neto: totalNeto,
        irpfEfectivo: wAvg('irpfEfectivo'),
        irpfAvgPct: wAvg('irpfAvgPct'),
        ssAvgPct: wAvg('ssAvgPct'),
        ahorroTotal: totalAhorro,
        deferredAmount: allAnnual.reduce((s, a) => s + (a.deferredAmount ?? 0), 0),
        totalImpuestos: allAnnual.reduce((s, a) => s + (a.totalImpuestos ?? 0), 0),
        totalSS: allAnnual.reduce((s, a) => s + (a.totalSS ?? 0), 0),
        totalDeducido: allAnnual.reduce((s, a) => s + (a.totalDeducido ?? 0), 0),
        netoEfectivoAmount: totalNeto,
        netoEfectivoPct: totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0,
        ahorroDiferidoPct: totalBruto > 0 ? (totalAhorro / totalBruto) * 100 : 0,
        pensionCompanyTotal: allAnnual.reduce((s, a) => s + (a.pensionCompanyTotal ?? 0), 0),
        pensionEmployeeTotal: allAnnual.reduce((s, a) => s + (a.pensionEmployeeTotal ?? 0), 0),
        esppYtd: allAnnual.reduce((s, a) => s + (a.esppYtd ?? 0), 0),
        rsuYtd: allAnnual.reduce((s, a) => s + (a.rsuYtd ?? 0), 0),
      };

      const history = sortedYears.map((y) => {
        const a = effectiveDataset.annualByYear[y].annual;
        return {
          month: y,
          bruto: a.bruto ?? 0,
          neto: a.neto ?? 0,
          tax: (a.totalImpuestos ?? 0) + (a.totalSS ?? 0),
        };
      });

      const avgNeto = totalMonths > 0 ? totalNeto / totalMonths : 0;
      const avgBruto = totalMonths > 0 ? totalBruto / totalMonths : 0;

      const selectedData = {
        monthly: {
          bruto: avgBruto,
          neto: avgNeto,
          netoLastMonth: null,
          irpf: annual.irpfAvgPct,
          totalIngresos: avgBruto,
          ahorroFiscal: totalMonths > 0 ? totalAhorro / totalMonths : 0,
          jubilacion: totalMonths > 0 ? (annual.pensionCompanyTotal + annual.pensionEmployeeTotal) / totalMonths : 0,
          especie: 0,
        },
        annual,
        history,
      };

      const estimatedTaxableBaseAll = Math.max(annual.bruto - annual.totalSS - annual.deferredAmount, 0);
      return {
        year: 'all',
        availableYears,
        selectedData,
        annual,
        irpf: calculateIrpfBreakdownMadrid(estimatedTaxableBaseAll),
        history,
        vestingSchedule: effectiveDataset.vestingSchedule,
        latestMonthConcepts,
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
      latestMonthConcepts,
      trend,
      sourceStatus: effectiveSourceStatus,
    };
  }, [selectedYear, dataset, sourceStatus, forceMock, fetchedConcepts]);
};
