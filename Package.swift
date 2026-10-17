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
  ],
  targets: [
    .target(name: "CapsuleCore"),
    .target(name: "CapsuleUsage", dependencies: ["CapsuleCore"]),
    .target(name: "CapsuleHUD", dependencies: ["CapsuleCore"]),
    .target(name: "CapsuleActivity", dependencies: ["CapsuleCore"]),
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
  ]
)
