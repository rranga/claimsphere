import { cn } from '@/shared/lib/cn';

interface ProgressBarProps {
  value: number;
  label: string;
  tone?: 'brand' | 'danger';
}

export function ProgressBar({ value, label, tone = 'brand' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className="bg-brand-50 h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300',
          tone === 'brand' ? 'bg-brand-600' : 'bg-danger-500',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
