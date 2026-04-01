/**
 * Formats a number as EUR currency using the Spanish locale.
 * @param {number} val
 * @returns {string} e.g. "1.234,56 €"
 */
export const formatCurrency = (val) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

/**
 * Formats a number as a percentage string.
 * @param {number|null|undefined} val
 * @param {number} [digits=2] - Decimal places.
 * @returns {string} e.g. "18.50%"
 */
export const formatPercent = (val, digits = 2) => {
  const num = Number(val ?? 0);
  return `${num.toFixed(digits)}%`;
};
