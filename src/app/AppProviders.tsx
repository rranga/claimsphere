import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth';
import { TooltipProvider } from '@/shared/ui/Tooltip';
import { createQueryClient } from './queryClient';
import { createStore } from './store';

export function AppProviders({ children }: { children: ReactNode }) {
  // Created once per app instance (not module singletons) → isolated, test-friendly.
  const [queryClient] = useState(createQueryClient);
  const [store] = useState(createStore);

  return (
    <QueryClientProvider client={queryClient}>
      <ReduxProvider store={store}>
        <AuthProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-center" richColors closeButton />
          </TooltipProvider>
        </AuthProvider>
      </ReduxProvider>
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="top-right" />}
    </QueryClientProvider>
  );
}
