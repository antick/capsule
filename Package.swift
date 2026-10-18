// swift-tools-version: 6.0
import PackageDescription

/// Capsule, native. Modules mirror the TypeScript workspace packages they
/// replace, so the port can be reviewed one package at a time.
///
let package = Package(
  name: "Capsule",
  platforms: [
    // The current macOS and the three before it: 14 Sonoma, 15 Sequoia, 26, 27.
    // Apple Silicon only — see design decision 11.
    .macOS(.v14)
  ],
  products: [
    .library(name: "CapsuleCore", targets: ["CapsuleCore"]),
    .library(name: "CapsuleUsage", targets: ["CapsuleUsage"]),
    .library(name: "CapsuleHUD", targets: ["CapsuleHUD"]),
    .library(name: "CapsuleActivity", targets: ["CapsuleActivity"]),
    .library(name: "CapsuleSystem", targets: ["CapsuleSystem"]),
    .executable(name: "CapsuleApp", targets: ["CapsuleApp"]),
  ],
  targets: [
    .target(name: "CapsuleCore"),
    .target(name: "CapsuleUsage", dependencies: ["CapsuleCore"]),
    .target(name: "CapsuleHUD", dependencies: ["CapsuleCore"]),
    .target(name: "CapsuleActivity", dependencies: ["CapsuleCore"]),
    // The real Mac behind the logic modules' host seams: files, processes,
    // SQLite, the keychain, commands and the network. The only module that
    // touches the machine.
    .target(
      name: "CapsuleSystem",
      dependencies: ["CapsuleCore", "CapsuleUsage", "CapsuleActivity"],
      linkerSettings: [.linkedLibrary("sqlite3")]
    ),
    // The dock: its behaviour, its layers and its card, drawn from CapsuleHUD.
    .target(
      name: "CapsuleDock",
      dependencies: ["CapsuleCore", "CapsuleHUD", "CapsuleUsage"]
    ),
    // Settings and onboarding, in SwiftUI.
    .target(
      name: "CapsuleSettingsUI",
      dependencies: ["CapsuleCore", "CapsuleHUD", "CapsuleDock"]
    ),
    // The AppKit shell: the dock's panel, the menu-bar item, and the Mac's
    // timers and notifications driving the logic modules on the real hosts.
    .target(
      name: "CapsuleShell",
      dependencies: [
        "CapsuleCore", "CapsuleUsage", "CapsuleHUD", "CapsuleActivity", "CapsuleSystem", "CapsuleDock",
        "CapsuleSettingsUI",
      ]
    ),
    // The app itself. `scripts/bundle-macos.sh` wraps it in Capsule.app with
    // `Support/CapsuleApp/Info.plist`.
    .executableTarget(
      name: "CapsuleApp", dependencies: ["CapsuleCore", "CapsuleShell", "CapsuleSystem", "CapsuleSettingsUI"]
    ),
    // Test support: reads the same JSON corpus the Vitest suites read.
    .target(name: "CapsuleFixtures"),
    .testTarget(
      name: "CapsuleCoreTests",
      dependencies: ["CapsuleCore", "CapsuleFixtures"]
    ),
    .testTarget(
      name: "CapsuleUsageTests",
      dependencies: ["CapsuleUsage", "CapsuleFixtures"]
    ),
    .testTarget(
      name: "CapsuleHUDTests",
      dependencies: ["CapsuleHUD", "CapsuleFixtures"]
    ),
    .testTarget(
      name: "CapsuleActivityTests",
      dependencies: ["CapsuleActivity", "CapsuleFixtures"]
    ),
    .testTarget(name: "CapsuleSystemTests", dependencies: ["CapsuleSystem"]),
    .testTarget(name: "CapsuleDockTests", dependencies: ["CapsuleDock", "CapsuleCore", "CapsuleHUD"]),
    // Renders the dock in every style, edge, theme and card state to PNG under
    // `.build/snapshots`, for eyes and for the reference comparison.
    .testTarget(
      name: "CapsuleSnapshotTests",
      dependencies: ["CapsuleDock", "CapsuleCore", "CapsuleHUD", "CapsuleShell", "CapsuleSettingsUI"]
    ),
    .testTarget(
      name: "CapsuleShellTests",
      dependencies: ["CapsuleShell", "CapsuleCore", "CapsuleHUD", "CapsuleDock"]
    ),
  ]
)
