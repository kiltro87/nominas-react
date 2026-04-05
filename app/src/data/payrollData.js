export const payrollData = {
  annualByYear: {
    '2024': {
      monthly: {
        bruto: 4200,
        neto: 2800,
        irpf: 30,
        totalIngresos: 4200,
        ahorroFiscal: 500,
        jubilacion: 900,
        especie: 200,
        netoLastMonth: 2800,
      },
      annual: {
        bruto: 48000,
        neto: 30000,
        irpfEfectivo: 28,
        irpfAvgPct: 28,
        ssAvgPct: 6.25,
        ahorroTotal: 6000,
        totalImpuestos: 12000,
        totalSS: 3000,
        totalDeducido: 15000,
        deferredAmount: 5400,
        netoEfectivoAmount: 32000,
        netoEfectivoPct: 66.7,
        ahorroDiferidoPct: 11.25,
        esppYtd: 1500,
        rsuYtd: 7000,
        pensionCompanyTotal: 2400,
        pensionEmployeeTotal: 1200,
      },
      history: [
        { month: 'Ene', neto: 4300, bruto: 8200, tax: 2800 },
        { month: 'Feb', neto: 4325, bruto: 8200, tax: 2825 },
        { month: 'Mar', neto: 4400, bruto: 8400, tax: 2900 },
        { month: 'Abr', neto: 4380, bruto: 8450, tax: 2920 },
        { month: 'May', neto: 4420, bruto: 8500, tax: 2950 },
        { month: 'Jun', neto: 6100, bruto: 11200, tax: 3600 },
        { month: 'Jul', neto: 4390, bruto: 8450, tax: 2925 },
        { month: 'Ago', neto: 4395, bruto: 8450, tax: 2920 },
        { month: 'Sep', neto: 4400, bruto: 8450, tax: 2920 },
      ],
    },
    '2025': {
      monthly: {
        bruto: 5000,
        neto: 3000,
        irpf: 31,
        totalIngresos: 5000,
        ahorroFiscal: 700,
        jubilacion: 1200,
        especie: 250,
        netoLastMonth: 3000,
      },
      annual: {
        bruto: 50000,
        neto: 32000,
        irpfEfectivo: 31,
        irpfAvgPct: 31,
        ssAvgPct: 7,
        ahorroTotal: 8000,
        totalImpuestos: 13000,
        totalSS: 3500,
        totalDeducido: 16500,
        deferredAmount: 6000,
        netoEfectivoAmount: 34000,
        netoEfectivoPct: 68,
        ahorroDiferidoPct: 12,
        esppYtd: 1800,
        rsuYtd: 8500,
        pensionCompanyTotal: 2800,
        pensionEmployeeTotal: 1400,
      },
      history: [
        { month: 'Ene', neto: 5100, bruto: 9200, tax: 3200 },
        { month: 'Feb', neto: 5150, bruto: 9200, tax: 3250 },
        { month: 'Mar', neto: 5300, bruto: 9500, tax: 3300 },
        { month: 'Abr', neto: 5287, bruto: 9765, tax: 3400 },
        { month: 'May', neto: 5350, bruto: 9800, tax: 3450 },
        { month: 'Jun', neto: 7800, bruto: 14000, tax: 4500 },
        { month: 'Jul', neto: 5287, bruto: 9765, tax: 3400 },
        { month: 'Ago', neto: 5287, bruto: 9765, tax: 3400 },
        { month: 'Sep', neto: 5287, bruto: 9765, tax: 3400 },
      ],
    },
  },
  vestingSchedule: [
    { date: 'Oct 2025', type: 'RSU', amount: 8500, status: 'pending' },
    { date: 'Nov 2025', type: 'ESPP', amount: 1500, status: 'pending' },
    { date: 'Abr 2026', type: 'RSU', amount: 8500, status: 'locked' },
  ],
};

/**
 * Builds a mock month entry for one payslip.
 * @param {number} base - Base salary
 * @param {number} complement
 * @param {number|null} bonus - Bonus amount (only in March)
 * @param {number} irpfAmt - IRPF deduction (negative)
 * @param {number} ssAmt - SS deduction (negative)
 */
