import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  Info,
  Landmark,
  Percent,
  PieChart as PieChartIcon,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Table,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import ProgressBar from './components/ProgressBar';
import StatCard from './components/StatCard';
import { usePayrollData } from './hooks/usePayrollData';
import { usePortfolioData } from './hooks/usePortfolioData';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import { useStockPrice } from './hooks/useStockPrice';
import { formatCurrency, formatPercent } from './utils/format';

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
  const { year, availableYears, annual, irpf, history, selectedData, vestingSchedule, trend, sourceStatus } =
    usePayrollData(selectedYear, isAuthenticated, useMockData);
  const { price: crmPrice } = useStockPrice('CRM');
  const { portfolio } = usePortfolioData(isAuthenticated && !useMockData, useMockData);
  // '' means "auto" (default to last available year); explicit string = user selection
  const [portfolioYearFilter, setPortfolioYearFilter] = useState('');
  const portfolioYears = [...new Set(
    portfolio.transactions
      .map((t) => (t.aeat_fecha || t.operation_date || '').slice(0, 4))
      .filter(Boolean),
  )].sort();
  const activePortfolioYear = portfolioYearFilter || portfolioYears[portfolioYears.length - 1] || 'all';

  const previousYear = String(Number(year) - 1);
  const ahorroFiscalGenerado = annual.deferredAmount * (irpf.tipoMarginal / 100);
  const esppYtd = annual.esppYtd ?? 0;
  const rsuYtd = annual.rsuYtd ?? 0;
  const pensionTotal = (annual.pensionCompanyTotal ?? 0) + (annual.pensionEmployeeTotal ?? 0);
  const pensionCompanyPct = pensionTotal > 0 ? Number((((annual.pensionCompanyTotal ?? 0) / pensionTotal) * 100).toFixed(1)) : 0;
  const pensionEmployeePct = pensionTotal > 0 ? Number((((annual.pensionEmployeeTotal ?? 0) / pensionTotal) * 100).toFixed(1)) : 0;

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-8">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Payroll Intelligence
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Analisis detallado de compensacion y eficiencia fiscal
          </p>
          <p className="text-xs text-slate-400 mt-1">Sesion: {user?.email}</p>
          <p className="text-xs text-slate-400 mt-1">
            Fuente: {sourceStatus.source}
            {sourceStatus.updatedAt ? ` · Actualizado: ${new Date(sourceStatus.updatedAt).toLocaleString('es-ES')}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setIsPrivacyMode(!isPrivacyMode)}
            className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
            title="Modo Privacidad"
          >
            {isPrivacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button
            onClick={() => setUseMockData((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              useMockData
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
            title="Alternar entre datos reales y mock"
          >
            {useMockData ? 'MOCK ON' : 'MOCK OFF'}
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors">
            <Calendar size={18} className="text-blue-500" />
            <select
              value={year}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="font-semibold text-sm bg-transparent outline-none cursor-pointer"
              aria-label="Seleccionar año"
            >
              {availableYears.map((itemYear) => (
                <option key={itemYear} value={itemYear} className="text-slate-900">
                  {itemYear}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <button
            onClick={handleExport}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cerrar sesion
          </button>
        </div>
      </header>

      {sourceStatus.error && (
        <div className="max-w-7xl mx-auto mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          No se pudo leer Supabase ({sourceStatus.error}). Se usa dataset mock.
        </div>
      )}

      <main className="max-w-7xl mx-auto space-y-8">
        <div className="flex gap-6 border-b border-slate-200 dark:border-slate-800 overflow-x-auto hide-scrollbar">
          {[
            { id: 'overview', label: 'VISION GENERAL', icon: PieChartIcon },
            { id: 'tax', label: 'IMPUESTOS', icon: Landmark },
            { id: 'investments', label: 'INVERSIONES', icon: Briefcase },
            { id: 'evolution', label: 'EVOLUCION', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Sueldo Neto Mensual (Promedio)"
                value={formatCurrency(selectedData.monthly.neto)}
                subValue={`Ultimo mes: ${formatCurrency(selectedData.monthly.netoLastMonth ?? 0)}`}
                helpText="Promedio del neto efectivo de los meses con datos del año seleccionado."
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
                subValue="Media mensual del % IRPF"
                helpText="Promedio de los conceptos de porcentaje IRPF detectados en las nóminas del año."
                icon={Percent}
                color="indigo"
              />
              <StatCard
                title="Ahorro y Capital"
                value={formatCurrency(annual.ahorroTotal)}
                trend={trend('ahorroTotal')}
                trendYear={previousYear}
                subValue="Incluye ESPP, RSU y Jubilacion"
                helpText="Suma del ahorro diferido: pensiones, ESPP neto, RSU y conceptos diferidos."
                icon={PiggyBank}
                color="emerald"
                isPrivate={isPrivacyMode}
              />
              <StatCard
                title="Salario Bruto YTD"
                value={formatCurrency(annual.bruto)}
                trend={trend('bruto')}
                trendYear={previousYear}
                subValue="Suma de salarios brutos del año"
                helpText="Suma de los importes positivos clasificados como ingresos en el año."
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
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 mb-4">
                    <span className="flex items-center gap-2">
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#3b82f6" strokeWidth="2" /></svg>
                      Cartera neta
                    </span>
                    <span className="flex items-center gap-2">
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                      RSU acumuladas
                    </span>
                    <span className="flex items-center gap-2">
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
                      ESPP acumuladas
                    </span>
                  </div>
                  {(() => {
                    const pts = portfolio.transactions.filter((t) => t.cumulative_qty != null);
                    if (pts.length < 2) return <p className="text-sm text-slate-400">Datos insuficientes para el gráfico.</p>;

                    // Resolve transaction type: use transaction_type when present,
                    // otherwise fall back to file_name heuristic + award_number
                    const resolveType = (t) => {
                      if (t.transaction_type) return t.transaction_type.trim();
                      if (t.aeat_tipo === 'TR') return 'Trade';
                      const name = (t.file_name || '').toLowerCase();
                      if (name.includes('rsu') || t.award_number) return 'Adquisition RSU';
                      if (name.includes('espp') || t.aeat_tipo === 'AD') return 'Adquisition ESPP';
                      return '';
                    };

                    let rsuAcc = 0;
                    let esppAcc = 0;
                    const enriched = pts.map((t) => {
                      const tt = resolveType(t);
                      const qty = Math.abs(t.aeat_num_titulos ?? t.quantity ?? 0);
                      if (tt === 'Adquisition RSU') rsuAcc += qty;
                      else if (tt === 'Adquisition ESPP') esppAcc += qty;
                      return { ...t, rsu_running: rsuAcc, espp_running: esppAcc };
                    });

                    const maxVal = Math.max(
                      ...enriched.map((t) => Math.max(t.cumulative_qty ?? 0, t.rsu_running, t.espp_running)),
                      1,
                    );

                    const L = 16; const R = 97; const T = 3; const B = 52;
                    const xOf = (i) => L + (i / (enriched.length - 1)) * (R - L);
                    const yOf = (v) => B - ((v / maxVal) * (B - T));
                    const pointsOf = (field) => enriched.map((t, i) => `${xOf(i).toFixed(1)},${yOf(t[field] ?? 0).toFixed(1)}`).join(' ');

                    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
                      value: Math.round(maxVal * f),
                      y: yOf(maxVal * f),
                    }));

                    const yearLabels = [];
                    let lastYear = null;
                    let lastX = -20;
                    enriched.forEach((t, i) => {
                      const yr = (t.aeat_fecha || t.operation_date || '').slice(0, 4);
                      const x = xOf(i);
                      if (yr && yr !== lastYear && x - lastX > 8) {
                        yearLabels.push({ yr, x });
                        lastYear = yr;
                        lastX = x;
                      }
                    });

                    const SERIES = [
                      { field: 'cumulative_qty', stroke: '#3b82f6', width: '1.2', dash: null },
                      { field: 'rsu_running',    stroke: '#6366f1', width: '0.8', dash: '2,1' },
                      { field: 'espp_running',   stroke: '#10b981', width: '0.8', dash: '2,1' },
                    ];

                    return (
                      <svg viewBox="0 0 100 62" className="w-full flex-1">
                        {yTicks.map(({ value, y }) => (
                          <g key={`yt-${value}`}>
                            <line x1={L} y1={y} x2={R} y2={y} stroke="#f1f5f9" strokeWidth="0.4" />
                            <text x={L - 1} y={y + 0.9} textAnchor="end" fontSize="2.6" fill="#94a3b8">{value}</text>
                          </g>
                        ))}
                        <line x1={L} y1={T} x2={L} y2={B} stroke="#e2e8f0" strokeWidth="0.4" />
                        <line x1={L} y1={B} x2={R} y2={B} stroke="#e2e8f0" strokeWidth="0.4" />
                        <text transform={`rotate(-90) translate(-${(T + B) / 2}, ${L - 9})`} textAnchor="middle" fontSize="2.4" fill="#94a3b8">Acciones</text>
                        {yearLabels.map(({ yr, x }) => (
                          <text key={`xl-${yr}`} x={x} y={B + 4} textAnchor="middle" fontSize="2.6" fill="#94a3b8">{yr}</text>
                        ))}
                        {SERIES.map(({ field, stroke, width, dash }) => (
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
                        {SERIES.map(({ field, stroke }) => {
                          const last = enriched[enriched.length - 1];
                          return (
                            <circle
                              key={`dot-${field}`}
                              cx={xOf(enriched.length - 1)}
                              cy={yOf(last[field] ?? 0)}
                              r="1.3"
                              fill={stroke}
                            />
                          );
                        })}
                      </svg>
                    );
                  })()}
                </div>
              )}

              {/* Table */}
              <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm ${portfolio.transactions.length === 0 ? 'xl:col-span-2' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Table className="text-rose-500" size={18} />
                    Cartera de Valores (AEAT)
                  </h2>
                  {portfolio.transactions.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={14} className="text-slate-400" />
                      <select
                        value={activePortfolioYear}
                        onChange={(e) => setPortfolioYearFilter(e.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">Todos los años</option>
                        {portfolioYears.slice().reverse().map((yr) => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
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
                          .filter((tx) => activePortfolioYear === 'all' || (tx.aeat_fecha || tx.operation_date || '').startsWith(activePortfolioYear))
                          .map((tx) => {
                            const isSell = tx.aeat_tipo === 'TR' || tx.transaction_type === 'Trade';
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
                Evolucion Mensual: Bruto vs Neto vs Impuestos
              </h2>

              <div className="mt-2 mb-10">
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mb-3">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Bruto</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Impuestos</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Neto</span>
                </div>
                <svg viewBox="0 0 100 34" className="w-full h-64 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  {(() => {
                    const maxVal = Math.max(...history.map((x) => Math.max(x.bruto, x.neto, x.tax)), 1);
                    const ticks = [0, 0.25, 0.5, 0.75, 1];
                    const toPoints = (field) =>
                      history
                        .map((h, i) => {
                          const x = history.length === 1 ? 50 : (i / (history.length - 1)) * 96 + 2;
                          const y = 30 - (h[field] / maxVal) * 26;
                          return `${x},${y}`;
                        })
                        .join(' ');
                    return (
                      <>
                        {ticks.map((t) => {
                          const y = 30 - 26 * t;
                          const value = maxVal * t;
                          return (
                            <g key={`tick-${t}`}>
                              <line x1="2" x2="98" y1={y} y2={y} stroke="#cbd5e1" strokeWidth="0.25" />
                              <text x="0.5" y={y + 0.9} fontSize="1.8" fill="#64748b">
                                {Math.round(value)}
                              </text>
                            </g>
                          );
                        })}
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="0.8" points={toPoints('bruto')} />
                        <polyline fill="none" stroke="#f43f5e" strokeWidth="0.8" points={toPoints('tax')} />
                        <polyline fill="none" stroke="#10b981" strokeWidth="0.8" points={toPoints('neto')} />
                        {history.map((h, i) => {
                          const x = history.length === 1 ? 50 : (i / (history.length - 1)) * 96 + 2;
                          const yB = 30 - (h.bruto / maxVal) * 26;
                          const yT = 30 - (h.tax / maxVal) * 26;
                          const yN = 30 - (h.neto / maxVal) * 26;
                          return (
                            <g key={`pts-${i}`}>
                              <circle cx={x} cy={yB} r="0.7" fill="#3b82f6"><title>Bruto: {Math.round(h.bruto)}</title></circle>
                              <circle cx={x} cy={yT} r="0.7" fill="#f43f5e"><title>Impuestos: {Math.round(h.tax)}</title></circle>
                              <circle cx={x} cy={yN} r="0.7" fill="#10b981"><title>Neto: {Math.round(h.neto)}</title></circle>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div className="flex justify-between mt-2 text-[11px] text-slate-400 font-semibold">
                  {history.map((h, i) => (
                    <span key={`${h.month}-${i}`}>{h.month}</span>
                  ))}
                </div>
              </div>

              <div className="mt-10 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs">
                      <th className="pb-3 font-bold">Mes</th>
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
                          {h.month} {year}
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
  );
};

export default App;
