import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

const BADGE_TONES = {
  success: 'bg-success-50 text-success-700 border-success-500/60',
  danger: 'bg-danger-50 text-danger-500 border-danger-500/50',
  warning: 'bg-warning-50 text-warning-600 border-warning-600/40',
  info: 'bg-info-50 text-info-600 border-info-600/40',
  brand: 'bg-brand-50 text-brand-700 border-brand-500/40',
  neutral: 'bg-gray-100 text-gray-600 border-gray-300',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded border px-2 text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
