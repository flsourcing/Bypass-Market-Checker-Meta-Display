import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  approveDevicePairing,
  clearStoredToken,
  createDevicePairing,
  createImageLookup,
  deleteApiKey,
  getApiKeys,
  getDevicePairing,
  getImageLookup,
  getMe,
  getPairedDevices,
  getStoredToken,
  login,
  removePairedDevice,
  register,
  revealApiKey,
  saveApiKey,
  setStoredToken,
} from './api'
import type { ApiKeyRecord, DevicePairing, ImageLookup, PairedDevice, User } from './api'

type Screen = 'auth' | 'home' | 'settings' | 'lookup'
type AuthMode = 'login' | 'register'

function App() {
  const isDisplayApp = window.location.pathname.toLowerCase().includes('/display-app')
  const initialPairCode = new URLSearchParams(window.location.search).get('pair')?.toUpperCase() ?? ''
  const browserAppUrl = `${window.location.origin}${window.location.pathname.replace(/\/Display-App\/?$/i, '/')}`
  const [screen, setScreen] = useState<Screen>('auth')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([])
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [lookup, setLookup] = useState<ImageLookup | null>(null)
  const [devicePairing, setDevicePairing] = useState<DevicePairing | null>(null)
  const [approvedPairCode, setApprovedPairCode] = useState('')
  const [message, setMessage] = useState('')
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    const firstFocusable = document.querySelector<HTMLElement>('[data-focusable]')
    firstFocusable?.focus()
  }, [screen, authMode, lookup?.status])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const focusableElements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-focusable]'),
      )
      const currentIndex = focusableElements.findIndex((element) => element === document.activeElement)

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusableElements.length
        focusableElements[nextIndex]?.focus()
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1
        focusableElements[nextIndex]?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!token) {
      return
    }

    getMe(token)
      .then(({ user: currentUser }) => {
        setUser(currentUser)
        setScreen('home')
        return getApiKeys(token)
      })
      .then(({ apiKeys: records }) => setApiKeys(records))
      .then(() => getPairedDevices(token))
      .then(({ devices }) => setPairedDevices(devices))
      .catch(() => {
        clearStoredToken()
        setToken(null)
        setUser(null)
      })
  }, [token])

  useEffect(() => {
    if (!isDisplayApp || token || devicePairing) {
      return
    }

    createDevicePairing('Meta Display')
      .then(({ pairing }) => setDevicePairing(pairing))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Could not create pairing code')
      })
  }, [devicePairing, isDisplayApp, token])

  useEffect(() => {
    if (!isDisplayApp || !devicePairing || devicePairing.status !== 'pending') {
      return
    }

    const interval = window.setInterval(() => {
      getDevicePairing(devicePairing.id)
        .then((result) => {
          setDevicePairing(result.pairing)

          if (result.session && result.user) {
            setStoredToken(result.session.token)
            setToken(result.session.token)
            setUser(result.user)
            setScreen('home')
            setMessage('Meta Display paired.')
          }
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'Could not check pairing status')
        })
    }, 3000)

    return () => window.clearInterval(interval)
  }, [devicePairing, isDisplayApp])

  useEffect(() => {
    if (!token || isDisplayApp || !initialPairCode || approvedPairCode === initialPairCode) {
      return
    }

    approveDevicePairing(token, initialPairCode)
      .then(() => {
        setApprovedPairCode(initialPairCode)
        setMessage(`Meta Display ${initialPairCode} paired.`)
        return getPairedDevices(token)
      })
      .then(({ devices }) => setPairedDevices(devices))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Could not pair device')
      })
  }, [approvedPairCode, initialPairCode, isDisplayApp, token])

  useEffect(() => {
    if (!token || !lookup || (lookup.status !== 'pending' && lookup.status !== 'processing')) {
      return
    }

    const interval = window.setInterval(() => {
      getImageLookup(token, lookup.id)
        .then(({ lookup: latestLookup }) => setLookup(latestLookup))
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'Unable to check lookup status')
        })
    }, 3000)

    return () => window.clearInterval(interval)
  }, [lookup, token])

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setMessage('')

    try {
      const result = authMode === 'login'
        ? await login(email, password)
        : await register(email, password)

      setStoredToken(result.session.token)
      setToken(result.session.token)
      setUser(result.user)
      setPassword('')
      setScreen('home')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setIsBusy(false)
    }
  }

  async function refreshApiKeys(activeToken = token) {
    if (!activeToken) {
      return
    }

    const { apiKeys: records } = await getApiKeys(activeToken)
    setApiKeys(records)
  }

  async function refreshPairedDevices(activeToken = token) {
    if (!activeToken) {
      return
    }

    const { devices } = await getPairedDevices(activeToken)
    setPairedDevices(devices)
  }

  async function handleSaveApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      await saveApiKey(token, provider, apiKey)
      setApiKey('')
      await refreshApiKeys(token)
      setMessage('API key saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save API key')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDeleteApiKey(providerName: string) {
    if (!token) {
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      await deleteApiKey(token, providerName)
      await refreshApiKeys(token)
      setRevealedKeys((current) => {
        const next = { ...current }
        delete next[providerName]
        return next
      })
      setMessage('API key removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove API key')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleToggleApiKey(providerName: string) {
    if (!token) {
      return
    }

    if (revealedKeys[providerName]) {
      setRevealedKeys((current) => {
        const next = { ...current }
        delete next[providerName]
        return next
      })
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      const result = await revealApiKey(token, providerName)
      setRevealedKeys((current) => ({
        ...current,
        [providerName]: result.apiKey,
      }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not show API key')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleImageLookup() {
    if (!token) {
      setScreen('auth')
      return
    }

    setIsBusy(true)
    setMessage('Looking Up Product')
    setLookup(null)
    setScreen('lookup')

    try {
      const { lookup: createdLookup } = await createImageLookup(token)
      setLookup(createdLookup)
      setMessage('Looking Up Product')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start image lookup')
    } finally {
      setIsBusy(false)
    }
  }

  function handleLogout() {
    clearStoredToken()
    setToken(null)
    setUser(null)
    setApiKeys([])
    setPairedDevices([])
    setLookup(null)
    setDevicePairing(null)
    setScreen('auth')
  }

  async function handleRemovePairedDevice(deviceId: string) {
    if (!token) {
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      await removePairedDevice(token, deviceId)
      await refreshPairedDevices(token)
      setMessage('Paired device removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove paired device')
    } finally {
      setIsBusy(false)
    }
  }

  const hasGeminiKey = apiKeys.some((record) => record.provider === 'gemini')
  const needsKeyMessage = !hasGeminiKey
    ? 'Add a Gemini API key in Settings before image lookup.'
    : ''
  const lookupStatus = lookup?.status === 'complete'
    ? 'Lookup Complete'
    : lookup?.status === 'error'
      ? 'Lookup Failed'
      : message || 'Looking Up Product'
  const qrCodeUrl = lookup
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(lookup.captureUrl)}`
    : ''
  const pairingUrl = devicePairing
    ? `${browserAppUrl}?pair=${encodeURIComponent(devicePairing.code)}`
    : ''
  const pairingQrCodeUrl = pairingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(pairingUrl)}`
    : ''

  return (
    <main className="app-shell">
      {screen !== 'auth' && (
        <button
          className="settings-button"
          type="button"
          aria-label="Settings"
          data-focusable
          onClick={() => {
            setMessage('')
            setScreen('settings')
          }}
        >
          ⚙
        </button>
      )}

      {screen === 'auth' && (
        <section className="glass-card auth-card" aria-label="Account">
          <p className="eyebrow">Bypass Market Checker</p>
          {isDisplayApp ? (
            <>
              <h1>Pair Meta Display</h1>
              <div className="capture-box">
                <p>Scan this QR code with your phone, then log in to approve this display.</p>
                {pairingQrCodeUrl && (
                  <img className="qr-code" src={pairingQrCodeUrl} alt={`QR code for ${pairingUrl}`} />
                )}
                <strong>{devicePairing?.code ?? 'Loading'}</strong>
                {pairingUrl && <span>{pairingUrl}</span>}
              </div>
              <button
                className="text-button"
                type="button"
                data-focusable
                onClick={() => {
                  setDevicePairing(null)
                  setMessage('')
                }}
              >
                New Code
              </button>
            </>
          ) : (
            <>
              <h1>{authMode === 'login' ? 'Log In' : 'Create Account'}</h1>
              {initialPairCode && (
                <p className="status-message">Log in to approve Meta Display {initialPairCode}.</p>
              )}
              <form className="stack-form" onSubmit={handleAuthSubmit}>
                <input
                  data-focusable
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <input
                  data-focusable
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button className="primary-button" type="submit" data-focusable disabled={isBusy}>
                  {authMode === 'login' ? 'Log In' : 'Create Account'}
                </button>
              </form>
              <button
                className="text-button"
                type="button"
                data-focusable
                onClick={() => {
                  setMessage('')
                  setAuthMode(authMode === 'login' ? 'register' : 'login')
                }}
              >
                {authMode === 'login' ? 'Need an account?' : 'Already have an account?'}
              </button>
            </>
          )}
          {message && <p className="status-message">{message}</p>}
        </section>
      )}

      {screen === 'home' && (
        <section className="home-wrap" aria-label="Bypass Market Checker">
          <div className="user-chip">{user?.email}</div>
          <section className="lookup-panel">
            <button
              className="lookup-button"
              type="button"
              data-focusable
              onClick={handleImageLookup}
              disabled={isBusy}
            >
              Image Lookup
            </button>

            <button
              className="lookup-button"
              type="button"
              data-focusable
              onClick={() => setMessage('Barcode Lookup is next.')}
            >
              Barcode Lookup
            </button>
          </section>
          {(needsKeyMessage || message) && (
            <p className="center-message">{message || needsKeyMessage}</p>
          )}
        </section>
      )}

      {screen === 'settings' && (
        <section className="glass-card settings-card" aria-label="Settings">
          <div className="card-header">
            <div>
              <p className="eyebrow">Settings</p>
              <h1>API Keys</h1>
            </div>
            <button className="text-button" type="button" data-focusable onClick={() => setScreen('home')}>
              Done
            </button>
          </div>

          <div className="key-list">
            {apiKeys.length === 0 && <p>No API keys saved.</p>}
            {apiKeys.map((record) => (
              <div className="key-row" key={record.id}>
                <div className="key-info">
                  <span>{record.provider}</span>
                  {revealedKeys[record.provider] && (
                    <code>{revealedKeys[record.provider]}</code>
                  )}
                </div>
                <div className="key-actions">
                  <button
                    className="icon-button"
                    type="button"
                    data-focusable
                    disabled={isBusy}
                    aria-label={revealedKeys[record.provider] ? `Hide ${record.provider} API key` : `Show ${record.provider} API key`}
                    onClick={() => handleToggleApiKey(record.provider)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    className="icon-button trash-button"
                    type="button"
                    data-focusable
                    disabled={isBusy}
                    aria-label={`Delete ${record.provider} API key`}
                    onClick={() => handleDeleteApiKey(record.provider)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M4 7h16" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M6 7l1 14h10l1-14" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form className="stack-form" onSubmit={handleSaveApiKey}>
            <div className="add-label">+ Add API Key</div>
            <select data-focusable value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="gemini">Gemini Vision</option>
            </select>
            <input
              data-focusable
              type="password"
              placeholder="Paste API key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <button
              className={`primary-button ${apiKey.trim() ? 'ready-button' : ''}`}
              type="submit"
              data-focusable
              disabled={isBusy || !apiKey.trim()}
            >
              Save API Key
            </button>
          </form>

          <div className="paired-devices">
            <div className="add-label">Paired Devices</div>
            {pairedDevices.length === 0 && <p>No paired devices yet.</p>}
            {pairedDevices.map((device) => (
              <div className="key-row" key={device.id}>
                <div className="key-info">
                  <span>{device.name}</span>
                  <code>{new Date(device.createdAt).toLocaleDateString()}</code>
                </div>
                <button
                  className="icon-button trash-button"
                  type="button"
                  data-focusable
                  disabled={isBusy}
                  aria-label={`Remove ${device.name}`}
                  onClick={() => handleRemovePairedDevice(device.id)}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M4 7h16" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M6 7l1 14h10l1-14" />
                    <path d="M9 7V4h6v3" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button className="text-button danger" type="button" data-focusable onClick={handleLogout}>
            Log Out
          </button>
          {message && <p className="center-message in-card">{message}</p>}
        </section>
      )}

      {screen === 'lookup' && (
        <section className="glass-card lookup-card" aria-label="Image Lookup">
          <p className="eyebrow">Image Lookup</p>
          <h1>{lookupStatus}</h1>

          {lookup && lookup.status !== 'complete' && lookup.status !== 'error' && (
            <div className="capture-box">
              <p>Scan this QR code on your phone to take or upload the shoe photo:</p>
              <img className="qr-code" src={qrCodeUrl} alt={`QR code for ${lookup.captureUrl}`} />
              <strong>{lookup.captureCode}</strong>
              <span>{lookup.captureUrl}</span>
            </div>
          )}

          {lookup?.status === 'complete' && (
            <div className="result-box">
              <p>SKU</p>
              <strong>{lookup.result?.sku ?? 'Not found'}</strong>
              <span>
                {[lookup.result?.brand, lookup.result?.model, lookup.result?.colorway]
                  .filter(Boolean)
                  .join(' • ') || 'No product details returned'}
              </span>
              <small>Confidence: {lookup.result?.confidence ?? 0}%</small>
              {lookup.result?.notes && <small>{lookup.result.notes}</small>}
            </div>
          )}

          {lookup?.status === 'error' && (
            <p className="status-message">{lookup.error ?? 'Lookup failed'}</p>
          )}

          <div className="actions-row">
            <button className="primary-button" type="button" data-focusable onClick={() => setScreen('home')}>
              Home
            </button>
            <button className="text-button" type="button" data-focusable onClick={handleImageLookup}>
              Retry
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