const mockMonth = (base, complement, bonus, irpfAmt, ssAmt) => ({
  ingresos: [
    { concepto: 'Salario Base',       'categoría': 'Ingreso',   'subcategoría': 'Salario',            importe: base },
    { concepto: 'Complemento Mejora', 'categoría': 'Ingreso',   'subcategoría': 'Complemento',        importe: complement },
    ...(bonus ? [{ concepto: 'Bonus por Objetivos', 'categoría': 'Ingreso', 'subcategoría': 'Variable', importe: bonus }] : []),
  ],
  deducciones: [
    { concepto: 'Retención IRPF',               'categoría': 'Deducción', 'subcategoría': 'Tributación IRPF', importe: irpfAmt },
    { concepto: 'Seguridad Social',             'categoría': 'Deducción', 'subcategoría': 'Seguridad Social', importe: ssAmt },
    { concepto: 'Plan de Pensiones (empleado)', 'categoría': 'Deducción', 'subcategoría': 'Diferido',         importe: -200 },
    { concepto: 'Seguro Médico (Flexible)',      'categoría': 'Deducción', 'subcategoría': 'Diferido',         importe: -80 },
  ],
});

/** Mock per-concept breakdown for the "Mi Nómina" tab — grouped by year → month. */
export const mockConceptsByYear = {
  '2025': {
    availableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    byMonth: {
      1: mockMonth(7500, 400, null,   -2850, -1050),
      2: mockMonth(7500, 400, null,   -2850, -1050),
      3: mockMonth(7500, 400, 1200,   -3220, -1050),
      4: mockMonth(7500, 400, null,   -2850, -1050),
      5: mockMonth(7500, 400, null,   -2850, -1050),
      6: mockMonth(15000, 400, null,  -5700, -1050), // paga extra
      7: mockMonth(7500, 400, null,   -2900, -1050),
      8: mockMonth(7500, 400, null,   -2900, -1050),
      9: mockMonth(7500, 400, null,   -2900, -1050),
    },
  },
  '2024': {
    availableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    byMonth: {
      1: mockMonth(7000, 350, null,   -2650, -975),
      2: mockMonth(7000, 350, null,   -2650, -975),
      3: mockMonth(7000, 350, 850,    -2900, -975),
      4: mockMonth(7000, 350, null,   -2650, -975),
      5: mockMonth(7000, 350, null,   -2650, -975),
      6: mockMonth(14000, 350, null,  -5300, -975), // paga extra
      7: mockMonth(7000, 350, null,   -2700, -975),
      8: mockMonth(7000, 350, null,   -2700, -975),
      9: mockMonth(7000, 350, null,   -2700, -975),
    },
  },
};

