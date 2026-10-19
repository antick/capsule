import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleSettingsUI
import SwiftUI
import Testing

/// The pictures in the README, from the sample readings: each theme's dock,
/// rings and gauges, and the card open. `scripts/readme-shots.py` frames
/// them for `docs/images`.
extension SnapshotTests {
  func readmeLook(
    _ preset: PlacementPreset, theme: HudTheme, style: MeterStyle, dock: DockStyleId = .rail,
    rings: DockRings = .sessionAndWeek
  ) -> DockLook {
    var look = look(preset, style: dock, theme: theme, count: Demo.snapshots.count)
    // Percent labels are off by default, so side docks are compact too.
    let m = look.spec.metrics
    look.spec.compact = true
    look.spec.railLength = railLengthForCount(m, Demo.snapshots.count, compact: true)
    look.rings = rings
    look.meterStyle = style
    return look
  }

  @Test func readmeGallery() async throws {
    let themes: [HudTheme] = [.midnight, .graphite, .ink, .aurora, .porcelain, .linen, .sage, .blush]
    for theme in themes {
      for style in MeterStyle.allCases {
        // Floating, so a grid of them reads without a screen edge.
        let look = readmeLook(.rightEdge, theme: theme, style: style, dock: .capsule)
        let name = "readme-\(theme.id.rawValue)-\(style.rawValue)-closed"
        _ = try await render(name, look: look, card: .closed, desktop: false)
      }
    }
    for theme in [HudTheme.midnight, .porcelain, .aurora, .linen] {
      for style in MeterStyle.allCases {
        let look = readmeLook(.rightEdge, theme: theme, style: style)
        let name = "readme-\(theme.id.rawValue)-\(style.rawValue)-open"
        _ = try await render(name, look: look, card: .sessions, desktop: false)
      }
    }
    let top = readmeLook(.topEdge, theme: .midnight, style: .rings)
    _ = try await render("readme-top-midnight", look: top, card: .open, desktop: false)
  }

  /// The Appearance page with no readings, so its preview runs on the
  /// sample readings and their own clock.
  @Test func readmeSettings() async throws {
    _ = NSApplication.shared
    for appearance in [NSAppearance.Name.aqua, .darkAqua] {
      var settings = CapsuleSettings.defaults
      settings.dockRings = .sessionAndWeek
      let model = SettingsModel(settings: settings, update: .initial(version: "0.1.0", canInstall: false))
      model.page = .appearance
      model.appearance = appearance == .darkAqua ? .dark : .light
      let host = NSHostingView(rootView: SettingsRoot(model: model))
      let window = NSWindow(
        contentRect: NSRect(x: -20_000, y: -20_000, width: 940, height: 1700), styleMask: [.titled],
        backing: .buffered, defer: false)
      window.isReleasedWhenClosed = false
      window.appearance = NSAppearance(named: appearance)
      window.contentView = host
      host.layoutSubtreeIfNeeded()
      try await Task.sleep(for: .milliseconds(400))
      let rep = try #require(host.bitmapImageRepForCachingDisplay(in: host.bounds))
      host.cacheDisplay(in: host.bounds, to: rep)
      let data = try #require(rep.representation(using: .png, properties: [:]))
      let name = "readme-settings-\(appearance == .darkAqua ? "dark" : "light").png"
      try FileManager.default.createDirectory(at: Self.output, withIntermediateDirectories: true)
      try data.write(to: Self.output.appendingPathComponent(name))
      window.close()
    }
  }
}
