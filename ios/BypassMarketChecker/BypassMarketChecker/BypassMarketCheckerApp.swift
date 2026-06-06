//
//  BypassMarketCheckerApp.swift
//  BypassMarketChecker
//
//  Created by Jared Pullman on 6/6/26.
//

import SwiftUI

@main
struct BypassMarketCheckerApp: App {
    @StateObject private var wearables = WearablesService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(wearables)
                .onOpenURL { url in
                    wearables.handleCallback(url: url)
                }
        }
    }
}
