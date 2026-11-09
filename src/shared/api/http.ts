import type { ApiErrorBody } from './contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorBody['code'] | 'NETWORK',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 4xx errors are deterministic — retrying them only wastes time and server capacity. */
  get isRetryable() {
    return this.code === 'NETWORK' || this.status >= 500;
  }
}

interface HttpConfig {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let config: HttpConfig = { getToken: () => null, onUnauthorized: () => undefined };

/** Wired once by the auth feature so the HTTP layer stays feature-agnostic. */
export const configureHttp = (next: HttpConfig) => {
  config = next;
};

const apiUrl = (path: string) =>
  new URL(`${import.meta.env.BASE_URL}api${path}`, window.location.origin).toString();

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function http<T>(
  path: string,
  { method = 'GET', body, signal, headers = {} }: RequestOptions = {},
): Promise<T> {
  const token = config.getToken();
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'Network error — check your connection and try again.');
  }

  if (response.status === 401) config.onUnauthorized();
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, payload?.code ?? 'INTERNAL', payload?.message ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';
