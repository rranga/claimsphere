import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
}

/** Accessible modal (focus trap, Esc to close, labelled by its title) built on Radix primitives. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="animate-fade-in bg-ink/30 fixed inset-0 z-40 backdrop-blur-[2px]" />
        <RadixDialog.Content
          className={cn(
            'animate-fade-in fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl',
            size === 'sm' ? 'max-w-md' : 'max-w-lg',
          )}
          {...(!description && { 'aria-describedby': undefined })}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-muted mt-1 text-sm">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              className="text-muted hover:bg-canvas hover:text-ink rounded-md p-1"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </RadixDialog.Close>
          </div>
          {children}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
