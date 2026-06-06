# Bypass Market Checker

A first prototype for a Meta Ray-Ban Display app that helps identify product SKUs from a photo.

## What this does today

- Shows a simple scan-first interface sized for a 600x600 glasses display.
- Lets you take or upload a product image.
- Provides an Image Search path with a mocked Nike Air Force 1 SKU result.
- Attempts barcode detection for Code 128, UPC, and EAN formats through the browser `BarcodeDetector` API.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
npm run build
```

## Meta glasses notes

Meta Ray-Ban Display Web Apps must be hosted on a public HTTPS URL. Good starter options are Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

For real glasses camera capture, this project will use Meta's native Wearables Device Access Toolkit in an iOS companion app. The current web prototype uses the browser file/camera picker so the flow can be tested before we wire up the native SDK.

## Next implementation steps

1. Follow `IOS_SETUP.md` to prepare the native iPhone companion app.
2. Register the app in Meta's Wearables Developer Center.
3. Enable Developer Mode in the Meta AI app.
4. Replace the mocked Image Search result with a real vision/search backend.
5. Add a barcode fallback library such as ZXing if the runtime does not support `BarcodeDetector`.
