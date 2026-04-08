const API_BASE = 'http://localhost:3000'

const TOKEN_KEY = 'accessToken'
const USER_KEY = 'user'

export type AuthUser = {
  id: number
  name: string
  surname: string
  userName: string
  email: string
}

export type AuthResponse = {
  accessToken: string
  user: AuthUser
}

export type SignupPayload = {
  name: string
  surname: string
  phoneNumber: string
  email: string
  birthDate: string
  password: string
}

function persistSession(data: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, data.accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error('LOGIN_FAILED')
  }
  const data = (await res.json()) as AuthResponse
  persistSession(data)
  return data
}

export async function signup(userData: SignupPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  })
  if (!res.ok) {
    const err = new Error('SIGNUP_FAILED') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const data = (await res.json()) as AuthResponse
  persistSession(data)
  return data
}
