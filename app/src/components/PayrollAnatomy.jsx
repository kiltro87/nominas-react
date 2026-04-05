const fmt = (v) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);

/**
 * Anatomía Visual de la Nómina — horizontal flow diagram.
 *
 * Shows how the monthly gross salary (Bruto) splits into IRPF, Social Security
 * and net pay (Neto) using a ribbon/flow visualization inspired by the mock.
 *
 * Data comes entirely from existing hook fields — no new query needed.
 *
 * @param {{ monthly: object, annual: object, history: Array, isPrivate: boolean }} props
 */
export default function PayrollAnatomy({ monthly, annual, history, isPrivate = false }) {
  const months = history?.length || 1;

  const bruto    = monthly.bruto  || 0;
  const neto     = monthly.neto   || 0;
  const irpfAmt  = (annual.totalImpuestos ?? 0) / months;
  const ssAmt    = (annual.totalSS ?? 0)        / months;
  const irpfPct  = annual.irpfAvgPct ?? 0;
  const ssPct    = annual.ssAvgPct   ?? 0;

  if (!bruto) {
    return <p className="text-sm text-slate-400 py-6 text-center">Sin datos de nómina.</p>;
  }

  // Heights (%) for SVG ribbon bands (sum may not be 100 due to deferred savings)
  const irpfH = Math.max((irpfAmt / bruto) * 100, 0);
  const ssH   = Math.max((ssAmt   / bruto) * 100, 0);
  const netoH = Math.max((neto    / bruto) * 100, 0);
  // The ribbon source (left) always starts at 0 and fills 100%
  // Right side: each band lands proportionally

  // Source ports (left edge — continuous 0→100)
  const irpfSrcY1 = 0;
  const irpfSrcY2 = irpfH;
  const ssSrcY1   = irpfH;
  const ssSrcY2   = irpfH + ssH;
  const netoSrcY1 = irpfH + ssH;
  const netoSrcY2 = 100;

  // Destination ports (right edge — same proportions, vertically stacked)
  const irpfDstY1 = 0;
  const irpfDstY2 = irpfH;
  const ssDstY1   = irpfH;
  const ssDstY2   = irpfH + ssH;
  const netoDstY1 = irpfH + ssH;
  const netoDstY2 = 100;

  // Bezier ribbon path
  const ribbon = (sy1, sy2, dy1, dy2) => {
    const cx = 50;
    return [
      `M0,${sy1}`,
      `C${cx},${sy1} ${cx},${dy1} 100,${dy1}`,
      `L100,${dy2}`,
      `C${cx},${dy2} ${cx},${sy2} 0,${sy2}`,
      'Z',
    ].join(' ');
  };

  return (
    <div className="flex items-stretch gap-4">
      {/* ── Left box: BRUTO ─────────────────────────────────────────── */}
      <div className="bg-slate-800 text-white rounded-2xl px-7 py-6 flex flex-col justify-center items-center min-w-48 shadow-md z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Bruto Devengado
        </p>
        <p className="text-3xl font-extrabold tabular-nums">
          {isPrivate ? '••••••' : fmt(bruto)}
        </p>
        <p className="text-xs text-slate-500 mt-1">mensual medio</p>
      </div>

      {/* ── Flow SVG ────────────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col justify-center" style={{ minHeight: 120 }}>
        {/* Ribbons */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          {/* IRPF ribbon */}
          <path d={ribbon(irpfSrcY1, irpfSrcY2, irpfDstY1, irpfDstY2)} fill="#fca5a5" opacity="0.55" />
          {/* SS ribbon */}
          <path d={ribbon(ssSrcY1, ssSrcY2, ssDstY1, ssDstY2)} fill="#fdba74" opacity="0.55" />
          {/* Neto ribbon */}
          <path d={ribbon(netoSrcY1, netoSrcY2, netoDstY1, netoDstY2)} fill="#6ee7b7" opacity="0.55" />
        </svg>

        {/* Floating labels */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-3 py-4">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
              IRPF ({irpfPct.toFixed(0)}%)
            </p>
            <p className="text-lg font-bold text-rose-600">
              {isPrivate ? '•••' : `- ${fmt(irpfAmt)}`}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
              Seg. Social ({ssPct.toFixed(1)}%)
            </p>
            <p className="text-lg font-bold text-orange-500">
              {isPrivate ? '•••' : `- ${fmt(ssAmt)}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Right box: NETO ─────────────────────────────────────────── */}
      <div className="bg-emerald-500 text-white rounded-2xl px-7 py-6 flex flex-col justify-center items-center min-w-48 shadow-md z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100 mb-2">
          Neto Transferido
        </p>
        <p className="text-3xl font-extrabold tabular-nums">
          {isPrivate ? '••••••' : fmt(neto)}
        </p>
        <p className="text-xs text-emerald-200 mt-1">
          {bruto > 0 ? `${((neto / bruto) * 100).toFixed(0)}% del bruto` : ''}
        </p>
      </div>
    </div>
  );
}
