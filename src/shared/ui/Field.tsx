import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

const control =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none';

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(control, error && 'border-danger-500')}
        {...props}
      />
      {hint && !error && <p className="text-muted mt-1 text-xs">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-danger-500 mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps extends FieldProps, SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly { value: string; label: string }[];
}

export function SelectField({ label, options, className, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select id={id} className={control} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
