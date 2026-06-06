import { useState } from 'react'
import './App.css'

type ScanMode = 'image-search' | 'barcode'

type BarcodeResult = {
  rawValue: string
  format: string
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[]
}) => {
  detect(image: ImageBitmapSource): Promise<BarcodeResult[]>
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

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
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [activeMode, setActiveMode] = useState<ScanMode | null>(null)
  const [status, setStatus] = useState('Ready to scan a product.')
  const [barcode, setBarcode] = useState<BarcodeResult | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setImageUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }

      return URL.createObjectURL(file)
    })
    setFileName(file.name)
    setActiveMode(null)
    setBarcode(null)
    setStatus('Photo loaded. Choose Image Search or Barcode Scan.')
  }

  const runImageSearch = () => {
    if (!imageUrl) {
      setStatus('Take or upload a product photo first.')
      return
    }

    setIsWorking(true)
    setActiveMode('image-search')
    setBarcode(null)
    setStatus('Looking for a likely product SKU...')

    window.setTimeout(() => {
      setIsWorking(false)
      setStatus(
        'Prototype result: replace this mock with a real vision/search API next.',
      )
    }, 650)
  }

  const runBarcodeScan = async () => {
    if (!imageUrl) {
      setStatus('Take or upload a product photo first.')
      return
    }

    setIsWorking(true)
    setActiveMode('barcode')
    setBarcode(null)
    setStatus('Scanning the image for Code 128 or UPC barcodes...')

    try {
      if (!window.BarcodeDetector) {
        setStatus(
          'Barcode scanning is not available in this browser yet. Try Chrome/Edge or add a ZXing fallback.',
        )
        return
      }

      const detector = new window.BarcodeDetector({
        formats: ['code_128', 'upc_a', 'upc_e', 'ean_13'],
      })
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const results = await detector.detect(bitmap)
      const code128 = results.find((result) => result.format === 'code_128')
      const firstResult = code128 ?? results[0]

      if (!firstResult) {
        setStatus('No barcode found. Try a brighter, closer photo of the tag.')
        return
      }

      setBarcode(firstResult)
      setStatus(`${firstResult.format.toUpperCase()} detected.`)
    } catch {
      setStatus('Barcode scan failed. Try another photo with the barcode centered.')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="app-title">
        <p className="eyebrow">Meta Ray-Ban Display prototype</p>
        <h1 id="app-title">Bypass Market Checker</h1>
        <p className="hero-copy">
          Snap a product, then search for likely SKUs or scan a barcode from the
          image. This first build is intentionally simple so we can wire in real
          marketplace data next.
        </p>

        <label className="scan-button">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
          />
          Scan Product
        </label>

        <p className="status" role="status">
          {isWorking ? 'Working...' : status}
        </p>
      </section>

      <section className="preview-card" aria-label="Current scan">
        {imageUrl ? (
          <img src={imageUrl} alt={`Product scan ${fileName}`} />
        ) : (
          <div className="empty-preview">
            <span>Camera Preview</span>
            <small>Take or upload a product photo to begin.</small>
          </div>
        )}
      </section>

      <section className="actions-grid" aria-label="Scan options">
        <button
          className="action-card"
          type="button"
          onClick={runImageSearch}
          disabled={isWorking}
        >
          <span>Image Search</span>
          <strong>Find SKU</strong>
          <small>Prototype Nike SKU match from the product photo.</small>
        </button>

        <button
          className="action-card"
          type="button"
          onClick={runBarcodeScan}
          disabled={isWorking}
        >
          <span>Barcode Scan</span>
          <strong>Flash UPC</strong>
          <small>Looks for Code 128, UPC, or EAN barcodes in the image.</small>
        </button>
      </section>

      {activeMode === 'image-search' && (
        <section className="result-card" aria-label="Image search results">
          <div>
            <p className="eyebrow">Best match</p>
            <h2>{sampleSkuMatches[0].title}</h2>
          </div>
          <div className="sku-pill">{sampleSkuMatches[0].sku}</div>
          <div className="match-list">
            {sampleSkuMatches.map((match) => (
              <div key={match.sku} className="match-row">
                <span>{match.title}</span>
                <strong>{match.sku}</strong>
                <small>{match.confidence}% confidence</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeMode === 'barcode' && (
        <section className="result-card barcode-result" aria-label="Barcode result">
          {barcode ? (
            <>
              <p className="eyebrow">{barcode.format.toUpperCase()}</p>
              <h2>{barcode.rawValue}</h2>
              <div className="flash-code">UPC</div>
            </>
          ) : (
            <>
              <p className="eyebrow">Barcode scanner</p>
              <h2>No code yet</h2>
              <p>Use a close, clear shot of the barcode label.</p>
            </>
          )}
        </section>
      )}

      <section className="next-steps">
        <h2>What needs to happen next</h2>
        <div>
          <p>
            For real glasses camera capture, we will connect Meta&apos;s native
            Device Access Toolkit through an iOS or Android companion app.
          </p>
          <p>
            For real SKU lookup, we will add a vision API that identifies the
            product, then query a market/search source for SKU and pricing data.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
