import { cn } from '@/shared/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'animate-shimmer block rounded bg-[linear-gradient(90deg,#f1f2f6_25%,#e6e8ef_50%,#f1f2f6_75%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}
