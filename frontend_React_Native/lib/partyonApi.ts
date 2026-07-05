import { API_BASE } from '@/lib/apiBase'

export type ApiResult<T> = { data: T | null; error: string | null }

export async function postJson<TResponse>(
  path: string,
  body: unknown,
): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const resBody = (await response.json()) as TResponse | { message?: string | string[] }
    if (!response.ok) {
      const message = Array.isArray((resBody as { message?: string[] }).message)
        ? (resBody as { message: string[] }).message.join(', ')
        : (resBody as { message?: string }).message || response.statusText || 'Request failed.'
      return { data: null, error: message }
    }
    return { data: resBody as TResponse, error: null }
  } catch {
    return { data: null, error: 'Could not reach the PartyOn server.' }
  }
}

export async function getJson<TResponse>(path: string): Promise<ApiResult<TResponse>> {
  try {
    const response = await fetch(`${API_BASE}${path}`)
    const resBody = (await response.json()) as TResponse | { message?: string | string[] }
    if (!response.ok) {
      const message = Array.isArray((resBody as { message?: string[] }).message)
        ? (resBody as { message: string[] }).message.join(', ')
        : (resBody as { message?: string }).message || response.statusText || 'Request failed.'
      return { data: null, error: message }
    }
    return { data: resBody as TResponse, error: null }
  } catch {
    return { data: null, error: 'Could not reach the PartyOn server.' }
  }
}
