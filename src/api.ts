const API_BASE_URL = import.meta.env.VITE_META_CLOUD_API_URL ?? 'http://localhost:8080'
const TOKEN_STORAGE_KEY = 'bypass-market-session-token'

export function getApiBaseUrl() {
  return API_BASE_URL
}

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
  upc: string | null
  brand: string | null
  model: string | null
  colorway: string | null
  confidence: number
  notes: string | null
}

export type MarketSizeQuote = {
  size: number
  stockx: {
    lowestAsk: number | null
    highestBid: number | null
  } | null
  alias: {
    lowestAsk: number | null
    highestBid: number | null
  } | null
}

export type LookupMarketData = {
  status: 'complete' | 'partial' | 'error'
  query: string
  alias: {
    product: {
      name: string
      brand: string
      sku: string
      colorway: string | null
      mainPictureUrl: string | null
      retailPriceCents: number | null
    }
    sizes: Array<{
      size: number
      lowestAsk: number | null
      highestBid: number | null
    }>
  } | null
  stockx: {
    product: {
      productId: string
      title: string
      brand: string
      styleId: string | null
      colorway: string | null
      urlKey: string | null
    }
    sizes: Array<{
      size: number
      lowestAsk: number | null
      highestBid: number | null
    }>
  } | null
  combined: MarketSizeQuote[]
  errors: {
    alias?: string
    stockx?: string
  }
}

export type IntegrationStatus = {
  provider: 'alias' | 'stockx'
  configured: boolean
  email: string | null
  oauthConnected?: boolean
  redirectUri?: string
}

export type LookupDictation = {
  lookupId: string
  status: 'requested' | 'listening' | 'complete' | 'error' | 'cancelled' | null
  transcript: string | null
  error: string | null
  updatedAt: string | null
}

