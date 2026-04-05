import { useState } from 'react';

const fmt = (v) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const fmtPct = (v, total) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '');

// ─── Config ──────────────────────────────────────────────────────────────────
const W = 540;
const H = 300;
const PT = 20, PB = 20;   // vertical padding
const SX = 44, SW = 18;   // source node (x, width)
const DX = 390, DW = 18;  // dest nodes (x, width)
const GAP = 5;             // gap between dest nodes
const CURVE_CTRL = 0.52;   // bezier control point ratio (0–1 → left to right)

const SEGMENTS = [
  { key: 'neto',     label: 'Sueldo Neto',    color: '#10b981', text: '#065f46', darkText: '#34d399' },
  { key: 'irpf',     label: 'IRPF',           color: '#f43f5e', text: '#9f1239', darkText: '#fb7185' },
  { key: 'ss',       label: 'Seg. Social',    color: '#f97316', text: '#9a3412', darkText: '#fdba74' },
  { key: 'pension',  label: 'Plan Pensiones', color: '#3b82f6', text: '#1e3a8a', darkText: '#93c5fd' },
  { key: 'esppRsu',  label: 'ESPP / RSU',     color: '#8b5cf6', text: '#4c1d95', darkText: '#c4b5fd' },
  { key: 'flex',     label: 'Flex / Otros',   color: '#94a3b8', text: '#334155', darkText: '#cbd5e1' },
];

/**
 * Sankey diagram showing how monthly gross salary distributes into
 * net pay, taxes, pension and deferred savings.
 *
 * @param {{ annual: object, history: Array, isPrivate: boolean }} props
 */
export default function SankeyChart({ annual, history, isPrivate = false }) {
  const [hovered, setHovered] = useState(null);

  const numMonths = history?.length || 1;
  const toMonth = (v) => (v ?? 0) / numMonths;

  const bruto     = toMonth(annual.bruto);
  const neto      = toMonth(annual.neto);
  const irpf      = toMonth(annual.totalImpuestos);
  const ss        = toMonth(annual.totalSS);
  const pension   = toMonth((annual.pensionCompanyTotal ?? 0) + (annual.pensionEmployeeTotal ?? 0));
  const esppRsu   = toMonth((annual.esppYtd ?? 0) + (annual.rsuYtd ?? 0));
  const flex      = Math.max(0, toMonth(annual.ahorroTotal ?? 0) - pension - esppRsu);

  const values = { neto, irpf, ss, pension, esppRsu, flex };

  const segments = SEGMENTS
    .map((s) => ({ ...s, value: values[s.key] ?? 0 }))
    .filter((s) => s.value > 0.5);

  if (!bruto || segments.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-6 text-center">Sin datos para el diagrama.</p>
    );
  }

  const innerH   = H - PT - PB;
  const totalGap = GAP * (segments.length - 1);
  const scale    = (innerH - totalGap) / bruto;

  // ── Destination nodes (with gaps) ──
  const destNodes = segments.reduce((acc, s) => {
    const prev = acc[acc.length - 1];
    const y = prev ? prev.y + prev.h + GAP : PT;
    const h = Math.max(s.value * scale, 3);
    return [...acc, { ...s, y, h }];
  }, []);

  // ── Source ports (continuous, no gaps) ──
  const srcPorts = segments.reduce((acc, s) => {
    const prev = acc[acc.length - 1];
    const y = prev ? prev.y + prev.h : PT;
    const h = Math.max(s.value * scale, 3);
    return [...acc, { y, h }];
  }, []);
  const lastPort = srcPorts[srcPorts.length - 1];
  const sourceH = lastPort ? lastPort.y + lastPort.h - PT : 0;

  // ── Bezier path ──
  const cx1 = SX + SW + (DX - SX - SW) * CURVE_CTRL;
  const cx2 = SX + SW + (DX - SX - SW) * (1 - CURVE_CTRL);

  const mkPath = (sp, dn) => {
    const [sy1, sy2, dy1, dy2] = [sp.y, sp.y + sp.h, dn.y, dn.y + dn.h];
    return [
      `M${SX + SW},${sy1}`,
      `C${cx1},${sy1} ${cx2},${dy1} ${DX},${dy1}`,
      `L${DX},${dy2}`,
      `C${cx2},${dy2} ${cx1},${sy2} ${SX + SW},${sy2}`,
      'Z',
    ].join(' ');
  };

  const labelX = DX + DW + 7;
  const amtX   = W - 4;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full select-none"
      style={{ height: H }}
      aria-label="Diagrama Sankey de nómina mensual"
    >
      {/* ── Gradient flows ── */}
      {destNodes.map((dn, i) => (
        <path
          key={`flow-${i}`}
          d={mkPath(srcPorts[i], dn)}
          fill={dn.color}
          opacity={hovered === null || hovered === i ? 0.18 : 0.06}
          style={{ transition: 'opacity 0.15s' }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="cursor-pointer"
        />
      ))}

      {/* ── Source node (Bruto) ── */}
      <rect x={SX} y={PT} width={SW} height={sourceH} fill="#64748b" rx={4} />
      <text
        x={SX + SW / 2}
        y={PT + sourceH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={8}
        fontWeight={700}
        fill="white"
        transform={`rotate(-90,${SX + SW / 2},${PT + sourceH / 2})`}
        style={{ pointerEvents: 'none' }}
      >
        BRUTO
      </text>
      {/* Bruto label above */}
      <text x={SX + SW / 2} y={PT - 6} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#475569">
        {isPrivate ? '•••••' : fmt(bruto)}
      </text>
      <text x={SX + SW / 2} y={PT - 16} textAnchor="middle" fontSize={7.5} fill="#94a3b8">
        mensual medio
      </text>

      {/* ── Destination nodes ── */}
      {destNodes.map((dn, i) => {
        const isHov = hovered === i;
        const showPct = dn.h > 14;
        const showAmt = dn.h > 10;
        return (
          <g
            key={`dest-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer"
          >
            <rect
              x={DX}
              y={dn.y}
              width={DW}
              height={dn.h}
              fill={dn.color}
              rx={4}
              opacity={hovered === null || isHov ? 1 : 0.45}
              style={{ transition: 'opacity 0.15s' }}
            />

            {/* % inside node if tall enough */}
            {showPct && (
              <text
                x={DX + DW / 2}
                y={dn.y + dn.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7.5}
                fontWeight={700}
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {fmtPct(dn.value, bruto)}
              </text>
            )}

            {/* Label right of node */}
            <text
              x={labelX}
              y={dn.y + dn.h / 2}
              dominantBaseline="middle"
              fontSize={9}
              fontWeight={isHov ? 700 : 600}
              fill={dn.text}
              style={{ transition: 'font-weight 0.1s', pointerEvents: 'none' }}
            >
              {dn.label}
            </text>

            {/* Amount far right */}
            {showAmt && !isPrivate && (
              <text
                x={amtX}
                y={dn.y + dn.h / 2}
                dominantBaseline="middle"
                textAnchor="end"
                fontSize={8.5}
                fill="#64748b"
                style={{ pointerEvents: 'none' }}
              >
                {fmt(dn.value)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
