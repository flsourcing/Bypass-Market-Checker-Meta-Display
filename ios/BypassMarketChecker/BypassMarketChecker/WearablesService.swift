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

    private let wearables = Wearables.shared
    private var session: DeviceSession?
    private var stream: MWDATCamera.Stream?
    private var display: Display?
    private var listenerTokens: [any AnyListenerToken] = []

    init() {
        configure()
        observeWearables()
    }

    func registerWithMetaAI() {
        Task {
            do {
                status = "Opening Meta AI registration..."
                try await wearables.startRegistration()
                status = "Finish registration in the Meta AI app, then return here."
            } catch {
                status = "Registration failed: \(error.localizedDescription)"
            }
        }
    }

    func connectGlasses() {
        Task {
            do {
                status = "Requesting camera permission..."
                let permission = try await wearables.requestPermission(.camera)

                guard permission == .granted else {
                    status = "Camera permission was not granted in Meta AI."
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

                if let display = try? session.addDisplay() {
                    self.display = display
                    await display.start()
                    await sendReadyDisplay()
                }

                status = "Connected. Point the glasses at a product and tap Scan Product."
            } catch {
                status = "Connection failed: \(error.localizedDescription)"
            }
        }
    }

    func captureProductPhoto() {
        guard let stream else {
            status = "Connect glasses before scanning."
            return
        }

        status = "Capturing photo from glasses..."
        let accepted = stream.capturePhoto(format: .jpeg)

        if !accepted {
            status = "Glasses did not accept the photo capture request."
        }
    }

    func handleCallback(url: URL) {
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
            status = "Meta Wearables SDK configured."
        } catch {
            status = "SDK configuration failed: \(error.localizedDescription)"
        }
    }

    private func observeWearables() {
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
