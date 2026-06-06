//
//  ContentView.swift
//  BypassMarketChecker
//
//  Created by Jared Pullman on 6/6/26.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var wearables: WearablesService

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.blue.opacity(0.18), Color.cyan.opacity(0.12), Color(.systemBackground)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        headerCard
                        scanCard
                        resultCard
                        nextStepsCard
                    }
                    .padding()
                }
            }
            .navigationTitle("Bypass Market Checker")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Meta Ray-Ban Display", systemImage: "eyeglasses")
                .font(.caption.weight(.bold))
                .foregroundStyle(.blue)
                .textCase(.uppercase)

            Text("Scan products and pull likely SKUs from the glasses camera.")
                .font(.title2.weight(.bold))

            Text("This iOS shell is ready for the Meta Wearables Device Access Toolkit connection, camera capture, and display result flow.")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
    }

    private var scanCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(wearables.status)
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Label("Registration: \(wearables.registrationState)", systemImage: "checkmark.seal")
                Label("Devices found: \(wearables.deviceCount)", systemImage: "eyeglasses")
                Label(
                    "Camera stream: \(wearables.isCameraStreamReady ? "ready" : "not ready")",
                    systemImage: wearables.isCameraStreamReady ? "camera.fill" : "camera"
                )
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            Button {
                wearables.registerWithMetaAI()
            } label: {
                Label("Register with Meta AI", systemImage: "link")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Button {
                wearables.connectGlasses()
            } label: {
                Label("Connect Glasses", systemImage: "eyeglasses")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Button {
                wearables.captureProductPhoto()
            } label: {
                Label("Scan Product", systemImage: "camera.viewfinder")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!wearables.isCameraStreamReady)

            HStack(spacing: 12) {
                scanOption(title: "Image Search", subtitle: "Find SKU", icon: "sparkle.magnifyingglass")
                scanOption(title: "Barcode Scan", subtitle: "Code 128 / UPC", icon: "barcode.viewfinder")
            }
        }
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
    }

    private var resultCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Best Match")
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            if let image = wearables.lastPhoto {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            }

            if let bestMatch = wearables.bestMatch {
                Text(bestMatch.title)
                    .font(.title3.weight(.bold))
                Text(bestMatch.sku)
                    .font(.system(.title2, design: .monospaced).weight(.heavy))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.green.opacity(0.22), in: Capsule())
                Text("\(bestMatch.confidence)% confidence")
                    .foregroundStyle(.secondary)
            } else {
                Text("No scan yet")
                    .font(.title3.weight(.bold))
                Text("Register, connect glasses, then tap Scan Product.")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
    }

    private var nextStepsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Native work next")
                .font(.headline)
            Text("The app can now start the DAT registration and glasses camera flow. The next piece is real barcode detection and image-to-SKU lookup after a photo comes back.")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
    }

    private func scanOption(title: String, subtitle: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.blue)
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }

}

struct ProductMatch {
    let title: String
    let sku: String
    let confidence: Int
}

#Preview {
    ContentView()
        .environmentObject(WearablesService())
}
