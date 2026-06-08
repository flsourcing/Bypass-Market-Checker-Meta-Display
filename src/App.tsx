import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  approveDevicePairing,
  clearStoredToken,
  createDevicePairing,
  createBarcodeLookup,
  createImageLookup,
  deleteApiKey,
  fetchLookupImageBlob,
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
type LookupKind = 'image' | 'barcode'

function App() {
  const isDisplayApp = window.location.pathname.toLowerCase().includes('/display-app')
  const [screen, setScreen] = useState<Screen>('auth')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([])
  const [addDeviceCode, setAddDeviceCode] = useState('')
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [lookup, setLookup] = useState<ImageLookup | null>(null)
  const [lookupImageObjectUrl, setLookupImageObjectUrl] = useState<string | null>(null)
  const [streamPairLookupId, setStreamPairLookupId] = useState<string | null>(null)
  const [activeLookupKind, setActiveLookupKind] = useState<LookupKind | null>(null)
  const [displayCaptureArmed, setDisplayCaptureArmed] = useState(false)
  const [captureSessionActive, setCaptureSessionActive] = useState(false)
  const [devicePairing, setDevicePairing] = useState<DevicePairing | null>(null)
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
    if (!isDisplayApp || !devicePairing || devicePairing.status !== 'pending') {
      return
    }

    const delay = Math.max(new Date(devicePairing.expiresAt).getTime() - Date.now(), 0)
    const timeout = window.setTimeout(() => {
      setDevicePairing(null)
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [devicePairing, isDisplayApp])

  useEffect(() => {
    if (!token || !lookup) {
      return
    }

    const waitingForImage = lookup.status === 'complete'
      && !lookup.imagePreview
      && !lookupImageObjectUrl

    if (
      lookup.status !== 'pending'
      && lookup.status !== 'processing'
      && !waitingForImage
    ) {
      return
    }

    const interval = window.setInterval(() => {
      getImageLookup(token, lookup.id)
        .then(({ lookup: latestLookup }) => {
          setLookup(latestLookup)
          if (
            isDisplayApp
            && captureSessionActive
            && latestLookup.id !== streamPairLookupId
            && (latestLookup.status === 'processing' || latestLookup.status === 'complete')
          ) {
            setCaptureSessionActive(false)
          }
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'Unable to check lookup status')
        })
    }, isDisplayApp && (captureSessionActive || waitingForImage) ? 800 : isDisplayApp ? 1200 : 3000)

    return () => window.clearInterval(interval)
  }, [captureSessionActive, isDisplayApp, lookup, lookupImageObjectUrl, streamPairLookupId, token])

  useEffect(() => {
    if (!token || !lookup || lookup.status !== 'complete' || lookup.imagePreview) {
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    fetchLookupImageBlob(token, lookup.id)
      .then((blob) => {
        if (cancelled) {
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setLookupImageObjectUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setLookupImageObjectUrl(null)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [lookup?.id, lookup?.imagePreview, lookup?.status, token])

  function resetDisplayLookup() {
    setLookup(null)
    setLookupImageObjectUrl(null)
    setStreamPairLookupId(null)
    setActiveLookupKind(null)
    setDisplayCaptureArmed(false)
    setCaptureSessionActive(false)
    setMessage('')
  }

  function goDisplayHome() {
    if (screen === 'settings') {
      setScreen('home')
      setMessage('')
      return
    }

    resetDisplayLookup()
  }

  async function handleDisplayCapture() {
    if (!token) {
      return
    }

    setCaptureSessionActive(true)
    setMessage('Processing Capture...')

    if (activeLookupKind === 'barcode') {
      await handleBarcodeLookup({ keepScreen: true, captureRequest: true })
      return
    }

    await handleImageLookup({ keepScreen: true, captureRequest: true })
  }

  function formatLookupDate(value: string) {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function lookupProductName(currentLookup: ImageLookup) {
    return [currentLookup.result?.brand, currentLookup.result?.model]
      .filter(Boolean)
      .join(' ') || 'Unknown product'
  }

  function lookupImageSrc(currentLookup: ImageLookup) {
    return currentLookup.imagePreview ?? lookupImageObjectUrl
  }

  function barcodeDetectionMethod(notes: string | null | undefined) {
    if (!notes) {
      return 'Device scan'
    }

    if (notes.toLowerCase().includes('gemini')) {
      return 'Gemini fallback'
    }

    return 'Device scan'
  }

  function renderLookupDetailCard(currentLookup: ImageLookup, className = 'lookup-detail-card') {
    const imageSrc = lookupImageSrc(currentLookup)
    const isBarcode = currentLookup.lookupType === 'barcode'
    const upc = currentLookup.result?.upc ?? currentLookup.result?.sku

    return (
      <section className={`glass-card ${className}`} aria-label="Lookup Result">
        <p className="eyebrow">Lookup Result</p>

        <div className="lookup-detail-grid">
          {isBarcode ? (
            <>
              <div className="lookup-detail-row">
                <span>UPC</span>
                <strong>{upc ?? 'Not found'}</strong>
              </div>
              <div className="lookup-detail-row">
                <span>Method</span>
                <strong>{barcodeDetectionMethod(currentLookup.result?.notes)}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="lookup-detail-row">
                <span>Product</span>
                <strong>{lookupProductName(currentLookup)}</strong>
              </div>
              <div className="lookup-detail-row">
                <span>SKU</span>
                <strong>{currentLookup.result?.sku ?? 'Not found'}</strong>
              </div>
              <div className="lookup-detail-row">
                <span>Accuracy</span>
                <strong>{currentLookup.result?.confidence ?? 0}%</strong>
              </div>
            </>
          )}
          <div className="lookup-detail-row">
            <span>Date</span>
            <strong>{formatLookupDate(currentLookup.updatedAt || currentLookup.createdAt)}</strong>
          </div>
        </div>

        {imageSrc ? (
          <img
            className="captured-preview captured-preview-below"
            src={imageSrc}
            alt={isBarcode ? 'Captured barcode' : 'Captured product'}
          />
        ) : (
          <p className="image-loading-note">Loading captured photo...</p>
        )}
      </section>
    )
  }

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

  async function handleLookup(
    kind: LookupKind,
    options?: { keepScreen?: boolean; captureRequest?: boolean; startStreamOnly?: boolean },
  ) {
    if (!token) {
      setScreen('auth')
      return
    }

    if (kind === 'image' && !apiKeys.some((record) => record.provider === 'gemini')) {
      setMessage('Add a Gemini API key in Settings before image lookup.')
      return
    }

    setActiveLookupKind(kind)
    setIsBusy(true)
    setMessage(
      isDisplayApp && options?.captureRequest
        ? 'Processing Capture...'
        : isDisplayApp && options?.startStreamOnly
          ? kind === 'barcode'
            ? 'Starting barcode stream pair...'
            : 'Starting live stream pair...'
        : isDisplayApp
          ? 'Waiting for Mobile Stream Pair'
          : kind === 'barcode'
            ? 'Scanning Barcode'
            : 'Looking Up Product',
    )
    if (!options?.captureRequest) {
      setLookup(null)
    }
    if (!options?.keepScreen) {
      setScreen('lookup')
    }
    if (isDisplayApp && options?.startStreamOnly) {
      setDisplayCaptureArmed(true)
    }

    try {
      const lookupMode = isDisplayApp && options?.startStreamOnly
        ? 'stream_pair'
        : 'capture'
      const createLookup = kind === 'barcode' ? createBarcodeLookup : createImageLookup
      const { lookup: createdLookup } = await createLookup(token, lookupMode)
      setLookup(createdLookup)
      if (isDisplayApp && options?.startStreamOnly) {
        setStreamPairLookupId(createdLookup.id)
      }
      setMessage(
        isDisplayApp && options?.captureRequest
          ? 'Processing Capture...'
          : isDisplayApp && options?.startStreamOnly
            ? kind === 'barcode'
              ? 'Barcode stream pair requested. Tap Capture when ready.'
              : 'Live stream pair requested. Companion should auto-start glasses stream.'
          : isDisplayApp
            ? 'Waiting for Mobile Stream Pair'
            : kind === 'barcode'
              ? 'Scanning Barcode'
              : 'Looking Up Product',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not start ${kind} lookup`)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleImageLookup(options?: { keepScreen?: boolean; captureRequest?: boolean; startStreamOnly?: boolean }) {
    await handleLookup('image', options)
  }

  async function handleBarcodeLookup(options?: { keepScreen?: boolean; captureRequest?: boolean; startStreamOnly?: boolean }) {
    await handleLookup('barcode', options)
  }

  function handleLogout() {
    clearStoredToken()
    setToken(null)
    setUser(null)
    setApiKeys([])
    setPairedDevices([])
    setLookup(null)
    setLookupImageObjectUrl(null)
    setStreamPairLookupId(null)
    setActiveLookupKind(null)
    setDisplayCaptureArmed(false)
    setCaptureSessionActive(false)
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

  async function handleAddDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      return
    }

    const code = addDeviceCode.trim().toUpperCase()

    if (!code) {
      setMessage('Enter the code shown on the glasses.')
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      await approveDevicePairing(token, code)
      setAddDeviceCode('')
      await refreshPairedDevices(token)
      setMessage(`Device ${code} paired.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not pair device')
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
      : isDisplayApp
        ? 'Waiting for Mobile Stream Pair'
        : message || 'Looking Up Product'
  const displayLookupStatus = !lookup
    ? 'Tap Capture to request a frame from companion.'
    : lookup.status === 'pending'
      ? lookup.id === streamPairLookupId
        ? 'Live stream pair requested. Tap Capture when ready.'
        : 'Processing Capture...'
      : lookup.status === 'processing'
        ? lookup.lookupType === 'barcode'
          ? 'Reading barcode with Gemini...'
          : 'Processing Capture...'
        : lookup.status === 'complete'
          ? 'Capture complete.'
          : lookup.error ?? 'Lookup failed'
  const isDisplayCaptureBusy = captureSessionActive
    || lookup?.status === 'processing'
    || (lookup?.status === 'pending' && lookup.id !== streamPairLookupId)
  const qrCodeUrl = lookup
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(lookup.captureUrl)}`
    : ''

  return (
    <main className={`app-shell ${isDisplayApp ? 'display-app-shell' : ''}`}>
      {screen !== 'auth' && isDisplayApp && (
        <button
          className="home-button"
          type="button"
          aria-label="Home"
          data-focusable
          onClick={goDisplayHome}
        >
          Home
        </button>
      )}

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
              <h1>Pair Glasses To Account</h1>
              <div className="pair-code-card">
                <p>Account Pair Code</p>
                <strong>{devicePairing?.code ?? 'Loading'}</strong>
                <span>Code refreshes every 30 seconds.</span>
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
        <section
          className={`home-wrap ${isDisplayApp && displayCaptureArmed ? 'capture-home-wrap display-result-wrap' : ''}`}
          aria-label="Bypass Market Checker"
        >
          <div className="user-chip">{user?.email}</div>
          {isDisplayApp && displayCaptureArmed ? (
            <>
              {lookup?.status === 'complete' ? (
                renderLookupDetailCard(lookup, 'lookup-detail-card home-result')
              ) : lookup?.status === 'error' ? (
                <section className="glass-card result-box home-result" aria-label="Lookup Error">
                  <p>Lookup Failed</p>
                  <span>{lookup.error ?? 'Lookup failed'}</span>
                </section>
              ) : isDisplayCaptureBusy ? (
                <section className="glass-card processing-card home-result" aria-label="Processing Capture">
                  <p className="eyebrow">{activeLookupKind === 'barcode' ? 'Barcode Lookup' : 'Image Lookup'}</p>
                  <h1 className="processing-title">
                    {activeLookupKind === 'barcode' && lookup?.status === 'processing'
                      ? 'Reading Barcode'
                      : 'Processing Capture'}
                  </h1>
                  <p className="center-message capture-mode">{displayLookupStatus}</p>
                </section>
              ) : (
                <>
                  <section className="lookup-panel capture-floating-panel">
                    <button
                      className="lookup-button"
                      type="button"
                      data-focusable
                      onClick={() => {
                        void handleDisplayCapture()
                      }}
                      disabled={isBusy}
                    >
                      Capture
                    </button>
                  </section>
                  <p className="center-message capture-mode">{displayLookupStatus}</p>
                </>
              )}
            </>
          ) : (
            <>
              <section className="lookup-panel">
                <button
                  className="lookup-button"
                  type="button"
                  data-focusable
                  onClick={() => {
                    void handleImageLookup(isDisplayApp ? { keepScreen: true, startStreamOnly: true } : undefined)
                  }}
                  disabled={isBusy}
                >
                  Image Lookup
                </button>

                <button
                  className="lookup-button"
                  type="button"
                  data-focusable
                  onClick={() => {
                    void handleBarcodeLookup(isDisplayApp ? { keepScreen: true, startStreamOnly: true } : undefined)
                  }}
                  disabled={isBusy}
                >
                  Barcode Lookup
                </button>
              </section>
              {(needsKeyMessage || message) && (
                <p className="center-message">{message || needsKeyMessage}</p>
              )}
            </>
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
            <div className="add-label">Devices</div>
            {!isDisplayApp && (
              <form className="stack-form" onSubmit={handleAddDevice}>
                <div className="add-label">+ Add Device</div>
                <input
                  data-focusable
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder="Enter glasses code"
                  value={addDeviceCode}
                  onChange={(event) => setAddDeviceCode(event.target.value.toUpperCase())}
                />
                <button
                  className={`primary-button ${addDeviceCode.trim() ? 'ready-button' : ''}`}
                  type="submit"
                  data-focusable
                  disabled={isBusy || !addDeviceCode.trim()}
                >
                  Pair Device
                </button>
              </form>
            )}
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

      {screen === 'lookup' && !isDisplayApp && (
        <section className="glass-card lookup-card" aria-label="Image Lookup">
          <p className="eyebrow">Image Lookup</p>
          <h1>{lookupStatus}</h1>

          {lookup && !isDisplayApp && lookup.status !== 'complete' && lookup.status !== 'error' && (
            <div className="capture-box">
              <p>Scan this QR code on your phone to take or upload the shoe photo:</p>
              <img className="qr-code" src={qrCodeUrl} alt={`QR code for ${lookup.captureUrl}`} />
              <strong>{lookup.captureCode}</strong>
              <span>{lookup.captureUrl}</span>
            </div>
          )}

          {lookup?.status === 'complete' && renderLookupDetailCard(lookup)}

          {lookup?.status === 'error' && (
            <p className="status-message">{lookup.error ?? 'Lookup failed'}</p>
          )}

          <div className="actions-row">
            <button
              className="primary-button"
              type="button"
              data-focusable
              onClick={() => {
                setScreen('home')
              }}
            >
              Home
            </button>
            {!isDisplayApp && (
              <button className="text-button" type="button" data-focusable onClick={() => void handleImageLookup()}>
                Retry
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  )
}

export default App
