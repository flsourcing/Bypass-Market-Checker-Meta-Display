import { useEffect, useRef, useState } from 'react'
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
  listLookupHistory,
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
  requestLookupDictation,
  getLookupDictation,
  cancelLookupDictation,
  searchCatalog,
  createTextLookup,
} from './api'
import type {
  ApiKeyRecord,
  CatalogSearchItem,
  DevicePairing,
  ImageLookup,
  IntegrationStatus,
  PairedDevice,
  User,
} from './api'

type Screen = 'auth' | 'home' | 'settings' | 'lookup' | 'text-lookup' | 'lookup-history'
type AuthMode = 'login' | 'register'
type LookupKind = 'image' | 'barcode'

const FEEDBACK_LETTER_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
  ['123', 'Space', '.', 'Clear', 'Done'],
]

const FEEDBACK_NUMBER_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '&', '*', '-', '_', '+', '=', '/'],
  ['.', ',', '?', '!', "'", '"', ':', ';', '(', ')'],
  ['ABC', 'Space', 'Backspace', 'Clear', 'Done'],
]

const FEEDBACK_KEYBOARD_WIDE_KEYS = new Set([
  'Shift', 'Backspace', 'Clear', 'Done', 'Space', '123', 'ABC',
])

function getFeedbackKeyboardRows(numbers: boolean) {
  return numbers ? FEEDBACK_NUMBER_ROWS : FEEDBACK_LETTER_ROWS
}

function getFeedbackKeyLabel(key: string, shift: boolean, numbers: boolean) {
  if (key.length === 1 && /[A-Z]/.test(key) && !numbers) {
    return shift ? key : key.toLowerCase()
  }

  if (key === 'Shift') {
    return shift ? 'SHIFT' : 'Shift'
  }

  return key
}

