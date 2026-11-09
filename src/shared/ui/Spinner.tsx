import { cn } from '@/shared/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}

export function FullPageSpinner({ label }: { label: string }) {
  return (
    <div role="status" className="text-muted flex h-full items-center justify-center gap-3">
      <Spinner className="text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
