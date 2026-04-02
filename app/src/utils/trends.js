/**
 * Calculates the year-over-year percentage change for a given field.
 *
 * @param {object} params
 * @param {string} params.selectedYear
 * @param {object} params.annualByYear
 * @param {string} params.field - Field name within the section object.
 * @param {'annual'|'monthly'} [params.section='annual'] - Which data section to compare.
 * @returns {number|null} Percentage change, or null if comparison is not possible.
 */
export const calcTrend = ({ selectedYear, annualByYear, field, section = 'annual' }) => {
  if (selectedYear === 'all') return null;
  const previousYear = String(Number(selectedYear) - 1);
  const previousData = annualByYear[previousYear];
  const current = annualByYear[selectedYear]?.[section]?.[field];
  const previous = previousData?.[section]?.[field];

  if (!previousData || previous == null || current == null || previous === 0) {
    return null;
  }

  const trend = ((current - previous) / previous) * 100;
  return Number(trend.toFixed(2));
};