export const portfolioMockData = {
  transactions: [
    { id: 1,  file_name: 'getEsppConfirmation(1).pdf',        transaction_type: 'Adquisition ESPP', operation_date: '2020-02-18', aeat_fecha: '2020-02-18', award_number: null,     aeat_tipo: 'AD', aeat_num_titulos: 19, quantity:  19, net_amount_usd:  2134.56, conversion_rate: 1.0827, aeat_importe_eur:  1971.47, ordering: 20200218, cumulative_qty:  19 },
    { id: 2,  file_name: 'RSUReleaseConfirmation_2020.pdf',    transaction_type: 'Adquisition RSU',  operation_date: '2020-10-15', aeat_fecha: '2020-10-15', award_number: 'AW-1001', aeat_tipo: 'AD', aeat_num_titulos: 42, quantity:  42, net_amount_usd:  9345.20, conversion_rate: 1.1712, aeat_importe_eur:  7979.10, ordering: 20201015, cumulative_qty:  61 },
    { id: 3,  file_name: 'getEsppConfirmation(2).pdf',        transaction_type: 'Adquisition ESPP', operation_date: '2021-02-20', aeat_fecha: '2021-02-20', award_number: null,     aeat_tipo: 'AD', aeat_num_titulos: 17, quantity:  17, net_amount_usd:  3201.45, conversion_rate: 1.2132, aeat_importe_eur:  2638.42, ordering: 20210220, cumulative_qty:  78 },
    { id: 4,  file_name: 'RSUReleaseConfirmation_2021.pdf',    transaction_type: 'Adquisition RSU',  operation_date: '2021-10-15', aeat_fecha: '2021-10-15', award_number: 'AW-1002', aeat_tipo: 'AD', aeat_num_titulos: 42, quantity:  42, net_amount_usd: 11204.00, conversion_rate: 1.1598, aeat_importe_eur:  9660.28, ordering: 20211015, cumulative_qty: 120 },
    { id: 5,  file_name: 'TradeConfirmation_20220314.pdf',     transaction_type: 'Trade',            operation_date: '2022-03-14', aeat_fecha: '2022-03-14', award_number: null,     aeat_tipo: 'TR', aeat_num_titulos: 30, quantity: -30, net_amount_usd:  7512.30, conversion_rate: 1.0958, aeat_importe_eur:  6855.43, ordering: 20220314, cumulative_qty:  90 },
    { id: 6,  file_name: 'getEsppConfirmation(3).pdf',        transaction_type: 'Adquisition ESPP', operation_date: '2022-08-22', aeat_fecha: '2022-08-22', award_number: null,     aeat_tipo: 'AD', aeat_num_titulos: 21, quantity:  21, net_amount_usd:  3876.50, conversion_rate: 1.0029, aeat_importe_eur:  3865.97, ordering: 20220822, cumulative_qty: 111 },
    { id: 7,  file_name: 'RSUReleaseConfirmation_2022.pdf',    transaction_type: 'Adquisition RSU',  operation_date: '2022-10-15', aeat_fecha: '2022-10-15', award_number: 'AW-1003', aeat_tipo: 'AD', aeat_num_titulos: 42, quantity:  42, net_amount_usd:  7182.00, conversion_rate: 0.9784, aeat_importe_eur:  7340.53, ordering: 20221015, cumulative_qty: 153 },
    { id: 8,  file_name: 'getEsppConfirmation(4).pdf',        transaction_type: 'Adquisition ESPP', operation_date: '2023-02-25', aeat_fecha: '2023-02-25', award_number: null,     aeat_tipo: 'AD', aeat_num_titulos: 18, quantity:  18, net_amount_usd:  2890.44, conversion_rate: 1.0611, aeat_importe_eur:  2723.99, ordering: 20230225, cumulative_qty: 171 },
    { id: 9,  file_name: 'RSUReleaseConfirmation_2023.pdf',    transaction_type: 'Adquisition RSU',  operation_date: '2023-10-15', aeat_fecha: '2023-10-15', award_number: 'AW-1004', aeat_tipo: 'AD', aeat_num_titulos: 42, quantity:  42, net_amount_usd:  9471.00, conversion_rate: 1.0563, aeat_importe_eur:  8965.38, ordering: 20231015, cumulative_qty: 213 },
    { id: 10, file_name: 'getEsppConfirmation(5).pdf',        transaction_type: 'Adquisition ESPP', operation_date: '2024-02-22', aeat_fecha: '2024-02-22', award_number: null,     aeat_tipo: 'AD', aeat_num_titulos: 16, quantity:  16, net_amount_usd:  3271.81, conversion_rate: 1.0821, aeat_importe_eur:  3023.52, ordering: 20240222, cumulative_qty: 229 },
    { id: 11, file_name: 'RSUReleaseConfirmation_2024.pdf',    transaction_type: 'Adquisition RSU',  operation_date: '2024-10-15', aeat_fecha: '2024-10-15', award_number: 'AW-1005', aeat_tipo: 'AD', aeat_num_titulos: 42, quantity:  42, net_amount_usd: 11088.00, conversion_rate: 1.0934, aeat_importe_eur: 10141.52, ordering: 20241015, cumulative_qty: 271 },
  ],
  currentQty: 271,
  totalEurValue: 64309.68,
};
