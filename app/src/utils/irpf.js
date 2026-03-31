const MADRID_AUTONOMIC_SCALE_2024 = [
  { upTo: 13362.22, rate: 8.5 },
  { upTo: 19004.63, rate: 10.7 },
  { upTo: 35425.68, rate: 12.8 },
  { upTo: 57320.4, rate: 17.4 },
  { upTo: Infinity, rate: 20.5 },
];

const STATE_SCALE_2024 = [
  { upTo: 12450, rate: 9.5 },
  { upTo: 20200, rate: 12.0 },
  { upTo: 35200, rate: 15.0 },
  { upTo: 60000, rate: 18.5 },
  { upTo: 300000, rate: 22.5 },
  { upTo: Infinity, rate: 24.5 },
];

const getRateForBase = (scale, base) => {
  const tramo = scale.find((item) => base <= item.upTo);
  return tramo?.rate ?? scale[scale.length - 1].rate;
};

const formatRangeLabel = (from, to) => {
  if (!Number.isFinite(to)) return `Desde ${from.toFixed(2)} EUR`;
  return `${from.toFixed(2)} - ${to.toFixed(2)} EUR`;
};

export const calculateIrpfBreakdownMadrid = (baseLiquidableGeneral) => {
  const base = Math.max(Number(baseLiquidableGeneral) || 0, 0);

  const breakpoints = Array.from(
    new Set([
      0,
      ...STATE_SCALE_2024.map((item) => item.upTo).filter(Number.isFinite),
      ...MADRID_AUTONOMIC_SCALE_2024.map((item) => item.upTo).filter(Number.isFinite),
    ]),
  ).sort((a, b) => a - b);
  breakpoints.push(Infinity);

  const tramos = [];
  let cuotaEstatal = 0;
  let cuotaAutonomica = 0;

  for (let i = 0; i < breakpoints.length - 1; i += 1) {
    const from = breakpoints[i];
    const to = breakpoints[i + 1];
    if (base <= from) break;

    const taxableInRange = Math.min(base, to) - from;
    if (taxableInRange <= 0) continue;

    const tramoMidpoint = Number.isFinite(to) ? (from + to) / 2 : from + 1;
    const rateState = getRateForBase(STATE_SCALE_2024, tramoMidpoint);
    const rateMadrid = getRateForBase(MADRID_AUTONOMIC_SCALE_2024, tramoMidpoint);

    const cuotaTramoEstatal = taxableInRange * (rateState / 100);
    const cuotaTramoAutonomica = taxableInRange * (rateMadrid / 100);
    const cuotaTramoTotal = cuotaTramoEstatal + cuotaTramoAutonomica;
    const tramoCapacity = Number.isFinite(to) ? to - from : taxableInRange;
    const tramoCoveragePct = tramoCapacity > 0 ? Math.min((taxableInRange / tramoCapacity) * 100, 100) : 0;

    cuotaEstatal += cuotaTramoEstatal;
    cuotaAutonomica += cuotaTramoAutonomica;

    tramos.push({
      label: formatRangeLabel(from, to),
      from,
      to,
      baseInRange: taxableInRange,
      rateState,
      rateMadrid,
      rateTotal: Number((rateState + rateMadrid).toFixed(2)),
      cuotaState: cuotaTramoEstatal,
      cuotaMadrid: cuotaTramoAutonomica,
      cuotaTotal: cuotaTramoTotal,
      tramoCapacity,
      tramoCoveragePct: Number(tramoCoveragePct.toFixed(2)),
    });
  }

  const cuotaTotal = cuotaEstatal + cuotaAutonomica;
  const tipoEfectivo = base > 0 ? (cuotaTotal / base) * 100 : 0;
  const tipoMarginal =
    base > 0
      ? getRateForBase(STATE_SCALE_2024, base) + getRateForBase(MADRID_AUTONOMIC_SCALE_2024, base)
      : 0;

  return {
    base,
    tramos,
    cuotaState: cuotaEstatal,
    cuotaMadrid: cuotaAutonomica,
    cuotaTotal,
    tipoEfectivo: Number(tipoEfectivo.toFixed(2)),
    tipoMarginal: Number(tipoMarginal.toFixed(2)),
  };
};

export const IRPF_SCALES_REFERENCE = {
  state: STATE_SCALE_2024,
  madrid: MADRID_AUTONOMIC_SCALE_2024,
};
