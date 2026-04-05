import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  LayoutDashboard,
  Landmark,
  Loader2,
  LogOut,
  Pencil,
  Percent,
  PieChart as PieChartIcon,
  PiggyBank,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Table,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import ProgressBar from './components/ProgressBar';
import SankeyChart from './components/SankeyChart';
import { computeSankeyFromConcepts } from './utils/sankeyMonthData';
import StatCard from './components/StatCard';
import { usePayrollData } from './hooks/usePayrollData';
import { usePortfolioData } from './hooks/usePortfolioData';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import { useStockPrice } from './hooks/useStockPrice';
import { formatCurrency, formatPercent } from './utils/format';
import { updateNominaConcept, upsertConceptCategory } from './services/payrollRepository';
import { syncExchangeRatesFromBDE } from './services/currencyRepository';
import { parseBenefitHistory } from './services/benefitHistoryParser';
import { applyExchangeRates, saveStockTransactions, exportToCSV } from './services/stockTransactionsRepository';

// ─── Portfolio chart (own state for hover) ───────────────────────────────────
const CHART_SERIES = [
  { field: 'cumulative_qty', stroke: '#3b82f6', label: 'Cartera neta',    width: '1.2', dash: null },
  { field: 'rsu_running',    stroke: '#6366f1', label: 'RSU acumuladas',  width: '0.8', dash: '2,1' },
  { field: 'espp_running',   stroke: '#10b981', label: 'ESPP acumuladas', width: '0.8', dash: '2,1' },
];

const resolvePortfolioType = (t) => {
  const tt = (t.transaction_type || '').toLowerCase();
  if (tt.includes('rsu'))   return 'rsu';
  if (tt.includes('espp'))  return 'espp';
  if (tt.includes('trade')) return 'trade';
  if (t.aeat_tipo === 'TR') return 'trade';
  const fn = (t.file_name || '').toLowerCase();
  if (fn.includes('rsu') || t.award_number) return 'rsu';
  return 'espp'; // default: all remaining acquisitions are ESPP
};

