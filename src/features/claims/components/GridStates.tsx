import { SearchX } from 'lucide-react';
import { errorMessage } from '@/shared/api/http';
import { Button } from '@/shared/ui/Button';
import { ErrorFallback } from '@/shared/ui/ErrorBoundary';

export function GridEmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <SearchX className="text-subtle size-10" aria-hidden="true" />
      <div>
        <p className="font-medium">No claims match your filters</p>
        <p className="text-muted mt-1 text-sm">Try a different search term or clear the filters.</p>
      </div>
      <Button size="sm" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  );
}

export function GridErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex-1">
      <ErrorFallback region="Claims" error={new Error(errorMessage(error))} onRetry={onRetry} />
    </div>
  );
}
