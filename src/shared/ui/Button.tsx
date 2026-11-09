import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/shared/lib/cn';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:bg-canvas',
  ghost: 'text-ink hover:bg-brand-50',
  danger: 'bg-danger-500 text-white hover:bg-red-700',
  'danger-ghost': 'text-danger-500 hover:bg-danger-50',
} as const;

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'size-8 justify-center',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Prefer `aria-disabled` over `disabled`: the button stays focusable, so keyboard and
 * screen-reader users can still discover *why* an action is unavailable (via its tooltip).
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const ariaDisabled = props['aria-disabled'];
  const inactive = ariaDisabled === true || ariaDisabled === 'true' || Boolean(props.disabled) || loading;
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg font-medium whitespace-nowrap transition-colors select-none',
        VARIANTS[variant],
        SIZES[size],
        inactive && 'cursor-not-allowed opacity-50',
        className,
      )}
      aria-busy={loading || undefined}
      onClick={inactive ? (event) => event.preventDefault() : onClick}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
