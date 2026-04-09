export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

export async function postJson<TResponse>(
  endpoint: string,
  payload: unknown,
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as TResponse | { message?: string | string[] };

    if (!response.ok) {
      const message = Array.isArray((body as { message?: string | string[] }).message)
        ? (body as { message: string[] }).message.join(', ')
        : (body as { message?: string }).message || 'Request failed.';
      return { data: null, error: message };
    }

    return { data: body as TResponse, error: null };
  } catch {
    return { data: null, error: 'Could not connect to backend server.' };
  }
}
