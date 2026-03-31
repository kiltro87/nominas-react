const ProgressBar = ({ label, current, total, colorClass }) => {
  const percentage = Math.min((current / total) * 100, 100);
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-xs mb-1 font-medium">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-slate-900 dark:text-slate-200">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-1000`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