function App() {
  const isDisplayApp = window.location.pathname.toLowerCase().includes('/display-app')
  const lastFeedbackActivationRef = useRef({ target: '', at: 0 })
  const feedbackDictationPollRef = useRef<number | null>(null)
  const feedbackDictationLookupIdRef = useRef<string | null>(null)
  const feedbackDictationStartedAtRef = useRef(0)
  const feedbackKeyboardShiftRef = useRef(false)
  const textSearchShiftRef = useRef(false)
  const textSearchDebounceRef = useRef<number | null>(null)
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
  const [feedbackKeyboardShift, setFeedbackKeyboardShift] = useState(false)
  const [feedbackKeyboardNumbers, setFeedbackKeyboardNumbers] = useState(false)
  const [feedbackModalMessage, setFeedbackModalMessage] = useState('')
  const [isListeningForFeedback, setIsListeningForFeedback] = useState(false)
  const [textSearchQuery, setTextSearchQuery] = useState('')
  const [textSuggestions, setTextSuggestions] = useState<CatalogSearchItem[]>([])
  const [textSearchKeyboardOpen, setTextSearchKeyboardOpen] = useState(false)
  const [textSearchKeyboardFocus, setTextSearchKeyboardFocus] = useState({ row: 0, col: 0 })
  const [textSearchKeyboardShift, setTextSearchKeyboardShift] = useState(false)
  const [textSearchKeyboardNumbers, setTextSearchKeyboardNumbers] = useState(false)
  const [textSearchMessage, setTextSearchMessage] = useState('')
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)
  const [historyLookups, setHistoryLookups] = useState<ImageLookup[]>([])
  const [historyDetailLookup, setHistoryDetailLookup] = useState<ImageLookup | null>(null)
  const [historyDetailImageUrl, setHistoryDetailImageUrl] = useState<string | null>(null)
  const [historyThumbnailUrls, setHistoryThumbnailUrls] = useState<Record<string, string>>({})
  const [historyMessage, setHistoryMessage] = useState('')

  useEffect(() => {
    feedbackKeyboardShiftRef.current = feedbackKeyboardShift
  }, [feedbackKeyboardShift])

  useEffect(() => {
    textSearchShiftRef.current = textSearchKeyboardShift
  }, [textSearchKeyboardShift])
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
    if (feedbackLookup) {
      if (isDisplayApp) {
        setFeedbackKeyboardOpen(true)
        setFeedbackKeyboardFocus({ row: 0, col: 0 })
      }

      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.feedback-modal input')?.focus()
      })
      return
    }

    if (screen === 'text-lookup') {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.text-lookup-input')?.focus()
      })
      return
    }

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
  }, [screen, authMode, lookup?.status, isDisplayApp, displayCaptureArmed, feedbackLookup])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const textInputActive = Boolean(screen === 'text-lookup' && textSearchKeyboardOpen)
      const feedbackInputActive = Boolean(feedbackKeyboardOpen && feedbackLookup)

      if (textInputActive) {
        const keyboardRows = getFeedbackKeyboardRows(textSearchKeyboardNumbers)

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setTextSearchKeyboardFocus((current) => {
            const direction = event.key === 'ArrowDown' ? 1 : -1
            const nextRow = (current.row + direction + keyboardRows.length) % keyboardRows.length
            const nextCol = Math.min(current.col, keyboardRows[nextRow].length - 1)
            return { row: nextRow, col: nextCol }
          })
          return
        }

        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          setTextSearchKeyboardFocus((current) => {
            const rowLength = keyboardRows[current.row].length
            const direction = event.key === 'ArrowRight' ? 1 : -1
            const nextCol = (current.col + direction + rowLength) % rowLength
            return { ...current, col: nextCol }
          })
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          const key = keyboardRows[textSearchKeyboardFocus.row]?.[textSearchKeyboardFocus.col]
          if (key) {
            pressTextSearchKey(key)
          }
          return
        }
      }

      if (feedbackInputActive) {
        const keyboardRows = getFeedbackKeyboardRows(feedbackKeyboardNumbers)

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setFeedbackKeyboardFocus((current) => {
            if (current.row === -1) {
              return event.key === 'ArrowDown'
                ? { row: 0, col: Math.min(current.col, keyboardRows[0].length - 1) }
                : { row: keyboardRows.length - 1, col: 0 }
            }

            if (event.key === 'ArrowUp' && current.row === 0) {
              return { row: -1, col: 0 }
            }

            const direction = event.key === 'ArrowDown' ? 1 : -1
            const nextRow = (current.row + direction + keyboardRows.length) % keyboardRows.length
            const nextCol = Math.min(current.col, keyboardRows[nextRow].length - 1)
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

            const rowLength = keyboardRows[current.row].length
            const direction = event.key === 'ArrowRight' ? 1 : -1
            const nextCol = (current.col + direction + rowLength) % rowLength
            return { ...current, col: nextCol }
          })
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (feedbackKeyboardFocus.row === -1) {
            void startFeedbackDictation()
            return
          }

          const key = keyboardRows[feedbackKeyboardFocus.row]?.[feedbackKeyboardFocus.col]
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

      const focusableSelector = feedbackLookup
        ? '.feedback-modal [data-focusable]'
        : screen === 'text-lookup'
          ? (textSearchKeyboardOpen && isDisplayApp
            ? '.text-lookup-screen .text-lookup-toolbar [data-focusable], .text-lookup-screen .text-lookup-keyboard [data-focusable]'
            : '.text-lookup-screen [data-focusable]')
          : '[data-focusable]'
      const focusableElements = Array.from(
        document.querySelectorAll<HTMLElement>(focusableSelector),
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
  }, [
    feedbackKeyboardFocus,
    feedbackKeyboardOpen,
    feedbackKeyboardNumbers,
    feedbackLookup,
    isDisplayApp,
    screen,
    textSearchKeyboardFocus,
    textSearchKeyboardOpen,
    textSearchKeyboardNumbers,
  ])

  useEffect(() => {
    if (!token || screen !== 'lookup-history' || !historyDetailLookup) {
      return
    }

    if (historyDetailLookup.marketStatus !== 'loading') {
      return
    }

    const interval = window.setInterval(() => {
      void getImageLookup(token, historyDetailLookup.id)
        .then(({ lookup }) => {
          setHistoryDetailLookup(lookup)
          setHistoryLookups((items) => items.map((item) => (
            item.id === lookup.id ? lookup : item
          )))
        })
        .catch(() => {})
    }, 500)

    return () => window.clearInterval(interval)
  }, [historyDetailLookup?.id, historyDetailLookup?.marketStatus, screen, token])

  useEffect(() => {
    if (screen !== 'text-lookup' || !token) {
      return
    }

    if (textSearchDebounceRef.current) {
      window.clearTimeout(textSearchDebounceRef.current)
    }

    if (textSearchQuery.trim().length < 2) {
      setTextSuggestions([])
      return
    }

    textSearchDebounceRef.current = window.setTimeout(() => {
      void searchCatalog(token, textSearchQuery.trim(), 10)
        .then(({ items }) => {
          setTextSuggestions(items)
          setTextSearchMessage(items.length === 0 ? 'No matches yet. Keep typing or try another term.' : '')
        })
        .catch((error: unknown) => {
          setTextSuggestions([])
          setTextSearchMessage(error instanceof Error ? error.message : 'Could not search catalog')
        })
    }, 300)

    return () => {
      if (textSearchDebounceRef.current) {
        window.clearTimeout(textSearchDebounceRef.current)
      }
    }
  }, [screen, textSearchQuery, token])

  useEffect(() => () => {
    if (feedbackDictationPollRef.current) {
      window.clearInterval(feedbackDictationPollRef.current)
    }
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
    setDisplayMenuOpen(false)

    if (screen === 'settings' || screen === 'text-lookup' || screen === 'lookup-history') {
      setHistoryDetailLookup(null)
      setHistoryDetailImageUrl(null)
      setScreen('home')
      setMessage('')
      return
    }

    resetDisplayLookup()
  }

  function openDisplaySettings() {
    setDisplayMenuOpen(false)
    setMessage('')
    setScreen('settings')
  }

  function lookupSourceLabel(currentLookup: ImageLookup) {
    if (currentLookup.lookupType === 'text' || currentLookup.captureMode === 'text') {
      return 'Text search'
    }

    if (currentLookup.captureMode === 'mobile') {
      return 'Mobile search'
    }

    return 'Meta Glasses'
  }

  function summarizeHistoryEntry(currentLookup: ImageLookup) {
    if (currentLookup.status === 'error') {
      return {
        title: currentLookup.error ?? 'Lookup failed',
        detail: currentLookup.lookupType === 'barcode' ? 'Barcode lookup error' : 'Lookup error',
      }
    }

    if (currentLookup.lookupType === 'barcode') {
      const upc = currentLookup.result?.upc?.trim()
        ?? currentLookup.result?.sku?.trim()
      return {
        title: upc ? `UPC ${upc}` : 'No UPC found',
        detail: barcodeDetectionMethod(currentLookup.result?.notes),
      }
    }

    if (currentLookup.lookupType === 'text') {
      const sku = currentLookup.result?.sku?.trim() ?? ''
      const name = lookupProductName(currentLookup)
      return {
        title: sku ? `SKU ${sku}` : name,
        detail: name || 'Text search',
      }
    }

    const sku = currentLookup.result?.sku?.trim() ?? ''
    const name = lookupProductName(currentLookup)
    if (sku) {
      const accuracy = currentLookup.result?.confidence
        ? `${Math.round(currentLookup.result.confidence)}% accurate`
        : ''
      const detail = [name, accuracy].filter(Boolean).join(' · ')
      return {
        title: `SKU ${sku}`,
        detail: detail || 'Gemini image lookup',
      }
    }

    return {
      title: 'SKU Not found',
      detail: name || currentLookup.result?.notes || 'Gemini image lookup',
    }
  }

  function historyThumbnailSrc(currentLookup: ImageLookup) {
    return historyThumbnailUrls[currentLookup.id]
      ?? currentLookup.catalogImageUrl
      ?? null
  }

  async function loadHistoryThumbnails(lookups: ImageLookup[]) {
    if (!token) {
      return
    }

    const thumbnailEntries = await Promise.all(lookups.map(async (entry) => {
      if (entry.catalogImageUrl) {
        return [entry.id, entry.catalogImageUrl] as const
      }

      if (!entry.imageUrl) {
        return null
      }

      try {
        const blob = await fetchLookupImageBlob(token, entry.id)
        return [entry.id, URL.createObjectURL(blob)] as const
      } catch {
        return null
      }
    }))

    const nextThumbnails: Record<string, string> = {}
    for (const entry of thumbnailEntries) {
      if (entry) {
        nextThumbnails[entry[0]] = entry[1]
      }
    }

    setHistoryThumbnailUrls((current) => ({ ...current, ...nextThumbnails }))
  }

  async function openLookupHistory() {
    if (!token) {
      setMessage('Log in before opening lookup history.')
      return
    }

    setIsBusy(true)
    setHistoryMessage('')
    setDisplayMenuOpen(false)

    try {
      const { lookups } = await listLookupHistory(token)
      setHistoryLookups(lookups)
      setHistoryDetailLookup(null)
      setHistoryDetailImageUrl(null)
      setScreen('lookup-history')
      void loadHistoryThumbnails(lookups)
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Could not load lookup history')
    } finally {
      setIsBusy(false)
    }
  }

  async function openHistoryDetail(entry: ImageLookup) {
    if (!token) {
      return
    }

    setIsBusy(true)
    setHistoryMessage('')

    try {
      const { lookup: detailedLookup } = await getImageLookup(token, entry.id)
      setHistoryDetailLookup(detailedLookup)

      if (detailedLookup.imagePreview) {
        setHistoryDetailImageUrl(null)
      } else if (detailedLookup.catalogImageUrl) {
        setHistoryDetailImageUrl(detailedLookup.catalogImageUrl)
      } else if (detailedLookup.imageUrl) {
        const blob = await fetchLookupImageBlob(token, detailedLookup.id)
        setHistoryDetailImageUrl(URL.createObjectURL(blob))
      } else {
        setHistoryDetailImageUrl(null)
      }
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Could not open lookup detail')
    } finally {
      setIsBusy(false)
    }
  }

  function closeHistoryDetail() {
    if (historyDetailImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(historyDetailImageUrl)
    }

    setHistoryDetailLookup(null)
    setHistoryDetailImageUrl(null)
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
    setHistoryLookups((items) => items.map((item) => (
      item.id === currentLookup.id ? optimisticLookup : item
    )))
    setHistoryDetailLookup((detail) => (
      detail?.id === currentLookup.id ? optimisticLookup : detail
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
      const mergedLookup = updatedLookup.feedback ? updatedLookup : {
        ...updatedLookup,
        feedback: optimisticLookup.feedback,
      }

      setLookup((visibleLookup) => (
        visibleLookup?.id === currentLookup.id ? mergedLookup : visibleLookup
      ))
      setHistoryLookups((items) => items.map((item) => (
        item.id === currentLookup.id ? mergedLookup : item
      )))
      setHistoryDetailLookup((detail) => (
        detail?.id === currentLookup.id ? mergedLookup : detail
      ))
      setMessage(status === 'correct' ? 'Marked correct.' : 'Marked incorrect. Thanks for helping improve results.')
      if (status === 'correct') {
        triggerConfetti()
      }
    } catch (error) {
      setLookup((visibleLookup) => (
        visibleLookup?.id === currentLookup.id ? currentLookup : visibleLookup
      ))
      setHistoryLookups((items) => items.map((item) => (
        item.id === currentLookup.id ? currentLookup : item
      )))
      setHistoryDetailLookup((detail) => (
        detail?.id === currentLookup.id ? currentLookup : detail
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
    setFeedbackModalMessage('')
    setFeedbackKeyboardShift(false)
    setFeedbackKeyboardNumbers(false)
    setFeedbackKeyboardOpen(isDisplayApp)
    setFeedbackKeyboardFocus({ row: 0, col: 0 })
    feedbackDictationLookupIdRef.current = currentLookup.id
  }

  function stopFeedbackDictationPoll() {
    if (feedbackDictationPollRef.current) {
      window.clearInterval(feedbackDictationPollRef.current)
      feedbackDictationPollRef.current = null
    }
    setIsListeningForFeedback(false)
    feedbackDictationLookupIdRef.current = null
  }

  function closeIncorrectFeedback() {
    const lookupId = feedbackDictationLookupIdRef.current ?? feedbackLookup?.id
    if (token && lookupId && isListeningForFeedback) {
      void cancelLookupDictation(token, lookupId)
    }

    stopFeedbackDictationPoll()
    setFeedbackLookup(null)
    setFeedbackNote('')
    setFeedbackModalMessage('')
    setFeedbackKeyboardOpen(false)
    setFeedbackKeyboardShift(false)
    setFeedbackKeyboardNumbers(false)
  }

  function pressFeedbackKeyboardKey(key: string) {
    setFeedbackModalMessage('')

    if (key === 'Shift') {
      setFeedbackKeyboardShift((current) => !current)
      return
    }

    if (key === '123') {
      setFeedbackKeyboardNumbers(true)
      setFeedbackKeyboardFocus({ row: 0, col: 0 })
      return
    }

    if (key === 'ABC') {
      setFeedbackKeyboardNumbers(false)
      setFeedbackKeyboardFocus({ row: 0, col: 0 })
      return
    }

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

    if (key.length === 1 && /[A-Z]/.test(key)) {
      const useUpper = feedbackKeyboardShiftRef.current
      setFeedbackNote((current) => `${current}${useUpper ? key : key.toLowerCase()}`)
      return
    }

    setFeedbackNote((current) => `${current}${key}`)
  }

  function openTextLookup() {
    setDisplayMenuOpen(false)
    setTextSearchQuery('')
    setTextSuggestions([])
    setTextSearchMessage('')
    setTextSearchKeyboardShift(false)
    setTextSearchKeyboardNumbers(false)
    setTextSearchKeyboardOpen(isDisplayApp)
    setTextSearchKeyboardFocus({ row: 0, col: 0 })
    setMessage('')
    setScreen('text-lookup')

    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.text-lookup-input')?.focus()
    })
  }

  function closeTextLookup() {
    setScreen('home')
    setTextSearchQuery('')
    setTextSuggestions([])
    setTextSearchMessage('')
    setTextSearchKeyboardOpen(false)
  }

  function pressTextSearchKey(key: string) {
    if (key === 'Shift') {
      setTextSearchKeyboardShift((current) => !current)
      return
    }

    if (key === '123') {
      setTextSearchKeyboardNumbers(true)
      setTextSearchKeyboardFocus({ row: 0, col: 0 })
      return
    }

    if (key === 'ABC') {
      setTextSearchKeyboardNumbers(false)
      setTextSearchKeyboardFocus({ row: 0, col: 0 })
      return
    }

    if (key === 'Backspace') {
      setTextSearchQuery((current) => current.slice(0, -1))
      return
    }

    if (key === 'Clear') {
      setTextSearchQuery('')
      setTextSuggestions([])
      return
    }

    if (key === 'Done') {
      setTextSearchKeyboardOpen(false)
      if (isDisplayApp) {
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLElement>('.text-lookup-results')?.focus()
        })
      }
      return
    }

    if (key === 'Space') {
      setTextSearchQuery((current) => `${current} `)
      return
    }

    if (key.length === 1 && /[A-Z]/.test(key)) {
      const useUpper = textSearchShiftRef.current
      setTextSearchQuery((current) => `${current}${useUpper ? key : key.toLowerCase()}`)
      return
    }

    setTextSearchQuery((current) => `${current}${key}`)
  }

  async function performTextLookup(item: CatalogSearchItem) {
    if (!token) {
      setTextSearchMessage('Log in before running text lookup.')
      return
    }

    setIsBusy(true)
    setMessage('Loading market data...')
    setTextSearchMessage('')

    try {
      const { lookup: createdLookup } = await createTextLookup(token, {
        sku: item.sku,
        name: item.name,
        brand: item.brand,
        imageUrl: item.imageUrl,
      })
      setLookup(createdLookup)
      setActiveLookupKind(null)
      setDisplayCaptureArmed(true)
      setScreen('home')
      setTextSearchQuery('')
      setTextSuggestions([])
      setTextSearchKeyboardOpen(false)
      setMessage('Text lookup complete. Loading market prices...')
    } catch (error) {
      setTextSearchMessage(error instanceof Error ? error.message : 'Could not run text lookup')
    } finally {
      setIsBusy(false)
    }
  }

  function activateFeedbackTarget(target: string, action: () => void) {
    const now = Date.now()
    const lastActivation = lastFeedbackActivationRef.current

    if (lastActivation.target === target && now - lastActivation.at < 250) {
      return
    }

    lastFeedbackActivationRef.current = { target, at: now }
    action()
  }

  async function startFeedbackDictation() {
    if (!token || !feedbackLookup) {
      setFeedbackModalMessage('Log in before dictating a note.')
      return
    }

    if (isListeningForFeedback) {
      return
    }

    const lookupId = feedbackLookup.id
    feedbackDictationLookupIdRef.current = lookupId

    try {
      setFeedbackModalMessage('Connecting to iPhone microphone...')
      await requestLookupDictation(token, lookupId)
      setIsListeningForFeedback(true)
      setFeedbackModalMessage('Keep the iPhone app open, then speak your note.')
      feedbackDictationStartedAtRef.current = Date.now()

      feedbackDictationPollRef.current = window.setInterval(() => {
        void (async () => {
          const activeLookupId = feedbackDictationLookupIdRef.current
          if (!token || !activeLookupId) {
            stopFeedbackDictationPoll()
            return
          }

          try {
            const { dictation } = await getLookupDictation(token, activeLookupId)

            if (dictation.status === 'listening') {
              setFeedbackModalMessage('Listening on iPhone... speak now.')
            }

            if (dictation.status === 'complete' && dictation.transcript?.trim()) {
              const transcript = dictation.transcript.trim()
              setFeedbackNote((current) => [current.trim(), transcript].filter(Boolean).join(' '))
              setFeedbackModalMessage('')
              stopFeedbackDictationPoll()
              return
            }

            if (dictation.status === 'error' || dictation.error) {
              setFeedbackModalMessage(dictation.error ?? 'Dictation failed. Use the keyboard below.')
              stopFeedbackDictationPoll()
              return
            }

            if (dictation.status === 'cancelled') {
              setFeedbackModalMessage('Dictation cancelled.')
              stopFeedbackDictationPoll()
              return
            }

            if (Date.now() - feedbackDictationStartedAtRef.current > 20000) {
              await cancelLookupDictation(token, activeLookupId)
              setFeedbackModalMessage('Dictation timed out. Open the iPhone app and try again.')
              stopFeedbackDictationPoll()
            }
          } catch {
            setFeedbackModalMessage('Could not reach dictation service. Use the keyboard below.')
            stopFeedbackDictationPoll()
          }
        })()
      }, 500)
    } catch (error) {
      setFeedbackModalMessage(error instanceof Error ? error.message : 'Could not start dictation.')
      stopFeedbackDictationPoll()
    }
  }

  function renderLookupDetailCard(
    currentLookup: ImageLookup,
    className = 'lookup-detail-card',
    options?: { imageSrc?: string | null },
  ) {
    const imageSrc = options?.imageSrc ?? lookupImageSrc(currentLookup)
    const isBarcode = currentLookup.lookupType === 'barcode'
    const isText = currentLookup.lookupType === 'text'
    const catalogImage = currentLookup.catalogImageUrl ?? null
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
          ) : isText ? (
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
                <span>Method</span>
                <strong>Text search</strong>
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

        {(imageSrc || catalogImage || aliasImage) && (
          <div className="product-image-compare">
            {(imageSrc || catalogImage) && (
              <div className="product-image-card">
                <span>{isText ? 'Catalog' : 'Your Photo'}</span>
                <img
                  className="captured-preview captured-preview-below"
                  src={imageSrc || catalogImage || ''}
                  alt={isText ? 'Catalog product' : isBarcode ? 'Captured barcode' : 'Captured product'}
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

        {!imageSrc && !catalogImage && !aliasImage && !isText && (
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
        <div className="display-menu-wrap">
          <button
            className="display-menu-button"
            type="button"
            aria-label="Menu"
            aria-expanded={displayMenuOpen}
            data-focusable
            onClick={() => setDisplayMenuOpen((open) => !open)}
          >
            <span className="display-menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          {displayMenuOpen && (
            <div className="display-menu-panel" role="menu" aria-label="Display menu">
              <button
                className="display-menu-item"
                type="button"
                role="menuitem"
                data-focusable
                onClick={goDisplayHome}
              >
                Home
              </button>
              <button
                className="display-menu-item"
                type="button"
                role="menuitem"
                data-focusable
                onClick={openDisplaySettings}
              >
                Settings
              </button>
            </div>
          )}
        </div>
      )}

      {screen !== 'auth' && !isDisplayApp && (
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
              <section className={isDisplayApp ? 'lookup-actions-grid display-lookup-grid' : 'lookup-panel'}>
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

                <button
                  className="lookup-button"
                  type="button"
                  data-focusable
                  onClick={openTextLookup}
                  disabled={isBusy}
                >
                  Text Lookup
                </button>

                {isDisplayApp && (
                  <button
                    className="lookup-button"
                    type="button"
                    data-focusable
                    onClick={() => void openLookupHistory()}
                    disabled={isBusy}
                  >
                    Lookup History
                  </button>
                )}
              </section>
              {(needsKeyMessage || message) && (
                <p className="center-message">{message || needsKeyMessage}</p>
              )}
            </>
          )}
        </section>
      )}

      {screen === 'text-lookup' && (
        <section className="glass-card text-lookup-screen" aria-label="Text Lookup">
          <div className="text-lookup-toolbar">
            <div className="card-header">
              <div>
                <p className="eyebrow">Text Lookup</p>
                <h1>Search by name or SKU</h1>
              </div>
              <button className="text-button" type="button" data-focusable onClick={closeTextLookup}>
                Back
              </button>
            </div>

            {isDisplayApp && (
              <p className="feedback-glasses-hint">
                {textSearchKeyboardOpen
                  ? 'Type with the keyboard below. Tap Done to browse matches, then tap the search box to type again.'
                  : 'Scroll matches below or tap the search box to open the keyboard.'}
              </p>
            )}

            <div className="text-lookup-search-wrap">
              <input
                className="text-lookup-input"
                data-focusable
                autoFocus
                type="text"
                inputMode="search"
                readOnly={isDisplayApp}
                placeholder="Search product name or SKU"
                value={textSearchQuery}
                onFocus={() => {
                  if (isDisplayApp) {
                    setTextSearchKeyboardOpen(true)
                    setTextSearchKeyboardFocus({ row: 0, col: 0 })
                  }
                }}
                onClick={() => {
                  if (isDisplayApp) {
                    setTextSearchKeyboardOpen(true)
                    setTextSearchKeyboardFocus({ row: 0, col: 0 })
                  }
                }}
                onChange={(event) => setTextSearchQuery(event.target.value)}
              />
            </div>

            {textSearchMessage && (
              <p className="feedback-modal-message">{textSearchMessage}</p>
            )}
          </div>

          <div
            className={`text-lookup-results catalog-suggestions ${isDisplayApp && textSearchKeyboardOpen ? 'is-hidden' : ''}`}
            data-scrollable
            data-focusable
            tabIndex={0}
            aria-hidden={isDisplayApp && textSearchKeyboardOpen}
          >
            {textSuggestions.length === 0 && textSearchQuery.trim().length >= 2 && !textSearchMessage && (
              <p className="catalog-empty-note">Searching StockX and Alias...</p>
            )}
            {isDisplayApp && !textSearchKeyboardOpen && textSuggestions.length > 0 && (
              <p className="scroll-hint">Use up/down to scroll matches.</p>
            )}
            {textSuggestions.map((item) => (
              <button
                className="catalog-suggestion-row"
                key={item.id}
                type="button"
                data-focusable
                disabled={isBusy}
                onClick={() => void performTextLookup(item)}
              >
                {item.imageUrl ? (
                  <img className="catalog-suggestion-image" src={item.imageUrl} alt="" />
                ) : (
                  <div className="catalog-suggestion-image placeholder">?</div>
                )}
                <div className="catalog-suggestion-copy">
                  <strong>{item.name}</strong>
                  <span>{item.sku}</span>
                </div>
              </button>
            ))}
          </div>

          {textSearchKeyboardOpen && (
            <div className="feedback-keyboard text-lookup-keyboard" aria-label="Text search keyboard">
              {getFeedbackKeyboardRows(textSearchKeyboardNumbers).map((row, rowIndex) => (
                <div className="feedback-keyboard-row" key={`text-${textSearchKeyboardNumbers ? 'num' : 'alpha'}-${row.join('')}`}>
                  {row.map((key, colIndex) => {
                    const isActive = textSearchKeyboardFocus.row === rowIndex
                      && textSearchKeyboardFocus.col === colIndex
                    const isWide = FEEDBACK_KEYBOARD_WIDE_KEYS.has(key)
                    const isShiftActive = key === 'Shift' && textSearchKeyboardShift

                    return (
                      <button
                        className={`feedback-key ${isActive ? 'active' : ''} ${isWide ? 'wide' : ''} ${isShiftActive ? 'shift-active' : ''}`}
                        key={`text-${key}`}
                        type="button"
                        data-focusable
                        aria-label={key}
                        onFocus={() => setTextSearchKeyboardFocus({ row: rowIndex, col: colIndex })}
                        onPointerUp={() => activateFeedbackTarget(`text:${key}`, () => pressTextSearchKey(key))}
                        onClick={() => activateFeedbackTarget(`text:${key}`, () => pressTextSearchKey(key))}
                      >
                        {getFeedbackKeyLabel(key, textSearchKeyboardShift, textSearchKeyboardNumbers)}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {screen === 'lookup-history' && (
        <section className="glass-card lookup-history-screen" aria-label="Lookup History">
          {historyDetailLookup ? (
            <>
              <div className="card-header">
                <div>
                  <p className="eyebrow">Lookup History</p>
                  <h1>Lookup Detail</h1>
                </div>
                <button className="text-button" type="button" data-focusable onClick={closeHistoryDetail}>
                  Back
                </button>
              </div>

              {renderLookupDetailCard(historyDetailLookup, 'lookup-detail-card history-detail-card', {
                imageSrc: historyDetailLookup.imagePreview
                  ?? historyDetailImageUrl
                  ?? historyDetailLookup.catalogImageUrl,
              })}
            </>
          ) : (
            <>
              <div className="card-header">
                <div>
                  <p className="eyebrow">Lookup History</p>
                  <h1>Recent lookups</h1>
                </div>
                <button className="text-button" type="button" data-focusable onClick={goDisplayHome}>
                  Back
                </button>
              </div>

              {isDisplayApp && <p className="scroll-hint">Use up/down to scroll history.</p>}

              {historyMessage && (
                <p className="feedback-modal-message">{historyMessage}</p>
              )}

              {historyLookups.length === 0 ? (
                <p className="catalog-empty-note">No lookups yet.</p>
              ) : (
                <div className="lookup-history-list" data-scrollable data-focusable tabIndex={0}>
                  {historyLookups.map((entry) => {
                    const summary = summarizeHistoryEntry(entry)
                    const thumbnail = historyThumbnailSrc(entry)

                    return (
                      <article className="lookup-history-row" key={entry.id}>
                        <button
                          className="lookup-history-row-main"
                          type="button"
                          data-focusable
                          onClick={() => void openHistoryDetail(entry)}
                        >
                          {thumbnail ? (
                            <img className="lookup-history-thumb" src={thumbnail} alt="" />
                          ) : (
                            <div className="lookup-history-thumb placeholder">?</div>
                          )}

                          <div className="lookup-history-copy">
                            <span className="lookup-history-source">{lookupSourceLabel(entry)}</span>
                            <strong>{summary.title}</strong>
                            {summary.detail && <span>{summary.detail}</span>}
                            <span className="lookup-history-date">
                              {formatLookupDate(entry.updatedAt || entry.createdAt)}
                            </span>
                            {entry.marketData && entry.marketData.combined.length > 0 && (
                              <span className="lookup-history-market-note">StockX · Alias market loaded</span>
                            )}
                          </div>
                        </button>

                        <div className="lookup-history-feedback">
                          {entry.feedback ? (
                            <div className={`history-feedback-badge ${entry.feedback.status}`}>
                              <strong>{entry.feedback.status === 'correct' ? 'Correct' : 'Incorrect'}</strong>
                              {entry.feedback.status === 'incorrect' && entry.feedback.correction && (
                                <span>{entry.feedback.correction}</span>
                              )}
                            </div>
                          ) : (
                            <>
                              <span className="history-feedback-label">Needs feedback</span>
                              <button
                                className="mini-button history-feedback-correct"
                                type="button"
                                data-focusable
                                onClick={() => void saveLookupFeedback(entry, 'correct')}
                              >
                                Correct
                              </button>
                              <button
                                className="mini-button history-feedback-incorrect"
                                type="button"
                                data-focusable
                                onClick={() => openIncorrectFeedback(entry)}
                              >
                                Incorrect
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
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
            {isDisplayApp && (
              <p className="feedback-glasses-hint">
                Use arrows + select to type. Shift toggles upper case, 123 switches to numbers.
                Arrow up from the top row reaches the microphone (uses your iPhone).
              </p>
            )}
            <div className="feedback-input-wrap">
              <input
                data-focusable
                autoFocus
                type="text"
                inputMode="text"
                readOnly={isDisplayApp}
                placeholder="Optional note"
                value={feedbackNote}
                onFocus={() => {
                  setFeedbackKeyboardOpen(true)
                  if (isDisplayApp) {
                    setFeedbackKeyboardFocus({ row: 0, col: 0 })
                  }
                }}
                onClick={() => {
                  setFeedbackKeyboardOpen(true)
                  if (isDisplayApp) {
                    setFeedbackKeyboardFocus({ row: 0, col: 0 })
                  }
                }}
                onChange={(event) => setFeedbackNote(event.target.value)}
              />
              <button
                className={`feedback-mic-button ${isListeningForFeedback ? 'listening' : ''} ${feedbackKeyboardFocus.row === -1 ? 'active' : ''}`}
                type="button"
                data-focusable
                aria-label="Dictate incorrect feedback note"
                onFocus={() => setFeedbackKeyboardFocus({ row: -1, col: 0 })}
                onMouseEnter={() => setFeedbackKeyboardFocus({ row: -1, col: 0 })}
                onPointerEnter={() => setFeedbackKeyboardFocus({ row: -1, col: 0 })}
                onPointerDown={() => setFeedbackKeyboardFocus({ row: -1, col: 0 })}
                onPointerUp={() => activateFeedbackTarget('mic', () => { void startFeedbackDictation() })}
                onMouseUp={() => activateFeedbackTarget('mic', () => { void startFeedbackDictation() })}
                onTouchEnd={() => activateFeedbackTarget('mic', () => { void startFeedbackDictation() })}
                onClick={() => activateFeedbackTarget('mic', () => { void startFeedbackDictation() })}
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
              <p className="feedback-listening-note">Listening on iPhone...</p>
            )}
            {feedbackModalMessage && (
              <p className="feedback-modal-message">{feedbackModalMessage}</p>
            )}
            {feedbackKeyboardOpen && (
              <div className="feedback-keyboard" aria-label="Feedback note keyboard">
                {getFeedbackKeyboardRows(feedbackKeyboardNumbers).map((row, rowIndex) => (
                  <div className="feedback-keyboard-row" key={`${feedbackKeyboardNumbers ? 'num' : 'alpha'}-${row.join('')}`}>
                    {row.map((key, colIndex) => {
                      const isActive = feedbackKeyboardFocus.row === rowIndex
                        && feedbackKeyboardFocus.col === colIndex
                      const isWide = FEEDBACK_KEYBOARD_WIDE_KEYS.has(key)
                      const isShiftActive = key === 'Shift' && feedbackKeyboardShift

                      return (
                        <button
                          className={`feedback-key ${isActive ? 'active' : ''} ${isWide ? 'wide' : ''} ${isShiftActive ? 'shift-active' : ''}`}
                          key={key}
                          type="button"
                          aria-label={key}
                          onFocus={() => setFeedbackKeyboardFocus({ row: rowIndex, col: colIndex })}
                          onMouseEnter={() => setFeedbackKeyboardFocus({ row: rowIndex, col: colIndex })}
                          onPointerEnter={() => setFeedbackKeyboardFocus({ row: rowIndex, col: colIndex })}
                          onPointerDown={() => setFeedbackKeyboardFocus({ row: rowIndex, col: colIndex })}
                          onPointerUp={() => activateFeedbackTarget(`key:${key}`, () => pressFeedbackKeyboardKey(key))}
                          onMouseUp={() => activateFeedbackTarget(`key:${key}`, () => pressFeedbackKeyboardKey(key))}
                          onTouchEnd={() => activateFeedbackTarget(`key:${key}`, () => pressFeedbackKeyboardKey(key))}
                          onClick={() => activateFeedbackTarget(`key:${key}`, () => pressFeedbackKeyboardKey(key))}
                        >
                          {getFeedbackKeyLabel(key, feedbackKeyboardShift, feedbackKeyboardNumbers)}
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
