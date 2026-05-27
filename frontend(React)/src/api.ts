const trimmedApiUrl = import.meta.env.VITE_API_URL?.trim() ?? ''

/**
 * - If `VITE_API_URL` is set (non-empty), requests go there.
 * - In dev, if unset, use same-origin + Vite proxy → avoids CORS and bad empty-string URLs.
 * - Production deployments should set `VITE_API_URL` unless the API is reverse-proxied on the same domain.
 */
export const API_BASE_URL = trimmedApiUrl

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

export async function getJson<TResponse>(
  endpoint: string,
  init?: RequestInit,
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...init,
    });
    const body = (await response.json()) as TResponse | { message?: string | string[] };

    if (!response.ok) {
      const message = Array.isArray((body as { message?: string | string[] }).message)
        ? (body as { message: string[] }).message.join(', ')
        : (body as { message?: string }).message || response.statusText || 'Request failed.';
      return { data: null, error: message };
    }

    return { data: body as TResponse, error: null };
  } catch {
    return { data: null, error: 'Could not connect to backend server.' };
  }
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

export async function getJsonAuth<TResponse>(
  endpoint: string,
  token: string,
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: authHeaders(token),
    })
    const body = (await response.json()) as TResponse | { message?: string | string[] }

    if (!response.ok) {
      const message = Array.isArray((body as { message?: string | string[] }).message)
        ? (body as { message: string[] }).message.join(', ')
        : (body as { message?: string }).message || response.statusText || 'Request failed.'
      return { data: null, error: message }
    }

    return { data: body as TResponse, error: null }
  } catch {
    return { data: null, error: 'Could not connect to backend server.' }
  }
}

export async function postJsonAuth<TResponse>(
  endpoint: string,
  token: string,
  payload: unknown,
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await response.json()) as TResponse | { message?: string | string[] }

    if (!response.ok) {
      const message = Array.isArray((body as { message?: string | string[] }).message)
        ? (body as { message: string[] }).message.join(', ')
        : (body as { message?: string }).message || response.statusText || 'Request failed.'
      return { data: null, error: message }
    }

    return { data: body as TResponse, error: null }
  } catch {
    return { data: null, error: 'Could not connect to backend server.' }
  }
}

export async function patchJsonAuth<TResponse>(
  endpoint: string,
  token: string,
  payload: unknown,
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await response.json()) as TResponse | { message?: string | string[] }

    if (!response.ok) {
      const message = Array.isArray((body as { message?: string | string[] }).message)
        ? (body as { message: string[] }).message.join(', ')
        : (body as { message?: string }).message || response.statusText || 'Request failed.'
      return { data: null, error: message }
    }

    return { data: body as TResponse, error: null }
  } catch {
    return { data: null, error: 'Could not connect to backend server.' }
  }
}

export async function deleteJsonAuth<TResponse>(
  endpoint: string,
  token: string,
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    const text = await response.text()
    let body: TResponse | { message?: string | string[] } = {} as TResponse
    if (text) {
      try {
        body = JSON.parse(text) as TResponse | { message?: string | string[] }
      } catch {
        body = {} as TResponse
      }
    }

    if (!response.ok) {
      const message = Array.isArray((body as { message?: string | string[] }).message)
        ? (body as { message: string[] }).message.join(', ')
        : (body as { message?: string }).message || response.statusText || 'Request failed.'
      return { data: null, error: message }
    }

    return { data: body as TResponse, error: null }
  } catch {
    return { data: null, error: 'Could not connect to backend server.' }
  }
}

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
