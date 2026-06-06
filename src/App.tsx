import { useEffect, useRef, useState } from 'react'
import './App.css'

type LookupMode = 'image' | 'barcode' | null

function App() {
  const [lookupMode, setLookupMode] = useState<LookupMode>(null)
  const focusableRefs = useRef<Array<HTMLButtonElement | null>>([])

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
        const nextIndex = currentIndex <= 0 ? 1 : 0
        focusableRefs.current[nextIndex]?.focus()
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const nextIndex = currentIndex <= 0 ? 1 : 0
        focusableRefs.current[nextIndex]?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <main className="app-shell">
      <section className="lookup-panel" aria-label="Bypass Market Checker">
        <button
          ref={(element) => {
            focusableRefs.current[0] = element
          }}
          className="lookup-button"
          type="button"
          onClick={() => setLookupMode('image')}
        >
          Image Lookup
        </button>

        <button
          ref={(element) => {
            focusableRefs.current[1] = element
          }}
          className="lookup-button"
          type="button"
          onClick={() => setLookupMode('barcode')}
        >
          Barcode Lookup
        </button>

        <p className="lookup-status" aria-live="polite">
          {lookupMode === 'image' && 'Image lookup selected'}
          {lookupMode === 'barcode' && 'Barcode lookup selected'}
          {lookupMode === null && 'Select a lookup mode'}
        </p>
      </section>
    </main>
  )
}

export default App
