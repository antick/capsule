// swift-tools-version: 6.0
import PackageDescription

/// Capsule, native. Modules mirror the TypeScript workspace packages they
/// replace, so the port can be reviewed one package at a time.
///
/// `CapsuleActivity` and `CapsuleHUD` are not declared yet: both are gated on
/// their fixtures being extracted, and an empty module would only pretend
/// otherwise. See `openspec/changes/native-appkit-migration/tasks.md`.
let package = Package(
  name: "Capsule",
  platforms: [
    // The current macOS and the three before it: 14 Sonoma, 15 Sequoia, 26, 27.
    // Apple Silicon only — see design decision 11.
    .macOS(.v14)
  ],
  products: [
    .library(name: "CapsuleCore", targets: ["CapsuleCore"])
  ],
  targets: [
    .target(name: "CapsuleCore"),
    // Test support: reads the same JSON corpus the Vitest suites read.
    .target(name: "CapsuleFixtures"),
    .testTarget(
      name: "CapsuleCoreTests",
      dependencies: ["CapsuleCore", "CapsuleFixtures"]
    ),
  ]
)
