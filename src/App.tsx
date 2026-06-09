import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'
import {
  approveDevicePairing,
  armLookupCapture,
  clearStoredToken,
  createDevicePairing,
  createBarcodeLookup,
  createImageLookup,
  deleteAliasIntegration,
  deleteApiKey,
  deleteStockXIntegration,
  fetchLookupImageBlob,
  formatMarketPrice,
  getAliasIntegration,
  getApiBaseUrl,
  getApiKeys,
  getDevicePairing,
  getImageLookup,
  getMe,
  getPairedDevices,
  getStockXIntegration,
  getStoredToken,
  login,
  removePairedDevice,
  register,
  revealApiKey,
  saveAliasIntegration,
  saveApiKey,
  saveStockXIntegration,
  setStoredToken,
  startStockXOAuth,
  submitLookupFeedback,
} from './api'
import type {
  ApiKeyRecord,
  DevicePairing,
  ImageLookup,
  IntegrationStatus,
  PairedDevice,
  User,
} from './api'

type Screen = 'auth' | 'home' | 'settings' | 'lookup'
type AuthMode = 'login' | 'register'
type LookupKind = 'image' | 'barcode'
type SpeechRecognitionEvent = Event & {
  results: {
    length: number
    [index: number]: {
      length: number
      [index: number]: {
        transcript: string
      }
    }
  }
}
type SpeechRecognitionConstructor = new () => {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  start: () => void
  stop: () => void
}

