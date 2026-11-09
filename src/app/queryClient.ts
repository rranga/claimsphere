import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/shared/api/http';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry transient failures (network / 5xx) with exponential backoff; never retry 4xx.
        retry: (failureCount, error) => failureCount < 2 && (!isApiError(error) || error.isRetryable),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
