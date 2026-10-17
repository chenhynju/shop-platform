import type { ApiError } from '@repo/types';
export class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public requestId?: string
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
        'X-CSRF-Protection': '1',
        ...options.headers
      }
    });
  } catch {
    throw new RequestError('Unable to reach the server. Please try again.', 'NETWORK_ERROR');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new RequestError(
      body?.error?.message ?? 'The request failed.',
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.requestId
    );
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
