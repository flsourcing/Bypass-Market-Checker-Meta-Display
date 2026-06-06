//
//  WearablesService.swift
//  BypassMarketChecker
//
//  Created by Jared Pullman on 6/6/26.
//

import Foundation
import MWDATCamera
import MWDATCore
import MWDATDisplay
import UIKit

@MainActor
final class WearablesService: ObservableObject {
    @Published private(set) var status = "Ready to register with Meta AI."
    @Published private(set) var registrationState = "Unknown"
    @Published private(set) var deviceCount = 0
    @Published private(set) var lastPhoto: UIImage?
    @Published private(set) var bestMatch: ProductMatch?
    @Published private(set) var isCameraStreamReady = false

    private var isConfigured = false
    private var session: DeviceSession?
    private var stream: MWDATCamera.Stream?
    private var display: Display?
    private var listenerTokens: [any AnyListenerToken] = []

    init() {
        configure()

        if isConfigured {
            observeWearables()
        }
    }

    func registerWithMetaAI() {
        guard let wearables = configuredWearables() else {
            return
        }

        Task {
            do {
                status = "Opening Meta AI registration..."
                try await wearables.startRegistration()
                status = "Finish registration in the Meta AI app, then return here."
            } catch RegistrationError.alreadyRegistered {
                registrationState = "registered"
                status = "Already registered with Meta AI. Tap Connect Glasses."
            } catch {
                status = "Registration failed: \(error.localizedDescription)"
            }
        }
    }

    func connectGlasses() {
        guard let wearables = configuredWearables() else {
            return
        }

        Task {
            do {
                status = "Checking camera permission..."
                var permission = try await wearables.checkPermissionStatus(.camera)

                if permission != .granted {
                    status = "Meta AI will ask for camera access. Choose Always Allow, then return here."
                    permission = try await wearables.requestPermission(.camera)
                }

                guard permission == .granted else {
                    status = "Camera permission was not granted. Tap Connect Glasses after allowing it in Meta AI."
                    return
                }

                if stream != nil {
                    status = "Camera stream is already ready. Tap Scan Product."
                    return
                }

                status = "Starting glasses session..."
                let selector = AutoDeviceSelector(wearables: wearables)
                let session = try wearables.createSession(deviceSelector: selector)
                self.session = session

                Task {
                    for await state in session.stateStream() {
                        await MainActor.run {
                            self.status = "Glasses session: \(state.description)"
                        }
                    }
                }

                try session.start()
                try await waitForStartedSession(session)

                status = "Starting camera stream..."
                let config = StreamConfiguration(
                    videoCodec: MWDATCamera.VideoCodec.raw,
                    resolution: .low,
                    frameRate: 15
                )

                guard let stream = try session.addStream(config: config) else {
                    status = "Could not start camera stream."
                    return
                }

                self.stream = stream
                attachStreamListeners(stream)
                await stream.start()
                isCameraStreamReady = true

                if let display = try? session.addDisplay() {
                    self.display = display
                    await display.start()
                    await sendReadyDisplay()
                } else {
                    status = "Camera connected. Display view is not available on this device/session."
                    return
                }

                status = "Connected. Point the glasses at a product and tap Scan Product."
            } catch {
                status = "Connection failed: \(error.localizedDescription)"
            }
        }
    }

    func captureProductPhoto() {
        guard let stream else {
            status = "Connect Glasses first, then wait for the camera stream to be ready."
            return
        }

        status = "Capturing photo from glasses..."
        let accepted = stream.capturePhoto(format: .jpeg)

        if !accepted {
            status = "Glasses did not accept the photo capture request."
        }
    }

    func handleCallback(url: URL) {
        guard let wearables = configuredWearables() else {
            return
        }

        Task {
            do {
                _ = try await wearables.handleUrl(url)
                status = "Meta AI registration callback handled."
            } catch {
                status = "Callback failed: \(error.localizedDescription)"
            }
        }
    }

    private func configure() {
        do {
            try Wearables.configure()
            isConfigured = true
            status = "Meta Wearables SDK configured."
        } catch {
            isConfigured = false
            status = "SDK configuration failed: \(error.localizedDescription)"
        }
    }

    private func configuredWearables() -> (any WearablesInterface)? {
        guard isConfigured else {
            status = "Meta Wearables SDK is not configured yet."
            return nil
        }

        return Wearables.shared
    }

    private func observeWearables() {
        guard let wearables = configuredWearables() else {
            return
        }

        Task {
            for await state in wearables.registrationStateStream() {
                await MainActor.run {
                    self.registrationState = state.description
                }
            }
        }

        Task {
            for await devices in wearables.devicesStream() {
                await MainActor.run {
                    self.deviceCount = devices.count
                }
            }
        }
    }

    private func waitForStartedSession(_ session: DeviceSession) async throws {
        if session.state == .started {
            return
        }

        for await state in session.stateStream() {
            if state == .started {
                return
            }

            if state == .stopped {
                throw DeviceSessionError.sessionAlreadyStopped
            }
        }
    }

    private func attachStreamListeners(_ stream: MWDATCamera.Stream) {
        let stateToken = stream.statePublisher.listen { state in
            Task { @MainActor in
                self.isCameraStreamReady = state == .streaming
                self.status = "Camera stream: \(String(describing: state))"
            }
        }

        let photoToken = stream.photoDataPublisher.listen { photoData in
            Task { @MainActor in
                self.lastPhoto = UIImage(data: photoData.data)
                self.bestMatch = ProductMatch(
                    title: "Photo captured from glasses",
                    sku: "SKU lookup pending",
                    confidence: 0
                )
                self.status = "Photo captured. Next step is real SKU lookup."
                await self.sendResultDisplay()
            }
        }

        let errorToken = stream.errorPublisher.listen { error in
            Task { @MainActor in
                self.status = "Camera stream error: \(error.localizedDescription)"
            }
        }

        listenerTokens.append(contentsOf: [stateToken, photoToken, errorToken])
    }

    private func sendReadyDisplay() async {
        guard let display else {
            return
        }

        let view = FlexBox(direction: .column, spacing: 12, padding: EdgeInsets(all: 16)) {
            MWDATDisplay.Text("Bypass Market Checker", style: .heading)
            MWDATDisplay.Text("Connected", style: .body)
            MWDATDisplay.Text("Point at a product and tap Scan on the phone.", style: .meta, color: .secondary)
        }

        try? await display.send(view)
    }

    private func sendResultDisplay() async {
        guard let display, let bestMatch else {
            return
        }

        let view = FlexBox(direction: .column, spacing: 12, padding: EdgeInsets(all: 16)) {
            MWDATDisplay.Text("Scan Captured", style: .heading)
            MWDATDisplay.Text(bestMatch.title, style: .body)
            MWDATDisplay.Text(bestMatch.sku, style: .meta, color: .secondary)
        }

        try? await display.send(view)
    }
}
