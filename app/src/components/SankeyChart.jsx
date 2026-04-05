import { useState } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

/**
 * Draws a filled bezier band connecting two horizontal spans.
 * (x1,sy1)→(x1,sy2) on the left, (x2,dy1)→(x2,dy2) on the right.
 */
function band(x1, x2, sy1, sy2, dy1, dy2) {
  const mid = x1 + (x2 - x1) * 0.45;
  return [
    `M${x1},${sy1}`,
    `C${mid},${sy1} ${mid},${dy1} ${x2},${dy1}`,
    `L${x2},${dy2}`,
    `C${mid},${dy2} ${mid},${sy2} ${x1},${sy2}`,
    'Z',
  ].join(' ');
}

// ─── Layout ──────────────────────────────────────────────────────────────────
const W  = 720;
const H  = 440;
const PT = 40;   // top padding (room for bruto label)
const PB = 16;

const C1X = 32,  C1W = 20;   // BRUTO column
const C2X = 240, C2W = 20;   // Mid-level groups
const C3X = 510, C3W = 20;   // Detail nodes
const LBL = C3X + C3W + 10;  // label x (right of C3)
const AMT = W - 2;            // amount x (far right)

const GAP2      = 14;  // gap between C2 nodes
const GAP3_IN   =  5;  // gap between nodes within a C3 group
const GAP3_OUT  = 14;  // gap between the two C3 groups (= GAP2 visually)

const COMP_CLR = '#059669'; // emerald-600 — "Compensación" group
const RET_CLR  = '#dc2626'; // red-600     — "Retenciones"  group

const COMP_NODES = [
  { key: 'neto',    label: 'Sueldo Neto',    color: '#10b981', text: '#065f46' },
  { key: 'pension', label: 'Plan Pensiones', color: '#3b82f6', text: '#1e3a8a' },
  { key: 'esppRsu', label: 'ESPP / RSU',     color: '#8b5cf6', text: '#4c1d95' },
];

const RET_NODES = [
  { key: 'irpf', label: 'IRPF',         color: '#f43f5e', text: '#9f1239' },
  { key: 'ss',   label: 'Seg. Social',  color: '#f97316', text: '#7c2d12' },
  { key: 'flex', label: 'Flex / Otros', color: '#94a3b8', text: '#334155' },
];

// ─── Component ───────────────────────────────────────────────────────────────
/**
 * Three-column Sankey: BRUTO → (Compensación / Retenciones) → detail nodes.
 *
 * Data source: annual totals from payroll_metrics_mv divided by the number of
 * months in the selected period — i.e., monthly averages.
 *
 * @param {{ annual: object, history: Array, isPrivate: boolean }} props
 */
