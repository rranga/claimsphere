import { cn } from '@/shared/lib/cn';
import { initials } from '@/shared/lib/format';

export function Avatar({ name, color, className }: { name: string; color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        className,
      )}
      style={{ backgroundColor: color ?? '#5932EA' }}
    >
      {initials(name)}
    </span>
  );
}
