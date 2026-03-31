export const calcTrend = ({ selectedYear, annualByYear, field }) => {
  const previousYear = String(Number(selectedYear) - 1);
  const previousData = annualByYear[previousYear];
  const current = annualByYear[selectedYear]?.annual?.[field];
  const previous = previousData?.annual?.[field];

  if (!previousData || previous == null || current == null || previous === 0) {
    return null;
  }

  const trend = ((current - previous) / previous) * 100;
  return Number(trend.toFixed(2));
};