const FEEDBACK_KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ['Space', 'Backspace', 'Clear', 'Done'],
]

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
  const [feedbackLookup, setFeedbackLookup] = useState<ImageLookup | null>(null)
  const [feedbackNote, setFeedbackNote] = useState('')
  const [feedbackKeyboardOpen, setFeedbackKeyboardOpen] = useState(false)
  const [feedbackKeyboardFocus, setFeedbackKeyboardFocus] = useState({ row: 0, col: 0 })
  const [isListeningForFeedback, setIsListeningForFeedback] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
  const [isBusy, setIsBusy] = useState(false)
  const [aliasIntegration, setAliasIntegration] = useState<IntegrationStatus | null>(null)
  const [stockxIntegration, setStockxIntegration] = useState<IntegrationStatus | null>(null)
  const [aliasEmail, setAliasEmail] = useState('')
  const [aliasPassword, setAliasPassword] = useState('')
  const [aliasApiKey, setAliasApiKey] = useState('')
  const [stockxEmail, setStockxEmail] = useState('')
  const [stockxApiKey, setStockxApiKey] = useState('')
  const [stockxClientId, setStockxClientId] = useState('')
  const [stockxClientSecret, setStockxClientSecret] = useState('')

  useEffect(() => {
    if (
      isDisplayApp
      && displayCaptureArmed
      && (lookup?.status === 'complete' || lookup?.status === 'error')
    ) {
      document.querySelector<HTMLElement>('.lookup-result-scroll')?.focus()
      return
    }

    const firstFocusable = document.querySelector<HTMLElement>('[data-focusable]')
    firstFocusable?.focus()
  }, [screen, authMode, lookup?.status, isDisplayApp, displayCaptureArmed])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (feedbackKeyboardOpen && feedbackLookup) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setFeedbackKeyboardFocus((current) => {
            if (current.row === -1) {
              return event.key === 'ArrowDown'
                ? { row: 0, col: Math.min(current.col, FEEDBACK_KEYBOARD_ROWS[0].length - 1) }
                : { row: FEEDBACK_KEYBOARD_ROWS.length - 1, col: 0 }
            }

            if (event.key === 'ArrowUp' && current.row === 0) {
              return { row: -1, col: 0 }
            }

            const direction = event.key === 'ArrowDown' ? 1 : -1
            const nextRow = (current.row + direction + FEEDBACK_KEYBOARD_ROWS.length) % FEEDBACK_KEYBOARD_ROWS.length
            const nextCol = Math.min(current.col, FEEDBACK_KEYBOARD_ROWS[nextRow].length - 1)
            return { row: nextRow, col: nextCol }
          })
          return
        }

        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          setFeedbackKeyboardFocus((current) => {
            if (current.row === -1) {
              return current
            }

            const rowLength = FEEDBACK_KEYBOARD_ROWS[current.row].length
            const direction = event.key === 'ArrowRight' ? 1 : -1
            const nextCol = (current.col + direction + rowLength) % rowLength
            return { ...current, col: nextCol }
          })
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (feedbackKeyboardFocus.row === -1) {
            startFeedbackDictation()
            return
          }

          const key = FEEDBACK_KEYBOARD_ROWS[feedbackKeyboardFocus.row]?.[feedbackKeyboardFocus.col]
          if (key) {
            pressFeedbackKeyboardKey(key)
          }
          return
        }
      }

      const active = document.activeElement as HTMLElement | null
      const scrollContainer = active?.matches('[data-scrollable]')
        ? active
        : active?.closest<HTMLElement>('[data-scrollable]') ?? null

      if (scrollContainer && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 140 : -140
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight
        const nextTop = Math.max(0, Math.min(maxScroll, scrollContainer.scrollTop + delta))

        if (nextTop !== scrollContainer.scrollTop) {
          scrollContainer.scrollTop = nextTop
          return
        }
      }

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

      if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target as HTMLElement | null
        if (target?.matches('button[data-focusable]:not(:disabled)')) {
          event.preventDefault()
          target.click()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [feedbackKeyboardFocus, feedbackKeyboardOpen, feedbackLookup])

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
    const params = new URLSearchParams(window.location.search)
    const oauthResult = params.get('stockx_oauth')

    if (!oauthResult) {
      return
    }

    if (oauthResult === 'success') {
      setMessage('StockX login connected.')
      setScreen('settings')
      if (token) {
        void refreshIntegrations(token)
      }
    } else {
      setMessage(params.get('message') ?? 'StockX login failed.')
      setScreen('settings')
    }

    params.delete('stockx_oauth')
    params.delete('message')
    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
    window.history.replaceState({}, '', nextUrl)
  }, [token])

  useEffect(() => {
    if (!token || screen !== 'settings') {
      return
    }

    void refreshIntegrations(token)
  }, [screen, token])

  useEffect(() => {
    if (!token || !lookup) {
      return
    }

    const waitingForImage = lookup.status === 'complete'
      && !lookup.imagePreview
      && !lookupImageObjectUrl
    const waitingForMarket = lookup.status === 'complete'
      && lookup.marketStatus === 'loading'
    const waitingForFeedback = isDisplayApp
      && lookup.status === 'complete'
      && !lookup.feedback

    if (
      lookup.status !== 'pending'
      && lookup.status !== 'processing'
      && !waitingForImage
      && !waitingForMarket
      && !waitingForFeedback
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
            && (latestLookup.status === 'complete' || latestLookup.status === 'error')
          ) {
            setCaptureSessionActive(false)
          }
          if (latestLookup.feedback) {
            setFeedbackLookup(null)
            setFeedbackNote('')
          }
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'Unable to check lookup status')
        })
    }, isDisplayApp && (captureSessionActive || lookup.status === 'processing' || waitingForImage || waitingForMarket || waitingForFeedback) ? 500 : isDisplayApp ? 1200 : 3000)

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

  function syncActiveLookupKind(currentLookup: ImageLookup) {
    if (currentLookup.lookupType === 'barcode') {
      setActiveLookupKind('barcode')
      return
    }

    if (currentLookup.lookupType === 'image') {
      setActiveLookupKind('image')
    }
  }

  async function handleDisplayCapture() {
    if (!token) {
      return
    }

    setCaptureSessionActive(true)
    setMessage('Processing Capture...')

    let pendingLookup = lookup?.status === 'pending' ? lookup : null

    if (!pendingLookup) {
      const kind = activeLookupKind ?? 'image'
      pendingLookup = kind === 'barcode'
        ? await handleBarcodeLookup({ keepScreen: true, startStreamOnly: true })
        : await handleImageLookup({ keepScreen: true, startStreamOnly: true })
      if (!pendingLookup) {
        setCaptureSessionActive(false)
        return
      }
      setCaptureSessionActive(false)
      setMessage('Ready. Tap Capture to snap a photo.')
      return
    }

    const pendingLookupId = pendingLookup?.id ?? streamPairLookupId
    if (!pendingLookupId) {
      setCaptureSessionActive(false)
      setMessage('Could not start lookup. Try again.')
      return
    }

    try {
      const { lookup: armedLookup } = await armLookupCapture(token, pendingLookupId)
      syncActiveLookupKind(armedLookup)
      setLookup(armedLookup)
      setStreamPairLookupId(null)
      setDisplayCaptureArmed(true)
      setMessage('Processing Capture...')
    } catch (error) {
      setCaptureSessionActive(false)
      setMessage(error instanceof Error ? error.message : 'Could not start capture')
    }
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

  function displayLookupValue(value: string | null | undefined) {
    return value?.trim() || 'Not found'
  }

  function withFeedback(
    currentLookup: ImageLookup,
    status: 'correct' | 'incorrect',
    note: string,
  ): ImageLookup {
    const now = new Date().toISOString()

    return {
      ...currentLookup,
      feedback: {
        status,
        correction: note.trim() || null,
        createdAt: currentLookup.feedback?.createdAt ?? now,
        updatedAt: now,
      },
      updatedAt: now,
    }
  }

  function triggerConfetti() {
    setShowConfetti(false)
    window.setTimeout(() => setShowConfetti(true), 0)
    window.setTimeout(() => setShowConfetti(false), 1800)
  }

  async function saveLookupFeedback(
    currentLookup: ImageLookup,
    status: 'correct' | 'incorrect',
    note = '',
  ) {
    if (!token) {
      setMessage('Log in before saving feedback.')
      return
    }

    if (currentLookup.feedback) {
      setFeedbackLookup(null)
      setFeedbackNote('')
      setMessage('Feedback has already been saved for this lookup.')
      return
    }

    const optimisticLookup = withFeedback(currentLookup, status, note)
    setLookup((visibleLookup) => (
      visibleLookup?.id === currentLookup.id ? optimisticLookup : visibleLookup
    ))
    setFeedbackLookup(null)
    setFeedbackNote('')
    setFeedbackKeyboardOpen(false)
    setIsListeningForFeedback(false)

    try {
      const { lookup: updatedLookup } = await submitLookupFeedback(
        token,
        currentLookup.id,
        status,
        note,
      )
      setLookup((visibleLookup) => {
        if (visibleLookup?.id !== currentLookup.id) {
          return visibleLookup
        }

        return updatedLookup.feedback ? updatedLookup : {
          ...updatedLookup,
          feedback: optimisticLookup.feedback,
        }
      })
      setMessage(status === 'correct' ? 'Marked correct.' : 'Marked incorrect. Thanks for helping improve results.')
      if (status === 'correct') {
        triggerConfetti()
      }
    } catch (error) {
      setLookup((visibleLookup) => (
        visibleLookup?.id === currentLookup.id ? currentLookup : visibleLookup
      ))
      setMessage(error instanceof Error ? error.message : 'Could not save feedback')
    }
  }

  function openIncorrectFeedback(currentLookup: ImageLookup) {
    if (currentLookup.feedback) {
      setFeedbackLookup(null)
      setFeedbackNote('')
      setFeedbackKeyboardOpen(false)
      setMessage('Feedback has already been saved for this lookup.')
      return
    }

    setFeedbackLookup(currentLookup)
    setFeedbackNote('')
    setFeedbackKeyboardOpen(false)
    setFeedbackKeyboardFocus({ row: 0, col: 0 })
  }

  function closeIncorrectFeedback() {
    setFeedbackLookup(null)
    setFeedbackNote('')
    setFeedbackKeyboardOpen(false)
    setIsListeningForFeedback(false)
  }

  function pressFeedbackKeyboardKey(key: string) {
    if (key === 'Backspace') {
      setFeedbackNote((current) => current.slice(0, -1))
      return
    }

    if (key === 'Clear') {
      setFeedbackNote('')
      return
    }

    if (key === 'Done') {
      setFeedbackKeyboardOpen(false)
      return
    }

    if (key === 'Space') {
      setFeedbackNote((current) => `${current} `)
      return
    }

    setFeedbackNote((current) => `${current}${key.toLowerCase()}`)
  }

  function startFeedbackDictation() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMessage('Microphone dictation is not available in this glasses browser. Use the iPhone note input for voice.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript.trim()
        if (transcript) {
          setFeedbackNote((current) => [current.trim(), transcript].filter(Boolean).join(' '))
        }
      }
      recognition.onerror = () => {
        setIsListeningForFeedback(false)
        setMessage('Could not access microphone here. Use the iPhone note input for voice.')
      }
      recognition.onend = () => setIsListeningForFeedback(false)
      setIsListeningForFeedback(true)
      recognition.start()
    } catch {
      setIsListeningForFeedback(false)
      setMessage('Microphone access was blocked here. Use the iPhone note input for voice.')
    }
  }

  function renderLookupDetailCard(currentLookup: ImageLookup, className = 'lookup-detail-card') {
    const imageSrc = lookupImageSrc(currentLookup)
    const isBarcode = currentLookup.lookupType === 'barcode'
    const upc = currentLookup.result?.upc ?? currentLookup.result?.sku
    const marketData = currentLookup.marketData
    const aliasImage = marketData?.alias?.product.mainPictureUrl ?? null
    const productTitle = marketData?.stockx?.product.title
      ?? marketData?.alias?.product.name
      ?? lookupProductName(currentLookup)

    return (
      <section
        className={`glass-card ${className} lookup-result-scroll`}
        aria-label="Lookup Result"
        data-focusable
        data-scrollable
        tabIndex={0}
      >
        <p className="eyebrow">Lookup Result</p>
        {isDisplayApp && <p className="scroll-hint">Use up/down to scroll this result.</p>}

        <div className="lookup-detail-grid">
          {isBarcode ? (
            <>
              <div className="lookup-detail-row">
                <span>UPC</span>
                <strong>{displayLookupValue(upc)}</strong>
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
                <strong>{displayLookupValue(currentLookup.result?.sku)}</strong>
              </div>
              <div className="lookup-detail-row">
                <span>Accuracy</span>
                <strong>{currentLookup.result?.confidence ?? 0}%</strong>
              </div>
            </>
          )}
          {productTitle && marketData && (
            <div className="lookup-detail-row">
              <span>Market Match</span>
              <strong>{productTitle}</strong>
            </div>
          )}
          <div className="lookup-detail-row">
            <span>Date</span>
            <strong>{formatLookupDate(currentLookup.updatedAt || currentLookup.createdAt)}</strong>
          </div>
          <div className="lookup-detail-row">
            <span>Feedback</span>
            <strong>{currentLookup.feedback?.status ?? 'Not marked'}</strong>
          </div>
        </div>

        {!currentLookup.feedback && (
          <div className="feedback-actions">
            <button
              className="feedback-button correct"
              type="button"
              data-focusable
              onClick={() => void saveLookupFeedback(currentLookup, 'correct')}
            >
              Correct
            </button>
            <button
              className="feedback-button incorrect"
              type="button"
              data-focusable
              onClick={() => openIncorrectFeedback(currentLookup)}
            >
              Incorrect
            </button>
          </div>
        )}

        {(imageSrc || aliasImage) && (
          <div className="product-image-compare">
            {imageSrc && (
              <div className="product-image-card">
                <span>Your Photo</span>
                <img
                  className="captured-preview captured-preview-below"
                  src={imageSrc}
                  alt={isBarcode ? 'Captured barcode' : 'Captured product'}
                />
              </div>
            )}
            {aliasImage && (
              <div className="product-image-card">
                <span>Alias Catalog</span>
                <img
                  className="captured-preview captured-preview-below"
                  src={aliasImage}
                  alt="Alias catalog product"
                />
              </div>
            )}
          </div>
        )}

        {!imageSrc && !aliasImage && (
          <p className="image-loading-note">Loading captured photo...</p>
        )}

        {currentLookup.marketStatus === 'loading' && (
          <p className="market-loading-note">Loading StockX and Alias market data...</p>
        )}

        {marketData && marketData.combined.length > 0 && (
          <div className="market-table-wrap">
            <p className="add-label">Market Pricing (New)</p>
            <table className="market-table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th colSpan={2}>StockX</th>
                  <th colSpan={2}>Alias</th>
                </tr>
                <tr className="market-table-subhead">
                  <th />
                  <th>Bid</th>
                  <th>Ask</th>
                  <th>Bid</th>
                  <th>Ask</th>
                </tr>
              </thead>
              <tbody>
                {marketData.combined.map((row) => (
                  <tr key={row.size}>
                    <td>{formatSize(row.size)}</td>
                    <td>{formatMarketPrice(row.stockx?.highestBid)}</td>
                    <td>{formatMarketPrice(row.stockx?.lowestAsk)}</td>
                    <td>{formatMarketPrice(row.alias?.highestBid)}</td>
                    <td>{formatMarketPrice(row.alias?.lowestAsk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {marketData && (marketData.errors.alias || marketData.errors.stockx) && (
          <div className="market-errors">
            {marketData.errors.stockx && <p>StockX: {marketData.errors.stockx}</p>}
            {marketData.errors.alias && <p>Alias: {marketData.errors.alias}</p>}
          </div>
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

  async function refreshIntegrations(activeToken = token) {
    if (!activeToken) {
      return
    }

    const [aliasResult, stockxResult] = await Promise.all([
      getAliasIntegration(activeToken),
      getStockXIntegration(activeToken),
    ])

    setAliasIntegration(aliasResult.integration)
    setStockxIntegration(stockxResult.integration)
  }

  async function handleSaveAliasIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      const result = await saveAliasIntegration(token, {
        email: aliasEmail,
        password: aliasPassword,
        apiKey: aliasApiKey,
      })
      setAliasIntegration(result.integration)
      setAliasPassword('')
      setAliasApiKey('')
      setMessage('Alias credentials saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save Alias credentials')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSaveStockXIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      const result = await saveStockXIntegration(token, {
        email: stockxEmail,
        apiKey: stockxApiKey,
        clientId: stockxClientId,
        clientSecret: stockxClientSecret,
      })
      setStockxIntegration(result.integration)
      setStockxClientSecret('')
      setMessage('StockX credentials saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save StockX credentials')
    } finally {
      setIsBusy(false)
    }
  }

  function handleStockXLogin() {
    if (!token) {
      return
    }

    const popup = window.open('about:blank', 'stockx_oauth', 'noopener,noreferrer,width=520,height=760')
    setIsBusy(true)
    setMessage('Opening StockX login...')

    void startStockXOAuth(token)
      .then((result) => {
        if (!result.authUrl) {
          throw new Error('StockX login URL missing from server')
        }

        if (popup && !popup.closed) {
          popup.location.replace(result.authUrl)
          popup.focus()
          setMessage('Finish StockX login in the popup window, then return here.')
          return
        }

        window.location.assign(result.authUrl)
      })
      .catch((error) => {
        popup?.close()
        setMessage(error instanceof Error ? error.message : 'Could not start StockX login')
      })
      .finally(() => {
        setIsBusy(false)
      })
  }

  async function handleDeleteAliasIntegration() {
    if (!token) {
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      await deleteAliasIntegration(token)
      setAliasIntegration(null)
      setMessage('Alias credentials removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove Alias credentials')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDeleteStockXIntegration() {
    if (!token) {
      return
    }

    setIsBusy(true)
    setMessage('')

    try {
      await deleteStockXIntegration(token)
      setStockxIntegration(null)
      setMessage('StockX credentials removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove StockX credentials')
    } finally {
      setIsBusy(false)
    }
  }

  function formatSize(size: number) {
    return Number.isInteger(size) ? String(size) : size.toFixed(1)
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
  ): Promise<ImageLookup | null> {
    if (!token) {
      setScreen('auth')
      return null
    }

    if (kind === 'image' && !apiKeys.some((record) => record.provider === 'gemini')) {
      setMessage('Add a Gemini API key in Settings before image lookup.')
      return null
    }

    setActiveLookupKind(kind)
    setIsBusy(true)
    setMessage(
      isDisplayApp && options?.captureRequest
        ? 'Processing Capture...'
        : isDisplayApp && options?.startStreamOnly
          ? kind === 'barcode'
            ? 'Preparing barcode lookup...'
            : 'Preparing image lookup...'
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
      syncActiveLookupKind(createdLookup)
      setLookup(createdLookup)
      if (isDisplayApp && options?.startStreamOnly) {
        setStreamPairLookupId(createdLookup.id)
      }
      setMessage(
        isDisplayApp && options?.captureRequest
          ? 'Processing Capture...'
          : isDisplayApp && options?.startStreamOnly
            ? kind === 'barcode'
              ? 'Ready for barcode. Tap Capture when you want a photo.'
              : 'Ready for image lookup. Tap Capture when you want a photo.'
          : isDisplayApp
            ? 'Waiting for Mobile Stream Pair'
            : kind === 'barcode'
              ? 'Scanning Barcode'
              : 'Looking Up Product',
      )
      return createdLookup
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not start ${kind} lookup`)
      return null
    } finally {
      setIsBusy(false)
    }
  }

  async function handleImageLookup(options?: { keepScreen?: boolean; captureRequest?: boolean; startStreamOnly?: boolean }) {
    return handleLookup('image', options)
  }

  async function handleBarcodeLookup(options?: { keepScreen?: boolean; captureRequest?: boolean; startStreamOnly?: boolean }) {
    return handleLookup('barcode', options)
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
  const awaitingCaptureTap = lookup?.status === 'pending'
    && (lookup.captureMode === 'stream_pair' || lookup.id === streamPairLookupId)
  const displayLookupStatus = !lookup
    ? 'Tap Capture to snap a photo.'
    : lookup.status === 'pending'
      ? awaitingCaptureTap
        ? 'Ready. Tap Capture to snap a photo.'
        : captureSessionActive
          ? 'Processing captured photo...'
          : message || 'Waiting for phone processing...'
      : lookup.status === 'processing'
        ? lookup.lookupType === 'barcode'
          ? 'Reading barcode...'
          : 'Identifying product...'
        : lookup.status === 'complete'
          ? 'Capture complete.'
          : lookup.error ?? 'Lookup failed'
  const isDisplayCaptureBusy = captureSessionActive
    || lookup?.status === 'processing'
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
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}bypass_red_square_image.png`}
            alt="Bypass Market Checker"
          />
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
          {!displayCaptureArmed && (
            <img
              className="home-brand-logo"
              src={`${import.meta.env.BASE_URL}bypass_red_square_image.png`}
              alt="Bypass Market Checker"
            />
          )}
          <div className="user-chip">{user?.email}</div>
          {isDisplayApp && displayCaptureArmed ? (
            <>
              {lookup?.status === 'complete' ? (
                renderLookupDetailCard(lookup, 'lookup-detail-card home-result')
              ) : lookup?.status === 'error' ? (
                <section
                  className="glass-card result-box home-result lookup-result-scroll"
                  aria-label="Lookup Error"
                  data-focusable
                  data-scrollable
                  tabIndex={0}
                >
                  <p>Lookup Failed</p>
                  <span>{lookup.error ?? 'Lookup failed'}</span>
                  {isDisplayApp && <p className="scroll-hint">Use up/down to scroll this result.</p>}
                </section>
              ) : isDisplayCaptureBusy ? (
                <section className="glass-card processing-card home-result" aria-label="Processing Capture">
                  <p className="eyebrow">{activeLookupKind === 'barcode' ? 'Barcode Lookup' : 'Image Lookup'}</p>
                  <h1 className="processing-title">
                    {lookup?.status === 'processing' && activeLookupKind === 'barcode'
                      ? 'Reading Barcode'
                      : lookup?.status === 'processing'
                        ? 'Identifying Product'
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

          {message && <p className="center-message settings-message">{message}</p>}

          <div className="key-list">
            {apiKeys.filter((record) => record.provider === 'gemini').length === 0 && <p>No API keys saved.</p>}
            {apiKeys.filter((record) => record.provider === 'gemini').map((record) => (
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

          <div className="integration-section">
            <div className="add-label">Alias (GOAT)</div>
            {aliasIntegration?.configured && (
              <p className="integration-status">
                Connected as {aliasIntegration.email ?? 'saved account'}
              </p>
            )}
            <form className="stack-form" onSubmit={handleSaveAliasIntegration}>
              <input
                data-focusable
                type="email"
                placeholder="Alias email"
                value={aliasEmail}
                onChange={(event) => setAliasEmail(event.target.value)}
              />
              <input
                data-focusable
                type="password"
                placeholder="Alias password"
                value={aliasPassword}
                onChange={(event) => setAliasPassword(event.target.value)}
              />
              <input
                data-focusable
                type="password"
                placeholder="Alias API key (authorization token)"
                value={aliasApiKey}
                onChange={(event) => setAliasApiKey(event.target.value)}
              />
              <button
                className="primary-button"
                type="submit"
                data-focusable
                disabled={isBusy || !aliasEmail.trim() || !aliasPassword.trim() || !aliasApiKey.trim()}
              >
                Save Alias
              </button>
            </form>
            {aliasIntegration?.configured && (
              <button
                className="text-button danger"
                type="button"
                data-focusable
                disabled={isBusy}
                onClick={() => void handleDeleteAliasIntegration()}
              >
                Remove Alias
              </button>
            )}
          </div>

          <div className="integration-section">
            <div className="add-label">StockX</div>
            {stockxIntegration?.configured && (
              <p className="integration-status">
                {stockxIntegration.email ?? 'Saved account'}
                {stockxIntegration.oauthConnected ? ' · OAuth connected' : ' · Login required'}
              </p>
            )}
            <form className="stack-form" onSubmit={handleSaveStockXIntegration}>
              <input
                data-focusable
                type="email"
                placeholder="StockX account email"
                value={stockxEmail}
                onChange={(event) => setStockxEmail(event.target.value)}
              />
              <input
                data-focusable
                type="password"
                placeholder="StockX x-api-key"
                value={stockxApiKey}
                onChange={(event) => setStockxApiKey(event.target.value)}
              />
              <input
                data-focusable
                type="text"
                placeholder="Client ID"
                value={stockxClientId}
                onChange={(event) => setStockxClientId(event.target.value)}
              />
              <input
                data-focusable
                type="password"
                placeholder="Client secret"
                value={stockxClientSecret}
                onChange={(event) => setStockxClientSecret(event.target.value)}
              />
              <button
                className="primary-button"
                type="submit"
                data-focusable
                disabled={
                  isBusy
                  || !stockxEmail.trim()
                  || !stockxApiKey.trim()
                  || !stockxClientId.trim()
                  || !stockxClientSecret.trim()
                }
              >
                Save StockX
              </button>
            </form>
            {stockxIntegration?.configured && (
              <>
                <button
                  className="primary-button ready-button"
                  type="button"
                  data-focusable
                  disabled={isBusy}
                  onClick={() => void handleStockXLogin()}
                >
                  Login to StockX
                </button>
                <p className="integration-note">
                  Register callback URL in StockX Developer Portal:
                  {' '}
                  {stockxIntegration.redirectUri ?? `${getApiBaseUrl()}/integrations/stockx/oauth/callback`}
                </p>
                <button
                  className="text-button danger"
                  type="button"
                  data-focusable
                  disabled={isBusy}
                  onClick={() => void handleDeleteStockXIntegration()}
                >
                  Remove StockX
                </button>
              </>
            )}
          </div>

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

      {feedbackLookup && (
        <div className="feedback-modal-backdrop" role="dialog" aria-modal="true" aria-label="Incorrect Feedback">
          <section className="feedback-modal glass-card">
            <p className="eyebrow">Incorrect Result</p>
            <h2>Help improve future matches</h2>
            <p>
              Optional: tell us what was wrong with the result. Notes help our systems get better over time.
            </p>
            <div className="feedback-input-wrap">
              <input
                data-focusable
                autoFocus
                type="text"
                inputMode="text"
                placeholder="Optional note"
                value={feedbackNote}
                onFocus={() => setFeedbackKeyboardOpen(true)}
                onClick={() => setFeedbackKeyboardOpen(true)}
                onChange={(event) => setFeedbackNote(event.target.value)}
              />
              <button
                className={`feedback-mic-button ${isListeningForFeedback ? 'listening' : ''} ${feedbackKeyboardFocus.row === -1 ? 'active' : ''}`}
                type="button"
                data-focusable
                aria-label="Dictate incorrect feedback note"
                onFocus={() => setFeedbackKeyboardFocus({ row: -1, col: 0 })}
                onPointerEnter={() => setFeedbackKeyboardFocus({ row: -1, col: 0 })}
                onPointerDown={() => setFeedbackKeyboardFocus({ row: -1, col: 0 })}
                onClick={startFeedbackDictation}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 18v3" />
                  <path d="M8 21h8" />
                </svg>
              </button>
            </div>
            {isListeningForFeedback && (
              <p className="feedback-listening-note">Listening...</p>
            )}
            {feedbackKeyboardOpen && (
              <div className="feedback-keyboard" aria-label="Feedback note keyboard">
                {FEEDBACK_KEYBOARD_ROWS.map((row, rowIndex) => (
                  <div className="feedback-keyboard-row" key={row.join('')}>
                    {row.map((key, colIndex) => {
                      const isActive = feedbackKeyboardFocus.row === rowIndex
                        && feedbackKeyboardFocus.col === colIndex
                      const isWide = key === 'Space' || key === 'Backspace' || key === 'Clear' || key === 'Done'

                      return (
                        <button
                          className={`feedback-key ${isActive ? 'active' : ''} ${isWide ? 'wide' : ''}`}
                          key={key}
                          type="button"
                          aria-label={key}
                          onFocus={() => setFeedbackKeyboardFocus({ row: rowIndex, col: colIndex })}
                          onPointerEnter={() => setFeedbackKeyboardFocus({ row: rowIndex, col: colIndex })}
                          onPointerDown={(event) => {
                            event.preventDefault()
                            setFeedbackKeyboardFocus({ row: rowIndex, col: colIndex })
                          }}
                          onClick={() => pressFeedbackKeyboardKey(key)}
                        >
                          {key}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
            <div className="feedback-modal-actions">
              <button
                className="primary-button"
                type="button"
                data-focusable
                onClick={() => void saveLookupFeedback(feedbackLookup, 'incorrect', feedbackNote)}
              >
                Save Incorrect
              </button>
              <button
                className="text-button"
                type="button"
                data-focusable
                onClick={closeIncorrectFeedback}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}

      {showConfetti && (
        <div className="confetti-layer" aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => (
            <span key={index} style={{ '--i': index } as CSSProperties} />
          ))}
        </div>
      )}
    </main>
  )
}

export default App
