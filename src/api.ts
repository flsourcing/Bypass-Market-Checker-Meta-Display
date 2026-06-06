const API_BASE_URL = import.meta.env.VITE_META_CLOUD_API_URL ?? 'http://localhost:8080'
const TOKEN_STORAGE_KEY = 'bypass-market-session-token'

export type User = {
  id: string
  email: string
}

export type Session = {
  token: string
  expiresAt: string
}

export type ApiKeyRecord = {
  id: string
  provider: string
  label: string
  created_at: string
  updated_at: string
}

export type LookupResult = {
  sku: string | null
  brand: string | null
  model: string | null
  colorway: string | null
  confidence: number
  notes: string | null
}

export type ImageLookup = {
  id: string
  captureCode: string
  captureUrl: string
  provider: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  result: LookupResult | null
  error: string | null
  createdAt: string
  updatedAt: string
}

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = response.status === 204 ? null : await response.json()

  if (!response.ok) {
    throw new Error(data?.error ?? 'Request failed')
  }

  return data as T
}

export async function register(email: string, password: string) {
  return apiRequest<{ user: User; session: Session }>('/auth/register', {
    method: 'POST',
    body: { email, password },
  })
}

export async function login(email: string, password: string) {
  return apiRequest<{ user: User; session: Session }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export async function getMe(token: string) {
  return apiRequest<{ user: User }>('/auth/me', { token })
}

export async function getApiKeys(token: string) {
  return apiRequest<{ apiKeys: ApiKeyRecord[] }>('/api-keys', { token })
}

export async function saveApiKey(token: string, provider: string, apiKey: string) {
  return apiRequest<{ apiKey: ApiKeyRecord }>('/api-keys', {
    method: 'POST',
    token,
    body: { provider, apiKey },
  })
}

export async function revealApiKey(token: string, provider: string) {
  return apiRequest<{ provider: string; apiKey: string }>(
    `/api-keys/${encodeURIComponent(provider)}/reveal`,
    { token },
  )
}

export async function deleteApiKey(token: string, provider: string) {
  return apiRequest<void>(`/api-keys/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
    token,
  })
}

export async function createImageLookup(token: string) {
  return apiRequest<{ lookup: ImageLookup }>('/lookups', {
    method: 'POST',
    token,
    body: { provider: 'gemini' },
  })
}

export async function getImageLookup(token: string, lookupId: string) {
  return apiRequest<{ lookup: ImageLookup }>(`/lookups/${encodeURIComponent(lookupId)}`, {
    token,
  })
}
