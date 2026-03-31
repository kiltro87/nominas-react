export const formatCurrency = (val) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

export const formatPercent = (val, digits = 2) => {
  const num = Number(val ?? 0);
  return `${num.toFixed(digits)}%`;
};