export type ImageLookup = {
  id: string
  captureCode: string
  captureUrl: string
  provider: string
  lookupType: 'image' | 'barcode' | 'text'
  captureMode: 'stream_pair' | 'capture' | 'mobile' | 'text'
  status: 'pending' | 'processing' | 'complete' | 'error'
  result: LookupResult | null
  error: string | null
  imageUrl: string | null
  imagePreview: string | null
  catalogImageUrl?: string | null
  textLookupSource?: string | null
  marketStatus: 'loading' | 'complete' | 'partial' | 'error' | null
  marketData: LookupMarketData | null
  feedback: {
    status: 'correct' | 'incorrect'
    correction: string | null
    createdAt: string | null
    updatedAt: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export type CatalogSearchItem = {
  id: string
  source: 'stockx' | 'alias'
  name: string
  sku: string
  brand: string
  imageUrl: string | null
}

export type DevicePairing = {
  id: string
  code: string
  deviceName: string
  status: 'pending' | 'approved' | 'expired'
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export type PairedDevice = {
  id: string
  name: string
  deviceType: string
  lastSeenAt: string | null
  createdAt: string
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

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error ?? 'Upload failed')
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

export async function createImageLookup(
  token: string,
  mode: 'stream_pair' | 'capture' = 'capture',
) {
  return apiRequest<{ lookup: ImageLookup }>('/lookups', {
    method: 'POST',
    token,
    body: { provider: 'gemini', mode, type: 'image' },
  })
}

export async function createBarcodeLookup(
  token: string,
  mode: 'stream_pair' | 'capture' = 'capture',
) {
  return apiRequest<{ lookup: ImageLookup }>('/lookups', {
    method: 'POST',
    token,
    body: { provider: 'local', mode, type: 'barcode' },
  })
}

export async function armLookupCapture(token: string, lookupId: string) {
  return apiRequest<{ lookup: ImageLookup }>(`/lookups/${encodeURIComponent(lookupId)}/arm-capture`, {
    method: 'POST',
    token,
  })
}

export async function getImageLookup(token: string, lookupId: string) {
  return apiRequest<{ lookup: ImageLookup }>(`/lookups/${encodeURIComponent(lookupId)}`, {
    token,
  })
}

export async function submitLookupFeedback(
  token: string,
  lookupId: string,
  status: 'correct' | 'incorrect',
  note?: string,
) {
  return apiRequest<{ lookup: ImageLookup }>(`/lookups/${encodeURIComponent(lookupId)}/feedback`, {
    method: 'POST',
    token,
    body: { status, note, correction: note },
  })
}

export async function requestLookupDictation(token: string, lookupId: string) {
  return apiRequest<{ dictation: LookupDictation }>(
    `/lookups/${encodeURIComponent(lookupId)}/dictation/request`,
    {
      method: 'POST',
      token,
    },
  )
}

export async function getLookupDictation(token: string, lookupId: string) {
  return apiRequest<{ dictation: LookupDictation }>(
    `/lookups/${encodeURIComponent(lookupId)}/dictation`,
    { token },
  )
}

export async function cancelLookupDictation(token: string, lookupId: string) {
  return apiRequest<{ dictation: LookupDictation } | null>(
    `/lookups/${encodeURIComponent(lookupId)}/dictation/cancel`,
    {
      method: 'POST',
      token,
    },
  )
}

export async function searchCatalog(token: string, query: string, limit = 10) {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
  })

  return apiRequest<{ items: CatalogSearchItem[] }>(`/lookups/catalog/search?${params.toString()}`, {
    token,
  })
}

export async function createTextLookup(
  token: string,
  item: Pick<CatalogSearchItem, 'sku' | 'name' | 'brand' | 'imageUrl' | 'source'>,
) {
  return apiRequest<{ lookup: ImageLookup }>('/lookups/text', {
    method: 'POST',
    token,
    body: item,
  })
}

export async function fetchLookupImageBlob(token: string, lookupId: string) {
  const response = await fetch(`${API_BASE_URL}/lookups/${encodeURIComponent(lookupId)}/image`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Could not load lookup image')
  }

  return response.blob()
}

export async function uploadLookupImage(captureCode: string, image: Blob) {
  const formData = new FormData()
  formData.set('image', image, 'glasses-capture.jpg')

  return uploadRequest<{ lookup: ImageLookup }>(
    `/lookups/capture/${encodeURIComponent(captureCode)}/image`,
    formData,
  )
}

export async function createDevicePairing(deviceName = 'Meta Display') {
  return apiRequest<{ pairing: DevicePairing }>('/device-pairings', {
    method: 'POST',
    body: { deviceName },
  })
}

export async function getDevicePairing(pairingId: string) {
  return apiRequest<{ pairing: DevicePairing; user?: User; session?: Session }>(
    `/device-pairings/sessions/${encodeURIComponent(pairingId)}`,
  )
}

export async function approveDevicePairing(token: string, code: string) {
  return apiRequest<{ pairing: DevicePairing }>(
    `/device-pairings/${encodeURIComponent(code)}/approve`,
    {
      method: 'POST',
      token,
    },
  )
}

export async function getPairedDevices(token: string) {
  return apiRequest<{ devices: PairedDevice[] }>('/device-pairings/devices/list', { token })
}

export async function removePairedDevice(token: string, deviceId: string) {
  return apiRequest<void>(`/device-pairings/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    token,
  })
}

export async function getAliasIntegration(token: string) {
  return apiRequest<{ integration: IntegrationStatus }>('/integrations/alias', { token })
}

export async function saveAliasIntegration(
  token: string,
  payload: { email: string; password: string; apiKey: string },
) {
  return apiRequest<{ integration: IntegrationStatus }>('/integrations/alias', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function deleteAliasIntegration(token: string) {
  return apiRequest<void>('/integrations/alias', {
    method: 'DELETE',
    token,
  })
}

export async function getStockXIntegration(token: string) {
  return apiRequest<{ integration: IntegrationStatus }>('/integrations/stockx', { token })
}

export async function saveStockXIntegration(
  token: string,
  payload: { email: string; apiKey: string; clientId: string; clientSecret: string },
) {
  return apiRequest<{ integration: IntegrationStatus }>('/integrations/stockx', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function deleteStockXIntegration(token: string) {
  return apiRequest<void>('/integrations/stockx', {
    method: 'DELETE',
    token,
  })
}

export async function startStockXOAuth(token: string) {
  return apiRequest<{ authUrl: string; redirectUri: string }>(
    '/integrations/stockx/oauth/start',
    { token },
  )
}

export function formatMarketPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }

  return `$${value.toFixed(0)}`
}