const PortfolioChart = ({ transactions }) => {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const pts = transactions.filter((t) => t.cumulative_qty != null);
  if (pts.length < 2) return <p className="text-sm text-slate-400 py-4">Datos insuficientes para el gráfico.</p>;

  // Running accumulation per type (functional to satisfy immutability lint rule)
  const enriched = pts.reduce((acc, t) => {
    const prev = acc[acc.length - 1];
    const type = resolvePortfolioType(t);
    const qty  = Math.abs(t.aeat_num_titulos ?? t.quantity ?? 0);
    const rsuR  = (prev?.rsu_running  ?? 0) + (type === 'rsu'  ? qty : 0);
    const esppR = (prev?.espp_running ?? 0) + (type === 'espp' ? qty : 0);
    return [...acc, { ...t, rsu_running: rsuR, espp_running: esppR }];
  }, []);

  const maxVal = Math.max(...enriched.map((t) => Math.max(t.cumulative_qty ?? 0, t.rsu_running, t.espp_running)), 1);

  // Time-proportional X axis
  const timestamps = enriched.map((t) => {
    const s = t.aeat_fecha || t.operation_date;
    return s ? new Date(s).getTime() : null;
  });
  const validTs = timestamps.filter(Boolean);
  const minDate = Math.min(...validTs);
  const maxDate = Math.max(...validTs);
  const dateRange = maxDate - minDate || 1;

  const L = 16; const R = 97; const T = 3; const B = 52;
  const xOf = (i) => {
    const ts = timestamps[i];
    return ts != null ? L + ((ts - minDate) / dateRange) * (R - L) : L + (i / (enriched.length - 1)) * (R - L);
  };
  const yOf = (v) => B - ((v / maxVal) * (B - T));
  const pointsOf = (field) => enriched.map((t, i) => `${xOf(i).toFixed(1)},${yOf(t[field] ?? 0).toFixed(1)}`).join(' ');

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ value: Math.round(maxVal * f), y: yOf(maxVal * f) }));

  // X-axis year labels (position based on Jan 1 of each year)
  const yearSet = new Set(validTs.map((ts) => new Date(ts).getFullYear()));
  const yearLabels = [...yearSet]
    .sort()
    .map((yr) => ({ yr: String(yr), x: L + ((new Date(yr, 0, 1).getTime() - minDate) / dateRange) * (R - L) }))
    .filter(({ x }) => x >= L && x <= R)
    .filter((lbl, i, arr) => i === 0 || lbl.x - arr[i - 1].x > 7);

  // Mouse hover
  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseXVB = ((e.clientX - rect.left) / rect.width) * 100;
    let nearest = 0;
    let minDist = Infinity;
    enriched.forEach((_, i) => { const d = Math.abs(xOf(i) - mouseXVB); if (d < minDist) { minDist = d; nearest = i; } });
    setHoverIdx(nearest);
  };

  const hoverPt   = hoverIdx != null ? enriched[hoverIdx] : null;
  const hoverX    = hoverIdx != null ? xOf(hoverIdx) : null;
  const tipOnLeft = hoverX != null && hoverX > (L + R) / 2;

  return (
    <>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 mb-4">
        {CHART_SERIES.map(({ stroke, label, dash }) => (
          <span key={label} className="flex items-center gap-2">
            <svg width="20" height="8">
              <line x1="0" y1="4" x2="20" y2="4" stroke={stroke} strokeWidth={dash ? 1.5 : 2} strokeDasharray={dash ?? undefined} />
            </svg>
            {label}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 100 62"
        className="w-full flex-1"
        style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y grid + labels */}
        {yTicks.map(({ value, y }) => (
          <g key={`yt-${value}`}>
            <line x1={L} y1={y} x2={R} y2={y} stroke="#f1f5f9" strokeWidth="0.4" />
            <text x={L - 1} y={y + 0.9} textAnchor="end" fontSize="2.4" fill="#94a3b8">{value}</text>
          </g>
        ))}
        {/* Axes */}
        <line x1={L} y1={T} x2={L}  y2={B} stroke="#e2e8f0" strokeWidth="0.4" />
        <line x1={L} y1={B} x2={R}  y2={B} stroke="#e2e8f0" strokeWidth="0.4" />
        <text transform={`rotate(-90) translate(-${(T + B) / 2}, ${L - 9})`} textAnchor="middle" fontSize="2.4" fill="#94a3b8">Acciones</text>
        {/* X labels */}
        {yearLabels.map(({ yr, x }) => (
          <text key={`xl-${yr}`} x={x} y={B + 4} textAnchor="middle" fontSize="2.4" fill="#94a3b8">{yr}</text>
        ))}
        {/* Series lines */}
        {CHART_SERIES.map(({ field, stroke, width, dash }) => (
          <polyline
            key={field}
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={dash ?? undefined}
            points={pointsOf(field)}
          />
        ))}
        {/* End-of-series dots */}
        {CHART_SERIES.map(({ field, stroke }) => {
          const last = enriched[enriched.length - 1];
          return <circle key={`d-${field}`} cx={xOf(enriched.length - 1)} cy={yOf(last[field] ?? 0)} r="1.3" fill={stroke} />;
        })}
        {/* Hover crosshair + tooltip */}
        {hoverPt && hoverX != null && (
          <g pointerEvents="none">
            <line x1={hoverX} y1={T} x2={hoverX} y2={B} stroke="#94a3b8" strokeWidth="0.3" strokeDasharray="1,0.5" />
            {CHART_SERIES.map(({ field, stroke }) => (
              <circle key={`h-${field}`} cx={hoverX} cy={yOf(hoverPt[field] ?? 0)} r="1.5" fill="white" stroke={stroke} strokeWidth="0.7" />
            ))}
            {(() => {
              const tx = tipOnLeft ? hoverX - 29 : hoverX + 2;
              const ty = T + 1;
              const date = hoverPt.aeat_fecha || hoverPt.operation_date || '—';
              return (
                <g>
                  <rect x={tx} y={ty} width="27" height="18" rx="1.5" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
                  <text x={tx + 1.5} y={ty + 3.8} fontSize="2.3" fill="#64748b" fontWeight="600">{date}</text>
                  {[
                    { label: `Total: ${hoverPt.cumulative_qty ?? 0}`, color: '#3b82f6', dy: 7 },
                    { label: `RSU: ${hoverPt.rsu_running}`,           color: '#6366f1', dy: 11 },
                    { label: `ESPP: ${hoverPt.espp_running}`,         color: '#10b981', dy: 15 },
                  ].map(({ label, color, dy }) => (
                    <g key={label}>
                      <circle cx={tx + 2.5} cy={ty + dy - 0.5} r="1" fill={color} />
                      <text x={tx + 5} y={ty + dy} fontSize="2.1" fill="#475569">{label}</text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </g>
        )}
        {/* Transparent hit-test area */}
        <rect x={L} y={T} width={R - L} height={B - T} fill="transparent" />
      </svg>
    </>
  );
};

const App = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // 'login' | 'reset-request' | 'set-password'
  const [loginView, setLoginView] = useState('login');
  const [loginError, setLoginError] = useState('');
  const [loginInfo, setLoginInfo] = useState('');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [useMockData, setUseMockData] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedNominaMonth, setSelectedNominaMonth] = useState(null); // null = latest
  const [evolHovered, setEvolHovered] = useState(null); // { i, h, x } for evolution chart tooltip
  // Inline concept editor state: null = closed; otherwise { id, item, category, subcategory }
  const [editingConcept, setEditingConcept] = useState(null);
  const [conceptSaving, setConceptSaving] = useState(false);
  const [excelUpload, setExcelUpload] = useState({
    status: 'idle', // idle | parsing | lookback | saving | done | error
    rows: [],
    message: '',
    savedCount: 0,
  });
  const {
    isReady,
    isAuthenticated,
    isPasswordRecovery,
    user,
    error: authConfigError,
    signInWithPassword,
    signInWithMagicLink,
    resetPasswordForEmail,
    updatePassword,
    signOut,
  } = useSupabaseAuth();
  const { year, availableYears, annual, irpf, history, selectedData, vestingSchedule, conceptsByYear, trend, sourceStatus } =
    usePayrollData(selectedYear, isAuthenticated, useMockData);
  const { price: crmPrice } = useStockPrice('CRM');
  const { portfolio } = usePortfolioData(isAuthenticated && !useMockData, useMockData);

  const previousYear = year === 'all' ? '' : String(Number(year) - 1);

  // Reset month selector and any open inline editor whenever the selected year changes
  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    setSelectedNominaMonth(null);
    setEditingConcept(null);
  };

  // Save inline concept edit: update payrolls row + upsert concept_categories
  const handleSaveConcept = async () => {
    if (!editingConcept) return;
    setConceptSaving(true);
    try {
      await updateNominaConcept(editingConcept.id, {
        item:        editingConcept.item,
        category:    editingConcept.category,
        subcategory: editingConcept.subcategory,
      });
      await upsertConceptCategory({
        item:        editingConcept.item,
        category:    editingConcept.category,
        subcategory: editingConcept.subcategory,
      });
      setEditingConcept(null);
      // Trigger a refetch by bumping the year (reset + reselect)
      handleYearChange(selectedYear);
    } catch {
      // Errors surface via sourceStatus; don't crash the UI
    } finally {
      setConceptSaving(false);
    }
  };

  // Derive the currently displayed month for Mi Nómina tab
  const { byMonth: conceptsByMonth = {}, availableMonths: availableConceptMonths = [] } = conceptsByYear;
  const latestConceptMonth = availableConceptMonths[availableConceptMonths.length - 1] ?? null;
  const effectiveNominaMonth = selectedNominaMonth ?? latestConceptMonth;
  const currentMonthConcepts = effectiveNominaMonth
    ? (conceptsByMonth[effectiveNominaMonth] ?? { ingresos: [], deducciones: [] })
    : { ingresos: [], deducciones: [] };

  // Gather all known subcategories for the concept editor datalist
  const KNOWN_SUBCATEGORIES = [
    'Ingreso Fijo', 'Ingreso Variable (Bonus)', 'Ingreso Variable (Dividendos)',
    'Ingreso Variable (ESPP)', 'Ingreso Variable (RSU)', 'Beneficio en Especie',
    'Ahorro Jubilación', 'Impuestos (IRPF)', 'Impuestos (Ajustes)',
    'Seguridad Social', 'Inversión Acciones (ESPP)', 'Diferido', 'Ajuste Contable',
  ];

  const ahorroFiscalGenerado = annual.deferredAmount * (irpf.tipoMarginal / 100);
  const esppYtd = annual.esppYtd ?? 0;
  const rsuYtd = annual.rsuYtd ?? 0;
  const pensionTotal = (annual.pensionCompanyTotal ?? 0) + (annual.pensionEmployeeTotal ?? 0);
  const pensionCompanyPct = pensionTotal > 0 ? Number((((annual.pensionCompanyTotal ?? 0) / pensionTotal) * 100).toFixed(1)) : 0;
  const pensionEmployeePct = pensionTotal > 0 ? Number((((annual.pensionEmployeeTotal ?? 0) / pensionTotal) * 100).toFixed(1)) : 0;


  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setExcelUpload({ status: 'parsing', rows: [], message: 'Leyendo Excel…', savedCount: 0 });

    try {
      // Step 1: parse
      const buffer = await file.arrayBuffer();
      const parsed = parseBenefitHistory(buffer);
      const allRows = [...parsed.rsu, ...parsed.espp];

      // Step 2: auto-sync BDE exchange rates (UC10); warn but don't abort on failure
      setExcelUpload((s) => ({ ...s, status: 'lookback', message: 'Sincronizando tipos de cambio BDE…', rows: allRows }));
      try {
        await syncExchangeRatesFromBDE();
      } catch {
        // non-blocking — continue with whatever rates are already in Supabase
      }

      // Step 3: apply lookback
      setExcelUpload((s) => ({ ...s, message: 'Aplicando tipos de cambio…' }));
      const withRates = await applyExchangeRates(allRows);
      const errorCount = withRates.filter((r) => r.status === 'ERROR').length;

      setExcelUpload({
        status: 'done',
        rows: withRates,
        message: errorCount
          ? `${withRates.length} filas procesadas · ${errorCount} con error de cambio`
          : `${withRates.length} filas procesadas · listas para guardar`,
        savedCount: 0,
      });
    } catch (err) {
      setExcelUpload({ status: 'error', rows: [], message: err.message, savedCount: 0 });
    }
  };

  const handleSaveTransactions = async () => {
    setExcelUpload((s) => ({ ...s, status: 'saving', message: 'Guardando en Supabase…' }));
    try {
      const count = await saveStockTransactions(excelUpload.rows);
      setExcelUpload((s) => ({
        ...s,
        status: 'done',
        message: `Guardado completado: ${count} operaciones en stock_transactions`,
        savedCount: count,
      }));
    } catch (err) {
      setExcelUpload((s) => ({ ...s, status: 'error', message: err.message }));
    }
  };

  const handleExportCSV = () => {
    if (!excelUpload.rows.length) return;
    const blob = exportToCSV(excelUpload.rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'acciones_aeat.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLoginMessages = () => {
    setLoginError('');
    setLoginInfo('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearLoginMessages();
    const normalizedEmail = email.trim().toLowerCase();
    const result = await signInWithPassword({ email: normalizedEmail, password });
    if (!result.ok) setLoginError(result.error ?? 'No se pudo iniciar sesion');
  };

  const handleMagicLink = async () => {
    clearLoginMessages();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setLoginError('Indica primero tu email para enviarte el enlace de acceso.');
      return;
    }
    const result = await signInWithMagicLink({ email: normalizedEmail });
    if (!result.ok) {
      setLoginError(result.error ?? 'No se pudo enviar el magic link');
      return;
    }
    setLoginInfo(`Te hemos enviado un enlace magico a ${normalizedEmail}.`);
  };

  const handleResetRequest = async (event) => {
    event.preventDefault();
    clearLoginMessages();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setLoginError('Indica tu email para restablecer la contraseña.');
      return;
    }
    const result = await resetPasswordForEmail(normalizedEmail);
    if (!result.ok) {
      setLoginError(result.error ?? 'No se pudo enviar el email');
      return;
    }
    setLoginInfo(`Revisa tu bandeja de entrada en ${normalizedEmail} y haz clic en el enlace para establecer tu contraseña.`);
  };

  const handleSetPassword = async (event) => {
    event.preventDefault();
    clearLoginMessages();
    if (newPassword !== confirmPassword) {
      setLoginError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setLoginError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    const result = await updatePassword(newPassword);
    if (!result.ok) {
      setLoginError(result.error ?? 'No se pudo actualizar la contraseña');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setLoginInfo('Contraseña establecida correctamente. Ya puedes iniciar sesion.');
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleExport = () => {
    const rows = history.map((h) => ({
      year,
      month: h.month,
      bruto: h.bruto,
      impuestos: h.tax,
      neto: h.neto,
    }));
    const header = ['year', 'month', 'bruto', 'impuestos', 'neto'];
    const csv = [
      header.join(','),
      ...rows.map((r) => [r.year, r.month, r.bruto, r.impuestos, r.neto].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nominas-${year}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">Cargando autenticacion...</div>
      </div>
    );
  }

  // When the user arrives via a password-reset email the SDK fires PASSWORD_RECOVERY
  // before marking them as fully authenticated. Show the set-password form immediately.
  const activeLoginView = isPasswordRecovery ? 'set-password' : loginView;

  if (!isAuthenticated || isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">

          {/* ── Set new password (after clicking reset link) ── */}
          {activeLoginView === 'set-password' && (
            <>
              <h1 className="text-xl font-bold mb-2">Establece tu contraseña</h1>
              <p className="text-sm text-slate-400 mb-4">Elige una contraseña de al menos 8 caracteres.</p>
              {loginError && <p className="text-sm text-rose-300 mb-3">{loginError}</p>}
              {loginInfo && <p className="text-sm text-emerald-300 mb-3">{loginInfo}</p>}
              <form onSubmit={handleSetPassword} className="space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  required
                  minLength={8}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar contraseña"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  required
                  minLength={8}
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold py-2.5 rounded-lg"
                >
                  Guardar contraseña
                </button>
              </form>
            </>
          )}

          {/* ── Request password reset email ── */}
          {activeLoginView === 'reset-request' && (
            <>
              <h1 className="text-xl font-bold mb-2">Restablecer contraseña</h1>
              <p className="text-sm text-slate-400 mb-4">
                Introduce tu email y te enviaremos un enlace para establecer una nueva contraseña.
              </p>
              {loginError && <p className="text-sm text-rose-300 mb-3">{loginError}</p>}
              {loginInfo && <p className="text-sm text-emerald-300 mb-3">{loginInfo}</p>}
              <form onSubmit={handleResetRequest} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu email"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold py-2.5 rounded-lg"
                >
                  Enviar enlace de restablecimiento
                </button>
              </form>
              <button
                type="button"
                onClick={() => { clearLoginMessages(); setLoginView('login'); }}
                className="mt-3 w-full text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Volver al inicio de sesion
              </button>
            </>
          )}

          {/* ── Normal login ── */}
          {activeLoginView === 'login' && (
            <>
              <h1 className="text-xl font-bold mb-2">Acceso privado</h1>
              <p className="text-sm text-slate-300 mb-4">Inicia sesion con tu cuenta.</p>
              {authConfigError && <p className="text-sm text-rose-300 mb-3">{authConfigError}</p>}
              {loginError && <p className="text-sm text-rose-300 mb-3">{loginError}</p>}
              {loginInfo && <p className="text-sm text-emerald-300 mb-3">{loginInfo}</p>}
              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold py-2.5 rounded-lg"
                >
                  Iniciar sesion
                </button>
              </form>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleMagicLink}
                  className="w-full bg-slate-700 hover:bg-slate-600 transition-colors text-white font-semibold py-2.5 rounded-lg text-sm"
                >
                  Acceder con magic link
                </button>
                <button
                  type="button"
                  onClick={() => { clearLoginMessages(); setLoginView('reset-request'); }}
                  className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors py-1"
                >
                  ¿No tienes contraseña o la olvidaste?
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    );
  }

  // ── Navigation config ────────────────────────────────────────────────────
  const NAV_TABS = [
    { id: 'overview',    label: 'Visión General', icon: LayoutDashboard },
    { id: 'nomina',      label: 'Mi Nómina',      icon: FileText        },
    { id: 'evolution',   label: 'Evolución',      icon: BarChart3       },
    { id: 'tax',         label: 'Fiscalidad',     icon: Landmark        },
    { id: 'investments', label: 'Inversiones',    icon: Briefcase       },
  ];

  const PAGE_META = {
    overview:    { title: 'Resumen Ejecutivo',      sub: 'Vista general de tu compensación' },
    nomina:      { title: 'Análisis de Nómina',     sub: effectiveNominaMonth ? `Mes ${effectiveNominaMonth} · ${year === 'all' ? 'selecciona un año' : year}` : 'Selecciona un año' },
    evolution:   { title: 'Evolución e Histórico',  sub: 'Tendencias y progresión salarial' },
    tax:         { title: 'Tramos e Impuestos',     sub: 'Fiscalidad y eficiencia tributaria' },
    investments: { title: 'Cartera e Inversiones',  sub: `Sesión: ${user?.email} · Fuente: Supabase` },
  };

  const pageMeta = PAGE_META[activeTab] ?? PAGE_META.overview;

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-extrabold text-base shrink-0 select-none">
            €
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
            NóminaClara
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon size={17} className="shrink-0" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Footer: user + logout */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-400 truncate mb-2" title={user?.email}>{user?.email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-rose-500 transition-colors"
          >
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* Topbar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{pageMeta.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {sourceStatus.updatedAt
                ? `Datos sincronizados con Supabase · ${new Date(sourceStatus.updatedAt).toLocaleDateString('es-ES')}`
                : pageMeta.sub}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Privacy */}
            <button
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-500"
              title="Modo Privacidad"
            >
              {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* Mock toggle */}
            <button
              onClick={() => setUseMockData((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                useMockData
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
              title="Alternar entre datos reales y mock"
            >
              {useMockData ? 'MOCK ON' : 'MOCK OFF'}
            </button>

            {/* Year selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
              <Calendar size={15} className="text-indigo-500 shrink-0" />
              <select
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                className="text-sm font-semibold bg-transparent outline-none cursor-pointer"
                aria-label="Seleccionar año"
              >
                <option value="all" className="text-slate-900">Todos los años</option>
                {availableYears.map((itemYear) => (
                  <option key={itemYear} value={itemYear} className="text-slate-900">{itemYear}</option>
                ))}
              </select>
              <ChevronDown size={13} className="text-slate-400" />
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Download size={15} />
              Exportar Reporte
            </button>
          </div>
        </header>

        {sourceStatus.error && (
          <div className="mx-8 mt-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
            No se pudo leer Supabase ({sourceStatus.error}). Se usa dataset mock.
          </div>
        )}

        {/* ── Tab content ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8">

        {/* ── Mi Nómina ─────────────────────────────────────────────── */}
        {activeTab === 'nomina' && (() => {
          const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

          // Plain render function — NOT used as a JSX component to avoid React
          // unmounting/remounting on every render (which caused null-prop crashes).
          const fmtAmt = (v) => `${(v ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
          const renderConceptRow = (c, amountClass, i) => {
            if (!c) return null;
            const isUnmatched = !c.subcategory;
            const isEditing = editingConcept != null && editingConcept.id === c.id;
            return (
              <div key={c.id ?? i}>
                {isEditing ? (
                  <div className="py-3 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-900/10 rounded-xl px-3 -mx-3 space-y-2">
                    <input
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 outline-none"
                      value={editingConcept.item}
                      onChange={(e) => setEditingConcept((p) => ({ ...p, item: e.target.value }))}
                      placeholder="Nombre del concepto"
                    />
                    <div className="flex gap-2">
                      <select
                        className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 outline-none"
                        value={editingConcept.category}
                        onChange={(e) => setEditingConcept((p) => ({ ...p, category: e.target.value }))}
                      >
                        <option value="Ingreso">Ingreso</option>
                        <option value="Deducción">Deducción</option>
                      </select>
                      <input
                        className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 outline-none"
                        value={editingConcept.subcategory}
                        onChange={(e) => setEditingConcept((p) => ({ ...p, subcategory: e.target.value }))}
                        placeholder="Subcategoría"
                        list="subcategoria-options"
                      />
                      <datalist id="subcategoria-options">
                        {KNOWN_SUBCATEGORIES.map((s) => <option key={s} value={s} />)}
                      </datalist>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingConcept(null)}
                        className="text-xs px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50"
                      ><X size={12} className="inline mr-1" />Cancelar</button>
                      <button
                        onClick={handleSaveConcept}
                        disabled={conceptSaving}
                        className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {conceptSaving ? <Loader2 size={12} className="inline animate-spin mr-1" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.item}</p>
                        {isUnmatched && (
                          <span className="shrink-0 text-[10px] font-bold uppercase bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded">
                            Sin categoría
                          </span>
                        )}
                      </div>
                      {c.subcategory && (
                        <p className="text-xs text-slate-400">{c.subcategory}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <p className={`text-sm font-bold ${amountClass}`}>
                        {isPrivacyMode ? '•••' : fmtAmt(c.amount)}
                      </p>
                      {c.id && (
                        <button
                          onClick={() => setEditingConcept({ id: c.id, item: c.item, category: c.category || '', subcategory: c.subcategory || '' })}
                          className={`p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${isUnmatched ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          title="Editar clasificación"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          };

          return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Distribución del mes seleccionado */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                    Distribución de la nómina
                  </h2>
                  {effectiveNominaMonth && year !== 'all' && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Datos reales del mes seleccionado
                    </p>
                  )}
                </div>
                {/* Month selector lives here, next to the card title */}
                {year !== 'all' && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-indigo-500 shrink-0" />
                    <select
                      value={effectiveNominaMonth ?? ''}
                      onChange={(e) => setSelectedNominaMonth(Number(e.target.value))}
                      disabled={availableConceptMonths.length === 0}
                      className="text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none cursor-pointer disabled:opacity-50"
                      aria-label="Seleccionar mes"
                    >
                      {availableConceptMonths.length === 0 && (
                        <option value="">Sin datos</option>
                      )}
                      {(() => {
                        const MONTH_NAMES_SEL = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                        return availableConceptMonths.map((m) => (
                          <option key={m} value={m}>{MONTH_NAMES_SEL[m]}</option>
                        ));
                      })()}
                    </select>
                  </div>
                )}
              </div>
              {year === 'all' ? (
                <p className="text-sm text-slate-400 py-4">
                  Selecciona un año concreto para ver la distribución mensual de conceptos.
                </p>
              ) : (
                <SankeyChart
                  monthData={currentMonthConcepts.ingresos.length > 0
                    ? computeSankeyFromConcepts(currentMonthConcepts)
                    : undefined}
                  annual={annual}
                  history={history}
                  isPrivate={isPrivacyMode}
                />
              )}
            </div>

            {/* Conceptos tables */}
            {year === 'all' ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <p className="text-sm text-slate-400">
                  Selecciona un año concreto para ver el desglose de conceptos por mes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Conceptos de Devengo */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
                    Conceptos de Devengo
                  </h3>
                  {currentMonthConcepts.ingresos.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin datos de conceptos para este mes.</p>
                  ) : (
                    <div className="space-y-0">
                      {currentMonthConcepts.ingresos.map((c, i) => renderConceptRow(c, c?.amount > 0 ? 'text-slate-800 dark:text-slate-100' : 'text-indigo-600', i))}
                      <div className="flex items-center justify-between pt-3 mt-1">
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Bruto</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {isPrivacyMode ? '•••' : `${currentMonthConcepts.ingresos.reduce((s, c) => s + (c?.amount ?? 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deducciones y Retenciones */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
                    Deducciones y Retenciones
                  </h3>
                  {currentMonthConcepts.deducciones.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin datos de deducciones para este mes.</p>
                  ) : (
                    <div className="space-y-0">
                      {currentMonthConcepts.deducciones.map((c, i) => renderConceptRow(c, 'text-rose-600', i))}
                      <div className="flex items-center justify-between pt-3 mt-1">
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Deducido</p>
                        <p className="text-sm font-bold text-rose-600">
                          {isPrivacyMode ? '•••' : `${currentMonthConcepts.deducciones.reduce((s, c) => s + (c?.amount ?? 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ── Visión General ────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title={year === 'all' ? 'Neto Mensual (Promedio Histórico)' : 'Sueldo Neto Mensual (Promedio)'}
                value={formatCurrency(selectedData.monthly.neto)}
                subValue={year === 'all' ? 'Media de todos los años' : `Ultimo mes: ${formatCurrency(selectedData.monthly.netoLastMonth ?? 0)}`}
                helpText={year === 'all' ? 'Promedio mensual del neto efectivo sobre todos los años con datos.' : 'Promedio del neto efectivo de los meses con datos del año seleccionado.'}
                icon={Wallet}
                color="blue"
                isPrivate={isPrivacyMode}
                trend={trend('neto', 'monthly')}
                trendYear={previousYear}
              />
              <StatCard
                title="Eficiencia Fiscal (IRPF)"
                value={formatPercent(annual.irpfAvgPct)}
                trend={trend('irpfAvgPct')}
                trendYear={previousYear}
                inverseTrend
                subValue={year === 'all' ? 'Media ponderada histórica' : 'Media mensual del % IRPF'}
                helpText={year === 'all' ? 'Media ponderada por bruto del % IRPF a lo largo de todos los años.' : 'Promedio de los conceptos de porcentaje IRPF detectados en las nóminas del año.'}
                icon={Percent}
                color="indigo"
              />
              <StatCard
                title={year === 'all' ? 'Ahorro y Capital (Total)' : 'Ahorro y Capital'}
                value={formatCurrency(annual.ahorroTotal)}
                trend={trend('ahorroTotal')}
                trendYear={previousYear}
                subValue="Incluye ESPP, RSU y Jubilacion"
                helpText={year === 'all' ? 'Suma total acumulada del ahorro diferido: pensiones, ESPP neto, RSU y conceptos diferidos.' : 'Suma del ahorro diferido: pensiones, ESPP neto, RSU y conceptos diferidos.'}
                icon={PiggyBank}
                color="emerald"
                isPrivate={isPrivacyMode}
              />
              <StatCard
                title={year === 'all' ? 'Salario Bruto Total' : 'Salario Bruto YTD'}
                value={formatCurrency(annual.bruto)}
                trend={trend('bruto')}
                trendYear={previousYear}
                subValue={year === 'all' ? 'Suma acumulada de todos los años' : 'Suma de salarios brutos del año'}
                helpText={year === 'all' ? 'Suma total de los importes positivos clasificados como ingresos en todos los años.' : 'Suma de los importes positivos clasificados como ingresos en el año.'}
                icon={Briefcase}
                color="slate"
                isPrivate={isPrivacyMode}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <PieChartIcon className="text-blue-500" size={22} /> Flujo de Compensacion YTD
                    </h2>
                    <p className="text-slate-400 text-sm">Visualizacion del Bruto vs Neto Real</p>
                  </div>
                </div>

                <div className="relative pt-6 pb-2">
                  <div className="flex flex-col gap-8">
                    <div className="relative">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">
                          Salario Bruto YTD
                        </span>
                        <span className="text-xl font-bold">
                          {isPrivacyMode ? '••••••' : formatCurrency(annual.bruto)}
                        </span>
                      </div>
                      <div className="flex justify-center h-8">
                        <div className="w-px bg-slate-200 dark:bg-slate-700 h-full relative">
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-slate-300" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase mb-2">
                          <TrendingDown size={14} /> Retenciones y Gastos
                        </div>
                        <div className="bg-rose-50/50 dark:bg-rose-900/10 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                          <ProgressBar
                            label="IRPF"
                            current={annual.irpfAvgPct}
                            total={100}
                            colorClass="bg-rose-500"
                          />
                          <ProgressBar
                            label="Seguridad Social"
                            current={annual.ssAvgPct}
                            total={100}
                            colorClass="bg-rose-400"
                          />
                          <div className="mt-4 pt-4 border-t border-rose-100 dark:border-rose-900/20 flex justify-between">
                            <span className="text-xs font-bold text-rose-600 uppercase">Total Deducido</span>
                            <span className="text-sm font-bold text-rose-700">
                              {isPrivacyMode ? '•••' : formatCurrency(annual.totalDeducido)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase mb-2">
                          <ShieldCheck size={14} /> Patrimonio Generado
                        </div>
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 h-full flex flex-col justify-between">
                          <div>
                            <ProgressBar
                              label="Neto Efectivo"
                              current={annual.netoEfectivoPct}
                              total={100}
                              colorClass="bg-emerald-500"
                            />
                            <ProgressBar
                              label="Ahorro Diferido"
                              current={annual.ahorroDiferidoPct}
                              total={100}
                              colorClass="bg-emerald-400"
                            />
                          </div>
                          <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-900/20 flex justify-between">
                            <span className="text-xs font-bold text-emerald-600 uppercase">Neto + Ahorro</span>
                            <span className="text-sm font-bold text-emerald-700">
                              {isPrivacyMode ? '•••' : formatCurrency(annual.netoEfectivoAmount + annual.deferredAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl flex items-start gap-3">
                  <Info className="text-blue-500 shrink-0" size={20} />
                  <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                    <strong>Analisis de Eficiencia:</strong> Tu tasa de ahorro efectiva es del{' '}
                    <span className="font-bold">
                      {annual.bruto > 0 ? formatPercent((annual.ahorroTotal / annual.bruto) * 100) : '—'}
                    </span>.
                    El ahorro diferido ({formatCurrency(annual.deferredAmount ?? 0)}) reduce tu base imponible aplicando un tipo marginal del{' '}
                    <span className="font-bold">{formatPercent(irpf.tipoMarginal)}</span>.
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold">Stocks e Inversion</h3>
                    <span className="text-[10px] uppercase font-bold text-slate-400">YTD Actual</span>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-slate-500 font-medium">ESPP (Stock Purchase)</span>
                        <span className="text-sm font-bold">{isPrivacyMode ? '•••' : formatCurrency(esppYtd)}</span>
                      </div>
                      <div className="text-[10px] text-emerald-500 font-bold">
                        Aportacion con 15% descuento
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-slate-500 font-medium">RSUs (Vesting)</span>
                        <span className="text-sm font-bold">{isPrivacyMode ? '•••' : formatCurrency(rsuYtd)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        Proximo evento: Oct 2025
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('investments')}
                    className="w-full mt-6 py-3 rounded-xl border border-blue-200 dark:border-blue-900/50 text-blue-600 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2"
                  >
                    Ver Detalles <ArrowRight size={14} />
                  </button>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold mb-2">Simulador de Bonus</h3>
                    <p className="text-blue-100 text-xs mb-4 leading-relaxed">
                      Calcula cuanto recibiras neto de tu variable anual tras impuestos.
                    </p>
                    <p className="text-blue-200/60 text-xs italic">Proximamente</p>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                </div>
              </div>
            </div>

            {/* ── Sankey: distribución mensual de nómina ── */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <PieChartIcon className="text-emerald-500" size={22} /> Distribución de la Nómina Mensual
                  </h2>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Del bruto mensual medio a Compensación (neto + ahorro) y Retenciones (IRPF + SS).
                    Datos: {year === 'all' ? `media histórica (${history.length} meses)` : `media mensual ${year} (${history.length} nóminas)`}.
                  </p>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                  {year === 'all' ? 'Promedio histórico' : `Año ${year}`}
                </span>
              </div>
              <SankeyChart annual={annual} history={history} isPrivate={isPrivacyMode} />
            </div>
          </div>
        )}

        {activeTab === 'tax' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Total IRPF Soportado"
                value={formatCurrency(annual.totalImpuestos)}
                subValue="Suma de conceptos de Tributacion IRPF"
                helpText="Suma de importes negativos de conceptos de tributación IRPF del año."
                icon={Landmark}
                color="rose"
                isPrivate={isPrivacyMode}
                trend={trend('totalImpuestos')}
                trendYear={previousYear}
                inverseTrend
              />
              <StatCard
                title="Tipo Efectivo vs Marginal"
                value={formatPercent(annual.irpfEfectivo)}
                trend={trend('irpfEfectivo')}
                trendYear={previousYear}
                inverseTrend
                subValue={`Marginal actual: ${formatPercent(irpf.tipoMarginal)}`}
                helpText="Tipo efectivo: IRPF total / bruto anual. Marginal: último tramo estatal + Madrid."
                icon={Percent}
                color="amber"
              />
              <StatCard
                title="Ahorro Fiscal Generado"
                value={formatCurrency(ahorroFiscalGenerado)}
                trend={trend('ahorroTotal')}
                trendYear={previousYear}
                subValue="Diferido * tipo marginal"
                helpText="Estimación del ahorro fiscal al aplicar el tipo marginal sobre el ahorro diferido."
                icon={ShieldCheck}
                color="emerald"
                isPrivate={isPrivacyMode}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <Receipt className="text-rose-500" size={22} />
                  Desglose IRPF (Estatal + Madrid)
                </h2>
                {irpf.tramos.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    Sin base suficiente para calcular tramos IRPF en este periodo.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {irpf.tramos.map((bracket, i) => {
                      const width = bracket.tramoCoveragePct;

                      return (
                        <div key={i} className="relative">
                          <div className="flex justify-between text-xs mb-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">
                              {bracket.label}{' '}
                              <span className="text-rose-500 font-bold ml-1">({bracket.rateTotal}%)</span>
                            </span>
                            <span className="font-bold">
                              {isPrivacyMode ? '•••' : formatCurrency(bracket.cuotaTotal)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mb-1">
                            Estatal {bracket.rateState}% + Madrid {bracket.rateMadrid}% sobre{' '}
                            {formatCurrency(bracket.baseInRange)} ({bracket.tramoCoveragePct}% del tramo)
                          </div>
                          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-full opacity-80"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                  Base usada: {isPrivacyMode ? '•••' : formatCurrency(irpf.base)}. Cuota estatal:{' '}
                  {isPrivacyMode ? '•••' : formatCurrency(irpf.cuotaState)} | Cuota Madrid:{' '}
                  {isPrivacyMode ? '•••' : formatCurrency(irpf.cuotaMadrid)}.
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <TrendingDown className="text-indigo-500" size={22} />
                  Optimizadores de Base Imponible
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                        <Info size={20} className="text-indigo-500" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Seguro Medico</p>
                        <p className="text-xs text-slate-500">Exento hasta 500EUR/ano</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">Optimizando</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'investments' && (
          <div className="space-y-8 animate-in fade-in duration-500">

            {/* ── Excel upload card ── */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-base font-bold flex items-center gap-2 mb-4">
                <Upload size={18} className="text-indigo-500" /> Subir Historial de Acciones
              </h3>

              {/* Upload row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">BenefitHistory.xlsx</p>
                  <p className="text-xs text-slate-400">Hojas: ESPP · Restricted Stock</p>
                </div>
                <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer shrink-0 transition-all ${
                  excelUpload.status === 'parsing' || excelUpload.status === 'lookback' || excelUpload.status === 'saving'
                    ? 'bg-indigo-300 cursor-not-allowed text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
                }`}>
                  {(excelUpload.status === 'parsing' || excelUpload.status === 'lookback' || excelUpload.status === 'saving')
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Upload size={15} />}
                  Subir Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleExcelUpload}
                    disabled={excelUpload.status === 'parsing' || excelUpload.status === 'lookback' || excelUpload.status === 'saving'}
                  />
                </label>
              </div>

              {/* Status message */}
              {excelUpload.message && (
                <p className={`text-xs mt-3 font-medium flex items-center gap-1 ${
                  excelUpload.status === 'error' ? 'text-rose-500' : 'text-slate-500'
                }`}>
                  {excelUpload.status === 'error' && <AlertTriangle size={13} />}
                  {excelUpload.status === 'done' && excelUpload.savedCount > 0 && <CheckCircle2 size={13} className="text-emerald-500" />}
                  {excelUpload.message}
                </p>
              )}

              {/* Preview table */}
              {excelUpload.rows.length > 0 && (
                <div className="mt-5">
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase">
                        <tr>
                          {['Plan','Tipo','Fecha','Grant','Cantidad','Acum. cartera','Precio USD','Cambio BDE','Importe EUR','Estado'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-bold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Sort by date, compute cumulative quantity
                          const sorted = [...excelUpload.rows].sort((a, b) => a.event_date.localeCompare(b.event_date));
                          let cumulative = 0;
                          return sorted.map((r, i) => {
                            cumulative += r.op_type === 'AD' ? r.quantity_gross : -r.quantity_gross;
                            return (
                              <tr
                                key={i}
                                title={r.error_msg ?? ''}
                                className={`border-t border-slate-50 dark:border-slate-800/30 ${
                                  r.status === 'ERROR' ? 'bg-rose-50 dark:bg-rose-900/10 text-rose-700' : ''
                                }`}
                              >
                                <td className="px-3 py-1.5 font-semibold">{r.plan_type}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    r.op_type === 'AD' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  }`}>{r.op_type}</span>
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap">{r.event_date}</td>
                                <td className="px-3 py-1.5 text-slate-400">{r.grant_id ?? '—'}</td>
                                <td className="px-3 py-1.5 text-right">{r.quantity_gross}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">{cumulative}</td>
                                <td className="px-3 py-1.5 text-right">
                                  {r.price_usd != null ? `$${r.price_usd.toFixed(2)}` : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-right">{r.rate_used != null ? r.rate_used.toFixed(4) : '—'}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">
                                  {r.amount_eur != null ? `${r.amount_eur.toFixed(2)} €` : '—'}
                                </td>
                                <td className="px-3 py-1.5">
                                  {r.status === 'ERROR'
                                    ? <span className="flex items-center gap-1 text-rose-600 font-bold"><AlertTriangle size={11} /> ERROR</span>
                                    : r.status === 'OK'
                                      ? <span className="text-emerald-600 font-bold">OK</span>
                                      : <span className="text-slate-400">{r.status}</span>}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleSaveTransactions}
                      disabled={
                        excelUpload.status === 'saving' ||
                        excelUpload.savedCount > 0 ||
                        excelUpload.rows.every((r) => r.status === 'ERROR')
                      }
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {excelUpload.status === 'saving'
                        ? <Loader2 size={14} className="animate-spin" />
                        : <CheckCircle2 size={14} />}
                      Guardar en Base de Datos
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      <Download size={14} /> Exportar CSV
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Summary cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Acciones en Cartera (CRM)"
                value={isPrivacyMode ? '••••••' : `${portfolio.currentQty} títulos`}
                subValue={
                  portfolio.currentQty > 0 && crmPrice
                    ? `≈ ${formatCurrency(portfolio.currentQty * crmPrice)} USD`
                    : crmPrice == null ? 'Precio CRM no disponible' : 'Sin datos de cartera'
                }
                helpText="Número de acciones CRM acumuladas según el último registro de cartera. Valor estimado al precio actual."
                icon={Briefcase}
                color="blue"
                isPrivate={isPrivacyMode}
              />
              <StatCard
                title="Coste Total de Adquisicion"
                value={formatCurrency(portfolio.totalEurValue)}
                subValue="Suma AEAT importe EUR (adquisiciones)"
                helpText="Suma del importe en euros de todas las adquisiciones (AD) registradas en cartera."
                icon={Wallet}
                color="indigo"
                isPrivate={isPrivacyMode}
              />
              <StatCard
                title="Ahorro Jubilacion Acumulado"
                value={formatCurrency((annual.pensionCompanyTotal ?? 0) + (annual.pensionEmployeeTotal ?? 0))}
                subValue="Empresa + Empleado"
                helpText="Suma de aportaciones al plan de pensiones de empresa y empleado en el año seleccionado."
                icon={PiggyBank}
                color="emerald"
                isPrivate={isPrivacyMode}
              />
            </div>

            {/* ── Chart + Table side-by-side ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">

              {/* Chart */}
              {portfolio.transactions.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col">
                  <h2 className="text-base font-bold flex items-center gap-2 mb-3">
                    <BarChart3 className="text-blue-500" size={18} />
                    Evolución de Acciones Acumuladas
                  </h2>
                  <PortfolioChart transactions={portfolio.transactions} />
                </div>
              )}

              {/* Table — filtered by the global year selector */}
              <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm ${portfolio.transactions.length === 0 ? 'xl:col-span-2' : ''}`}>
                <h2 className="text-base font-bold flex items-center gap-2 mb-4">
                  <Table className="text-rose-500" size={18} />
                  Cartera de Valores (AEAT) — {year}
                </h2>
                {portfolio.transactions.length === 0 ? (
                  <p className="text-sm text-slate-400">No hay transacciones cargadas. Ejecuta el pipeline de cartera desde GitHub Actions.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[36rem] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-900">
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wide">
                          <th className="text-left py-2 pr-3">Fecha</th>
                          <th className="text-left py-2 pr-3">Tipo</th>
                          <th className="text-right py-2 pr-3">Títulos</th>
                          <th className="text-right py-2 pr-3">Importe USD</th>
                          <th className="text-right py-2 pr-3">TC</th>
                          <th className="text-right py-2 pr-3">EUR</th>
                          <th className="text-right py-2">Acum.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.transactions
                          .filter((tx) => (tx.aeat_fecha || tx.operation_date || '').startsWith(year))
                          .map((tx) => {
                            const isSell = tx.aeat_tipo === 'TR' || (tx.transaction_type || '').toLowerCase().includes('trade');
                            return (
                              <tr key={tx.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="py-2 pr-3 font-medium">{tx.aeat_fecha ?? tx.operation_date ?? '—'}</td>
                                <td className="py-2 pr-3">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isSell ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                    {isSell ? 'Venta' : 'Adquisición'}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-right">{isPrivacyMode ? '•••' : (tx.aeat_num_titulos ?? Math.abs(tx.quantity ?? 0))}</td>
                                <td className="py-2 pr-3 text-right">{isPrivacyMode ? '•••' : (tx.net_amount_usd != null ? `$${Math.abs(tx.net_amount_usd).toFixed(2)}` : '—')}</td>
                                <td className="py-2 pr-3 text-right text-slate-400">{tx.conversion_rate != null ? tx.conversion_rate.toFixed(4) : '—'}</td>
                                <td className={`py-2 pr-3 text-right font-semibold ${isSell ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {isPrivacyMode ? '•••' : (tx.aeat_importe_eur != null ? formatCurrency(Math.abs(tx.aeat_importe_eur)) : '—')}
                                </td>
                                <td className="py-2 text-right text-slate-500">{isPrivacyMode ? '•••' : (tx.cumulative_qty ?? '—')}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* ── Pension + Vesting ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <Clock className="text-blue-500" size={22} />
                  Calendario de Vesting
                </h2>
                {vestingSchedule.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin datos de vesting. Pendiente de implementar lectura de PDFs de calendario RSU.</p>
                ) : (
                  <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-4 space-y-8 py-2">
                    {vestingSchedule.map((vest, i) => (
                      <div key={i} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${vest.status === 'pending' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">{vest.type} Release</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {isPrivacyMode ? '•••' : formatCurrency(vest.amount)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {vest.date} • {vest.status === 'pending' ? 'Proximo a devengar' : 'Bloqueado / Future grant'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <PieChartIcon className="text-emerald-500" size={22} />
                  Composicion Plan de Jubilacion
                </h2>
                <div className="w-full space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
                        Aportacion Empresa ({pensionCompanyPct}%)
                      </span>
                      <span className="font-bold">{isPrivacyMode ? '•••' : formatCurrency(annual.pensionCompanyTotal ?? 0)}</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pensionCompanyPct}%` }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                        Aportacion Empleado ({pensionEmployeePct}%)
                      </span>
                      <span className="font-bold">{isPrivacyMode ? '•••' : formatCurrency(annual.pensionEmployeeTotal ?? 0)}</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${pensionEmployeePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evolution' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-8">
                <BarChart3 className="text-blue-500" size={22} />
                {year === 'all' ? 'Evolucion Historica: Bruto vs Neto vs Impuestos' : 'Evolucion Mensual: Bruto vs Neto vs Impuestos'}
              </h2>

              <div className="mt-2 mb-10">
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" /> Salario Bruto
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" /> Impuestos (IRPF + SS)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" /> Neto Percibido
                  </span>
                  <span className="ml-auto text-xs text-slate-400 italic">
                    {year === 'all' ? 'Datos agregados anuales' : `${history.length} mes${history.length !== 1 ? 'es' : ''} con datos en ${year}`}
                  </span>
                </div>

                {/* Chart: aspect-ratio wrapper prevents distortion; max-width prevents excessive size */}
                {(() => {
                  const maxVal = Math.max(...history.map((x) => Math.max(x.bruto, x.neto, x.tax)), 1);
                  const ticks = [0, 0.25, 0.5, 0.75, 1];
                  const ptX = (i) => history.length === 1 ? 50 : (i / (history.length - 1)) * 96 + 2;
                  const toPoints = (field) =>
                    history.map((h, i) => `${ptX(i)},${30 - (h[field] / maxVal) * 26}`).join(' ');
                  return (
                    <div style={{ aspectRatio: '100/34', maxWidth: '900px' }} className="w-full mx-auto relative">
                      <svg
                        viewBox="0 0 100 34"
                        className="w-full h-full bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800"
                      >
                        {ticks.map((t) => {
                          const y = 30 - 26 * t;
                          return (
                            <g key={`tick-${t}`}>
                              <line x1="2" x2="98" y1={y} y2={y} stroke="#cbd5e1" strokeWidth="0.25" />
                              <text x="0.5" y={y + 0.9} fontSize="1.8" fill="#64748b">
                                {Math.round(maxVal * t)}
                              </text>
                            </g>
                          );
                        })}
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="0.8" points={toPoints('bruto')} />
                        <polyline fill="none" stroke="#f43f5e" strokeWidth="0.8" points={toPoints('tax')} />
                        <polyline fill="none" stroke="#10b981" strokeWidth="0.8" points={toPoints('neto')} />
                        {history.map((h, i) => {
                          const x = ptX(i);
                          const isHov = evolHovered?.i === i;
                          const yB = 30 - (h.bruto / maxVal) * 26;
                          const yT = 30 - (h.tax / maxVal) * 26;
                          const yN = 30 - (h.neto / maxVal) * 26;
                          return (
                            <g key={`pts-${i}`}
                              onMouseEnter={() => setEvolHovered({ i, h, x })}
                              onMouseLeave={() => setEvolHovered(null)}
                              style={{ cursor: 'crosshair' }}
                            >
                              {/* Wide invisible hit area per column */}
                              <line x1={x} x2={x} y1="2" y2="31" stroke="transparent" strokeWidth="5" />
                              {isHov && <line x1={x} x2={x} y1="2" y2="31" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="1,0.8" />}
                              <circle cx={x} cy={yB} r={isHov ? '1.1' : '0.7'} fill="#3b82f6" />
                              <circle cx={x} cy={yT} r={isHov ? '1.1' : '0.7'} fill="#f43f5e" />
                              <circle cx={x} cy={yN} r={isHov ? '1.1' : '0.7'} fill="#10b981" />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Custom tooltip overlay */}
                      {evolHovered && (() => {
                        const leftPct = evolHovered.x; // already in 0-100 SVG units = percentage
                        return (
                          <div
                            className="absolute z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2.5 text-xs pointer-events-none"
                            style={{
                              left: `${leftPct}%`,
                              bottom: '105%',
                              transform: 'translateX(-50%)',
                              minWidth: '140px',
                            }}
                          >
                            <p className="font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                              {evolHovered.h.month}{year !== 'all' ? ` ${year}` : ''}
                            </p>
                            <p className="text-blue-600 dark:text-blue-400">
                              Bruto: {isPrivacyMode ? '•••' : formatCurrency(evolHovered.h.bruto)}
                            </p>
                            <p className="text-rose-500">
                              Impuestos: {isPrivacyMode ? '•••' : formatCurrency(evolHovered.h.tax)}
                            </p>
                            <p className="text-emerald-600 dark:text-emerald-400 font-bold">
                              Neto: {isPrivacyMode ? '•••' : formatCurrency(evolHovered.h.neto)}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* X-axis month labels */}
                <div style={{ maxWidth: '900px' }} className="flex justify-between mx-auto mt-2 text-[11px] text-slate-400 font-semibold">
                  {history.map((h, i) => (
                    <span key={`${h.month}-${i}`}>{h.month}</span>
                  ))}
                </div>
              </div>

              <div className="mt-10 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs">
                      <th className="pb-3 font-bold">{year === 'all' ? 'Año' : 'Mes'}</th>
                      <th className="pb-3 font-bold text-right">Salario Bruto</th>
                      <th className="pb-3 font-bold text-right">Impuestos (IRPF+SS)</th>
                      <th className="pb-3 font-bold text-right text-emerald-600">Neto Pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="py-3 font-bold">
                          {year === 'all' ? h.month : `${h.month} ${year}`}
                        </td>
                        <td className="py-3 text-right">
                          {isPrivacyMode ? '•••' : formatCurrency(h.bruto)}
                        </td>
                        <td className="py-3 text-right text-rose-500">
                          {isPrivacyMode ? '•••' : formatCurrency(h.tax)}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-600">
                          {isPrivacyMode ? '•••' : formatCurrency(h.neto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        </main>
      </div>
    </div>
  );
};

export default App;
