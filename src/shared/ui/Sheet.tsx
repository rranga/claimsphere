import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: 'left' | 'right';
  children: ReactNode;
}

/**
 * Slide-in side panel for small screens (built on the accessible Radix dialog: focus trap,
 * Esc to close, labelled by its title). Hosts panels that are columns on larger screens.
 */
export function Sheet({ open, onOpenChange, title, side = 'right', children }: SheetProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-ink/30 animate-fade-in fixed inset-0 z-40" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            'animate-fade-in fixed inset-y-0 z-50 flex w-[min(90vw,340px)] flex-col bg-white shadow-2xl',
            side === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="border-line flex items-center justify-between border-b px-4 py-3">
            <RadixDialog.Title className="text-sm font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close
              className="text-muted hover:bg-canvas hover:text-ink rounded-md p-1"
              aria-label={`Close ${title.toLowerCase()}`}
            >
              <X className="size-4" />
            </RadixDialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
