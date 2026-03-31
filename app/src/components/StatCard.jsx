import React from 'react';
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
  icon: Icon,
  color = 'blue',
  isPrivate,
  inverseTrend = false,
  helpText,
}) => {
  const iconColor = COLOR_VARIANTS[color] || COLOR_VARIANTS.blue;
  const isPositive = typeof trend === 'number' ? (trend > 0) !== inverseTrend : null;

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${iconColor}`}>
          {React.createElement(Icon, { size: 24 })}
        </div>
        {typeof trend === 'number' && (
          <span
            title={`Variacion: ${Math.abs(trend)}%`}
            className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
          >
            {trend > 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 flex items-center gap-1.5">
        <span>{title}</span>
        {helpText && (
          <span title={helpText} className="text-slate-400 hover:text-slate-600 cursor-help">
            <Info size={13} />
          </span>
        )}
      </h3>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-slate-800 dark:text-white" title={String(value)}>
          {isPrivate ? '••••••' : value}
        </span>
        {subValue && <span className="text-xs text-slate-400 mt-1" title={String(subValue)}>{subValue}</span>}
      </div>
    </div>
  );
};

export default StatCard;
