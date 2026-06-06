# iOS Companion Setup

Bypass Market Checker will use an iPhone companion app for real Meta glasses camera access. The React web app in this repo is still useful as the fast UI prototype, but the production glasses camera flow needs Meta's iOS Wearables Device Access Toolkit.

## What you need installed

- A Mac with Xcode installed.
- An Apple Developer account for running on a real iPhone.
- The Meta AI app on the iPhone paired to your glasses.
- Meta Ray-Ban Display glasses updated to the required developer firmware.

## Meta setup

1. Open the Meta AI app on your iPhone.
2. Go to Settings > App Info.
3. Tap the app version five times to enable Developer Mode.
4. Register the iOS app in Meta's Wearables Developer Center.
5. Pair the glasses to the same phone that will run the Xcode build.

## Xcode project direction

Create a new SwiftUI iOS app named `BypassMarketChecker`.

Add Meta's iOS SDK package in Xcode:

```text
https://github.com/facebook/meta-wearables-dat-ios
```

The app will eventually use these SDK pieces:

- `MWDATCore` to configure the SDK and create the glasses session.
- `MWDATCamera` to capture photos from the glasses.
- `MWDATDisplay` to send simple result screens back to the glasses display.

Enable the DAT App Model in `Info.plist`:

```xml
<key>MWDAT</key>
<dict>
  <key>DAMEnabled</key>
  <true/>
</dict>
```

## First native flow

1. Start the iOS app.
2. Configure the Meta Wearables SDK.
3. Create and start a device session.
4. Start a camera stream.
5. Capture a still photo when the user taps Scan.
6. Send the image to the SKU lookup backend.
7. Show the SKU result in the iPhone app and on the glasses display.

## Display result shape

The glasses display should stay simple:

```swift
let view = FlexBox(direction: .column, spacing: 12) {
    Text("Bypass Market Checker", style: .heading)
    Text("Nike Air Force 1 Low White", style: .body)
    Text("SKU: CW2288-111", style: .meta)
}
try await display.send(view)
```

## Backend still needed

Image Search is mocked in the web prototype. For a real SKU result, we need a backend endpoint that accepts a product image and returns:

```json
{
  "title": "Nike Air Force 1 Low White",
  "sku": "CW2288-111",
  "confidence": 0.72,
  "source": "vision-search"
}
```

Good first options are OpenAI vision, Google Vision/Product Search, or a custom flow that detects the item name and searches marketplace/product databases.
