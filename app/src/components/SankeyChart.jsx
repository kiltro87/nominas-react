import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const NODE_COLORS = {
  'BRUTO':          '#3b82f6',
  'Compensación':   '#059669',
  'Retenciones':    '#dc2626',
  'Sueldo Neto':    '#10b981',
  'Pensiones':      '#3b82f6',
  'ESPP / RSU':     '#8b5cf6',
  'IRPF':           '#f43f5e',
  'Seg. Social':    '#f97316',
  'Flex / Otros':   '#94a3b8',
};

const MID_NODES = new Set(['BRUTO', 'Compensación', 'Retenciones']);

// ─── Custom renderers ─────────────────────────────────────────────────────────
// Both components are defined outside SankeyChart to avoid recreating them on
// every render, but they receive bruto and isPrivate via props injected below.

function CustomNode({ x, y, width, height, payload, bruto, isPrivate }) {
  if (!payload?.name || height <= 0) return null;
  const color     = NODE_COLORS[payload.name] ?? '#64748b';
  const isDetail  = !MID_NODES.has(payload.name);
  const midY      = y + height / 2;
  const labelX    = isDetail ? x + width + 8 : x + width / 2;
  const anchor    = isDetail ? 'start' : 'middle';
  const pct       = bruto ? `${((payload.value ?? 0) / bruto * 100).toFixed(0)}%` : '';
  const twoLines  = isDetail && height > 22 && !isPrivate;

  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={color} fillOpacity={0.9} rx={3} />
      <text
        x={labelX}
        y={twoLines ? midY - 7 : midY}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={600}
        fill={'#1e293b'}
        style={{ pointerEvents: 'none' }}
      >
        {payload.name}
      </text>
      {twoLines && (
        <text
          x={labelX}
          y={midY + 7}
          textAnchor={anchor}
          dominantBaseline="middle"
          fontSize={9.5}
          fill="#64748b"
          style={{ pointerEvents: 'none' }}
        >
          {fmt(payload.value ?? 0)} · {pct}
        </text>
      )}
    </g>
  );
}

// recharts passes sourceY/targetY as the CENTER of the band (not top edge),
// and uses a stroked bezier path (not a filled polygon). sourceControlX /
// targetControlX are the bezier control points computed internally by recharts.
function CustomLink(props) {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload } = props;
  
  if ([sourceX, sourceY, targetX, targetY].some(isNaN)) return null;

  const validWidth = isNaN(Number(linkWidth)) || Number(linkWidth) <= 0 ? 1.5 : Math.max(Number(linkWidth), 1.5);

  const colorSource = NODE_COLORS[payload?.source?.name] ?? '#cbd5e1';
  const colorTarget = NODE_COLORS[payload?.target?.name] ?? '#94a3b8';
  const gradId = `linkGrad-${payload?.source?.name?.replace(/[^a-zA-Z0-9]/g, '')}-${payload?.target?.name?.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colorSource} />
          <stop offset="100%" stopColor={colorTarget} />
        </linearGradient>
      </defs>
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        strokeWidth={validWidth}
        stroke={`url(#${gradId})`}
        strokeOpacity={0.65}
        fill="none"
      />
    </g>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
/**
 * Three-column Sankey built with recharts:
 *   BRUTO → (Compensación / Retenciones) → detail nodes.
 *
 * Accepts two data modes:
 *  - `monthData` prop: pre-computed values from a single month's concepts
 *    (used by Mi Nómina tab via computeSankeyFromConcepts).
 *  - `annual + history` props: annual totals divided by the number of months
 *    (used by Visión General tab for monthly averages).
 *
 * @param {{ annual?: object, history?: Array, monthData?: object, isPrivate?: boolean }} props
 */
export default function SankeyChart({ annual, history, monthData, isPrivate = false }) {
  const n = history?.length || 1;
  const mo = (v) => (v ?? 0) / n;

  const bruto   = monthData ? monthData.bruto   : mo(annual?.bruto);
  const neto    = monthData ? monthData.neto    : mo(annual?.neto);
  const irpf    = monthData ? monthData.irpf    : mo(annual?.totalImpuestos);
  const ss      = monthData ? monthData.ss      : mo(annual?.totalSS);
  const pension = monthData ? monthData.pension : mo((annual?.pensionCompanyTotal ?? 0) + (annual?.pensionEmployeeTotal ?? 0));
  const esppRsu = monthData ? monthData.esppRsu : mo((annual?.esppYtd ?? 0) + (annual?.rsuYtd ?? 0));
  const flex    = monthData ? monthData.flex    : mo(annual?.deferredAmount ?? 0);

  if (!bruto) return <p className="text-sm text-slate-400 py-8 text-center">Sin datos disponibles.</p>;

  // Filter out nodes with negligible values
  const compGroup = [
    { name: 'Sueldo Neto', value: neto    },
    { name: 'Pensiones',   value: pension  },
    { name: 'ESPP / RSU',  value: esppRsu  },
  ].filter((d) => d.value > 1);

  const retGroup = [
    { name: 'IRPF',        value: irpf  },
    { name: 'Seg. Social', value: ss    },
    { name: 'Flex / Otros',value: flex  },
  ].filter((d) => d.value > 1);

  const compTotal = compGroup.reduce((s, d) => s + d.value, 0);
  const retTotal  = retGroup.reduce((s, d) => s + d.value, 0);

  // Build recharts nodes + links
  const nodes = [
    { name: 'BRUTO' },
    ...(compTotal > 1 ? [{ name: 'Compensación' }] : []),
    ...(retTotal  > 1 ? [{ name: 'Retenciones' }]  : []),
    ...compGroup.map((d) => ({ name: d.name })),
    ...retGroup.map((d) => ({ name: d.name })),
  ];

  const idx = Object.fromEntries(nodes.map((node, i) => [node.name, i]));

  const links = [
    ...(compTotal > 1 ? [{ source: idx['BRUTO'], target: idx['Compensación'], value: compTotal }] : []),
    ...(retTotal  > 1 ? [{ source: idx['BRUTO'], target: idx['Retenciones'],  value: retTotal }]  : []),
    ...compGroup.map((d) => ({ source: idx['Compensación'], target: idx[d.name], value: d.value })),
    ...retGroup.map((d)  => ({ source: idx['Retenciones'],  target: idx[d.name], value: d.value })),
  ].filter((l) => l.value > 0 && l.source !== undefined && l.target !== undefined);

  return (
    <div className="w-full h-full min-h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={{ nodes, links }}
          nodeWidth={16}
          nodePadding={4}
          sort={false}
          margin={{ top: 20, right: 200, bottom: 10, left: 10 }}
          node={(props) => <CustomNode {...props} bruto={bruto} isPrivate={isPrivate} />}
          link={(props) => <CustomLink {...props} />}
        >
          <Tooltip
            formatter={(value, name) => [isPrivate ? '•••' : fmt(value), name]}
            contentStyle={{
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
