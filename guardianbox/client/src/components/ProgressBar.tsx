/** Thin progress bar with a text label, shown while a large file is being processed. */
export default function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between text-sm text-steel">
        <span>{label}</span>
        <span className="tabular-nums text-paper">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-raised"
      >
        <div className="h-full rounded-full bg-safe transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
