import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Screen = 'home' | 'choices' | 'image-search' | 'barcode' | 'setup'

const sampleSkuMatches = [
  {
    title: 'Nike Air Force 1 Low White',
    sku: 'CW2288-111',
    confidence: 72,
  },
  {
    title: 'Nike Air Force 1 07 White',
    sku: '315122-111',
    confidence: 61,
  },
]

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [status, setStatus] = useState('Ready on Meta Ray-Ban Display.')
  const focusableRefs = useRef<Array<HTMLButtonElement | null>>([])

  const actions = useMemo(
    () => [
      {
        id: 'scan',
        label: 'Scan Product',
        detail: 'Open scan options',
        onSelect: () => {
          setScreen('choices')
          setStatus('Choose Image Search or Barcode Scan.')
        },
      },
      {
        id: 'image',
        label: 'Image Search',
        detail: 'Demo SKU match',
        onSelect: () => {
          setScreen('image-search')
          setStatus('Demo image result loaded.')
        },
      },
      {
        id: 'barcode',
        label: 'Barcode Scan',
        detail: 'Demo UPC result',
        onSelect: () => {
          setScreen('barcode')
          setStatus('Demo barcode result loaded.')
        },
      },
      {
        id: 'setup',
        label: 'Setup',
        detail: 'How this runs',
        onSelect: () => {
          setScreen('setup')
          setStatus('This is the glasses Web App path.')
        },
      },
    ],
    [],
  )

  useEffect(() => {
    focusableRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentIndex = focusableRefs.current.findIndex(
        (element) => element === document.activeElement,
      )

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % actions.length
        focusableRefs.current[nextIndex]?.focus()
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const nextIndex =
          currentIndex <= 0 ? actions.length - 1 : currentIndex - 1
        focusableRefs.current[nextIndex]?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions.length])

  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="app-title">
        <p className="eyebrow">Meta Ray-Ban Display Web App</p>
        <h1 id="app-title">Bypass Market Checker</h1>
        <p className="hero-copy">
          Launch this from the glasses app grid. Use Neural Band or temple input
          to move through scan options and show quick market-check results.
        </p>
        <p className="status" role="status">
          {status}
        </p>
      </section>

      <section className="display-card" aria-label="Current app state">
        {screen === 'home' && (
          <div className="display-state">
            <span className="display-icon">⌁</span>
            <h2>Ready to check</h2>
            <p>Press Enter on Scan Product to begin.</p>
          </div>
        )}

        {screen === 'choices' && (
          <div className="display-state">
            <span className="display-icon">⌕</span>
            <h2>Pick a scan mode</h2>
            <p>Image Search finds likely SKUs. Barcode Scan flashes UPC data.</p>
          </div>
        )}

        {screen === 'setup' && (
          <div className="display-state">
            <span className="display-icon">◎</span>
            <h2>Runs as Web App</h2>
            <p>Add the HTTPS URL in Meta AI → App Connections → Web Apps.</p>
          </div>
        )}

        {screen === 'image-search' && (
          <div className="display-state result-state">
            <p className="eyebrow">Best match</p>
            <h2>{sampleSkuMatches[0].title}</h2>
            <div className="sku-pill">{sampleSkuMatches[0].sku}</div>
            <p>Demo result. Real SKU search will need a vision/backend API.</p>
          </div>
        )}

        {screen === 'barcode' && (
          <div className="display-state result-state">
            <p className="eyebrow">Barcode demo</p>
            <h2>012345678905</h2>
            <div className="flash-code">UPC</div>
            <p>Browser barcode capture is limited on glasses Web Apps.</p>
          </div>
        )}
      </section>

      <section className="actions-grid" aria-label="Scan options">
        {actions.map((action, index) => (
          <button
            key={action.id}
            ref={(element) => {
              focusableRefs.current[index] = element
            }}
            className="action-card focusable"
            type="button"
            onClick={action.onSelect}
          >
            <span>{action.label}</span>
            <strong>{action.detail}</strong>
          </button>
        ))}
      </section>
    </main>
  )
}

export default App