export default function SankeyChart({ annual, history, isPrivate = false }) {
  const [hovered, setHovered] = useState(null);

  const n = history?.length || 1;
  const mo = (v) => (v ?? 0) / n;

  const bruto   = mo(annual.bruto);
  const neto    = mo(annual.neto);
  const irpf    = mo(annual.totalImpuestos);
  const ss      = mo(annual.totalSS);
  const pension = mo((annual.pensionCompanyTotal ?? 0) + (annual.pensionEmployeeTotal ?? 0));
  const esppRsu = mo((annual.esppYtd ?? 0) + (annual.rsuYtd ?? 0));
  const flex    = Math.max(0, mo(annual.ahorroTotal ?? 0) - pension - esppRsu);

  if (!bruto) return <p className="text-sm text-slate-400 py-8 text-center">Sin datos disponibles.</p>;

  const vals = { neto, pension, esppRsu, irpf, ss, flex };

  // Visible nodes (filter out negligible values)
  const compNodes = COMP_NODES.filter((d) => (vals[d.key] ?? 0) > 1);
  const retNodes  = RET_NODES.filter((d) => (vals[d.key] ?? 0) > 1);

  const compTotal = compNodes.reduce((s, d) => s + vals[d.key], 0);
  const retTotal  = retNodes.reduce((s, d) => s + vals[d.key], 0);

  // Scale: px per € — account for gaps so the diagram fills the inner height
  const innerH = H - PT - PB;
  const totalGaps =
    GAP2 + GAP3_OUT +
    Math.max(0, compNodes.length - 1) * GAP3_IN +
    Math.max(0, retNodes.length - 1)  * GAP3_IN;
  const scale = Math.max(0, innerH - totalGaps) / bruto;

  const compH = compTotal * scale;
  const retH  = retTotal  * scale;

  // C2 node vertical positions
  const c2CompY = PT;
  const c2RetY  = PT + compH + GAP2;

  // C3 node positions within each group
  const buildC3 = (nodes, groupY) =>
    nodes.reduce((acc, d) => {
      const prev = acc[acc.length - 1];
      const y    = prev ? prev.y + prev.h + GAP3_IN : groupY;
      const h    = Math.max(vals[d.key] * scale, 3);
      return [...acc, { ...d, value: vals[d.key], y, h }];
    }, []);

  const c3Comp = buildC3(compNodes, c2CompY);
  const c3Ret  = buildC3(retNodes,  c2RetY);

  // C1 → C2 source ports (continuous on C1 right edge)
  const c1CompY1 = PT;
  const c1CompY2 = PT + compH;
  const c1RetY1  = PT + compH;
  const c1RetY2  = PT + compH + retH;

  // C2 → C3 source ports (continuous within each C2 node)
  const buildPorts = (nodes, startY) =>
    nodes.reduce((acc, node) => {
      const prevEnd = acc[acc.length - 1]?.y2 ?? startY;
      const portH   = Math.max(node.value * scale, 3);
      return [...acc, { node, y1: prevEnd, y2: prevEnd + portH }];
    }, []);

  const c2CompPorts = buildPorts(c3Comp, c2CompY);
  const c2RetPorts  = buildPorts(c3Ret,  c2RetY);

  // Hover helpers
  const on  = (key) => () => setHovered(key);
  const off = ()    => setHovered(null);
  const dim = (key) => hovered !== null && hovered !== key ? 0.06 : 0.18;
  const dimNode = (key) => hovered !== null && hovered !== key ? 0.4 : 1;

  // Rotated label inside a node (only if node is tall enough)
  const innerLabel = (cx, cy, h, text, fill = 'white') =>
    h > 28 ? (
      <text
        x={cx} y={cy + h / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fontWeight={700} fill={fill}
        transform={`rotate(-90,${cx},${cy + h / 2})`}
        style={{ pointerEvents: 'none' }}
      >
        {text}
      </text>
    ) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      aria-label="Sankey: distribución mensual de nómina"
    >
      {/* ── Flows C1 → C2 ──────────────────────────────────────────── */}
      <path
        d={band(C1X + C1W, C2X, c1CompY1, c1CompY2, c2CompY, c2CompY + compH)}
        fill={COMP_CLR} opacity={dim('comp')}
        style={{ transition: 'opacity .15s' }}
        onMouseEnter={on('comp')} onMouseLeave={off}
        className="cursor-pointer"
      />
      <path
        d={band(C1X + C1W, C2X, c1RetY1, c1RetY2, c2RetY, c2RetY + retH)}
        fill={RET_CLR} opacity={dim('ret')}
        style={{ transition: 'opacity .15s' }}
        onMouseEnter={on('ret')} onMouseLeave={off}
        className="cursor-pointer"
      />

      {/* ── Flows C2 → C3 ──────────────────────────────────────────── */}
      {c2CompPorts.map((p) => (
        <path
          key={`fc-${p.node.key}`}
          d={band(C2X + C2W, C3X, p.y1, p.y2, p.node.y, p.node.y + p.node.h)}
          fill={p.node.color} opacity={dim(p.node.key)}
          style={{ transition: 'opacity .15s' }}
          onMouseEnter={on(p.node.key)} onMouseLeave={off}
          className="cursor-pointer"
        />
      ))}
      {c2RetPorts.map((p) => (
        <path
          key={`fr-${p.node.key}`}
          d={band(C2X + C2W, C3X, p.y1, p.y2, p.node.y, p.node.y + p.node.h)}
          fill={p.node.color} opacity={dim(p.node.key)}
          style={{ transition: 'opacity .15s' }}
          onMouseEnter={on(p.node.key)} onMouseLeave={off}
          className="cursor-pointer"
        />
      ))}

      {/* ── Node C1: BRUTO ─────────────────────────────────────────── */}
      <rect x={C1X} y={PT} width={C1W} height={compH + retH} fill="#64748b" rx={4} />
      {innerLabel(C1X + C1W / 2, PT, compH + retH, 'BRUTO')}
      {/* Bruto header */}
      <text x={C1X + C1W / 2} y={PT - 18} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1e293b">
        {isPrivate ? '•••••' : fmt(bruto)}
      </text>
      <text x={C1X + C1W / 2} y={PT - 6} textAnchor="middle" fontSize={8} fill="#94a3b8">
        media mensual
      </text>

      {/* ── Nodes C2 ───────────────────────────────────────────────── */}

      {/* Compensación */}
      <g onMouseEnter={on('comp')} onMouseLeave={off} className="cursor-pointer">
        <rect x={C2X} y={c2CompY} width={C2W} height={compH} fill={COMP_CLR} rx={4}
          opacity={dimNode('comp')} style={{ transition: 'opacity .15s' }} />
        {innerLabel(C2X + C2W / 2, c2CompY, compH, 'Cobros', 'white')}
        {/* Left label (above node) */}
        <text x={C2X + C2W / 2} y={c2CompY - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill={COMP_CLR}>
          Compensación
        </text>
        {!isPrivate && (
          <text x={C2X + C2W / 2} y={c2CompY - 17} textAnchor="middle" fontSize={7.5} fill="#64748b">
            {fmt(compTotal)}
          </text>
        )}
      </g>

      {/* Retenciones */}
      <g onMouseEnter={on('ret')} onMouseLeave={off} className="cursor-pointer">
        <rect x={C2X} y={c2RetY} width={C2W} height={retH} fill={RET_CLR} rx={4}
          opacity={dimNode('ret')} style={{ transition: 'opacity .15s' }} />
        {innerLabel(C2X + C2W / 2, c2RetY, retH, 'Retenciones', 'white')}
        <text x={C2X + C2W / 2} y={c2RetY - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill={RET_CLR}>
          Retenciones
        </text>
        {!isPrivate && (
          <text x={C2X + C2W / 2} y={c2RetY - 17} textAnchor="middle" fontSize={7.5} fill="#64748b">
            {fmt(retTotal)}
          </text>
        )}
      </g>

      {/* ── Nodes C3 ───────────────────────────────────────────────── */}
      {[...c3Comp, ...c3Ret].map((node) => {
        const isHov   = hovered === null || hovered === node.key;
        const showPct = node.h > 16;
        const showAmt = node.h > 10;
        const midY    = node.y + node.h / 2;

        return (
          <g key={node.key} onMouseEnter={on(node.key)} onMouseLeave={off} className="cursor-pointer">
            <rect
              x={C3X} y={node.y} width={C3W} height={node.h}
              fill={node.color} rx={4}
              opacity={isHov ? 1 : 0.4}
              style={{ transition: 'opacity .15s' }}
            />
            {/* % inside node */}
            {showPct && (
              <text x={C3X + C3W / 2} y={midY} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fontWeight={700} fill="white" style={{ pointerEvents: 'none' }}>
                {((node.value / bruto) * 100).toFixed(0)}%
              </text>
            )}
            {/* Label */}
            <text x={LBL} y={midY} dominantBaseline="middle"
              fontSize={9} fontWeight={isHov ? 700 : 500} fill={node.text}
              style={{ pointerEvents: 'none' }}>
              {node.label}
            </text>
            {/* Amount */}
            {showAmt && !isPrivate && (
              <text x={AMT} y={midY} dominantBaseline="middle" textAnchor="end"
                fontSize={8.5} fill="#64748b" style={{ pointerEvents: 'none' }}>
                {fmt(node.value)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
