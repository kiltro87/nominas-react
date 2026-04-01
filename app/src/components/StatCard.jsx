import React, { useState } from 'react';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';

const COLOR_VARIANTS = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  slate: 'bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400',
  rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
};

const StatCard = ({
  title,
  value,
  subValue,
  trend,
  trendYear,
  icon: Icon,
  color = 'blue',
  isPrivate,
  inverseTrend = false,
  helpText,
}) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const iconColor = COLOR_VARIANTS[color] || COLOR_VARIANTS.blue;
  const isPositive = typeof trend === 'number' ? (trend > 0) !== inverseTrend : null;
  const trendLabel = trendYear ? `vs ${trendYear}` : 'vs año anterior';

  return (
    <div className="relative overflow-visible bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${iconColor}`}>
          {React.createElement(Icon, { size: 24 })}
        </div>
        {typeof trend === 'number' && (
          <div className="flex flex-col items-end gap-0.5">
            <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {trend > 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
              {Math.abs(trend)}%
            </span>
            <span className="text-[10px] text-slate-400">{trendLabel}</span>
          </div>
        )}
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 flex items-center gap-1.5">
        <span>{title}</span>
        {helpText && (
          <span
            className="relative inline-flex cursor-help"
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
          >
            <Info size={13} className={`transition-colors ${tooltipOpen ? 'text-slate-600' : 'text-slate-400'}`} />
            {tooltipOpen && (
              <span className="pointer-events-none absolute left-1/2 bottom-full mb-2 z-50 w-56 -translate-x-1/2 rounded-xl bg-slate-800 dark:bg-slate-700 px-3 py-2 text-xs font-normal text-white leading-relaxed shadow-xl">
                {helpText}
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
              </span>
            )}
          </span>
        )}
      </h3>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-slate-800 dark:text-white">
          {isPrivate ? '••••••' : value}
        </span>
        {subValue && <span className="text-xs text-slate-400 mt-1">{subValue}</span>}
      </div>
    </div>
  );
};

export default StatCard;
