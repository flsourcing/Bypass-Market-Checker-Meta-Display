import { useEffect, useRef } from 'react'
import './App.css'

function App() {
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
        >
          Image Lookup
        </button>

        <button
          ref={(element) => {
            focusableRefs.current[1] = element
          }}
          className="lookup-button"
          type="button"
        >
          Barcode Lookup
        </button>
      </section>
    </main>
  )
}

export default App
