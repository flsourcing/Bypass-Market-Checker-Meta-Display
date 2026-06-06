# Bypass Market Checker

A Meta Ray-Ban Display Web App prototype for checking product SKUs from the glasses app grid.

## What this does today

- Runs as a hosted Web App that can be added in Meta AI.
- Uses a fixed 600x600 high-contrast layout for Meta Ray-Ban Display.
- Supports arrow-key/Enter navigation, matching Neural Band and captouch input.
- Shows demo Image Search and Barcode Scan result screens.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

For local glasses-style testing, open browser dev tools and set the viewport to `600 x 600`. Use arrow keys and Enter to move around.

## Build

```bash
npm run build
```

## Deploy

This repo includes a GitHub Pages workflow. After pushing to `main`, enable GitHub Pages:

1. Open the GitHub repo.
2. Go to Settings > Pages.
3. Set Source to GitHub Actions.
4. Wait for the `Deploy Web App` action to finish.

The expected hosted URL is:

```text
https://flsourcing.github.io/Bypass-Market-Checker-Meta-Display/
```

## Add to Meta Ray-Ban Display

Meta Ray-Ban Display Web Apps must be hosted on a public HTTPS URL.

1. Open the Meta AI app.
2. Make sure Developer Mode is enabled.
3. Open glasses settings.
4. Go to App Connections > Web Apps.
5. Tap Add a Web App.
6. Name it `Bypass Market Checker`.
7. Paste the hosted HTTPS URL.
8. Tap Connect.

The app should appear at the bottom of the glasses app grid. You can pin it for easier access.

## Platform Notes

Web Apps can access the display, Neural Band/captouch input, motion/orientation, location, and local storage. They do not provide direct glasses camera capture. Real image-to-SKU scanning will need a backend workflow or a separate native bridge later.

## Next implementation steps

1. Push this Web App and enable GitHub Pages.
2. Add the hosted URL in Meta AI > App Connections > Web Apps.
3. Replace the mocked Image Search result with a real vision/search backend.
4. Add a phone/backend capture path if real product photos are required.
