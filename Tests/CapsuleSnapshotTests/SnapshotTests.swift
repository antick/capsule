import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD
import CapsuleSettingsUI
import Foundation
import SwiftUI
import Testing

/// Renders the real dock view offscreen and writes each state to a PNG, so a
/// change to the drawing can be looked at rather than imagined.
@MainActor
@Suite("Dock snapshots", .serialized)
struct SnapshotTests {
  static let output: URL = {
    var url = URL(fileURLWithPath: #filePath)
    while url.path != "/", !FileManager.default.fileExists(atPath: url.appendingPathComponent("Package.swift").path) {
      url.deleteLastPathComponent()
    }
    return url.appendingPathComponent(".build/snapshots", isDirectory: true)
  }()

  enum Card { case closed, open, notices, sessions, unauthenticated, stale }

  static let presets: [PlacementPreset] = [.rightEdge, .leftEdge, .topEdge, .bottomEdge]

  func look(_ preset: PlacementPreset, style: DockStyleId, theme: HudTheme, count: Int) -> DockLook {
    let m = hudMetrics()
    let layout = layoutForPreset(preset)
    let style = DockStyle.of(style)
    let compact = layout.orientation == .horizontal
    return DockLook(
      spec: FrameSpec(
        metrics: m, style: style, growth: layout.cardGrowth, notch: layout.notch && styleSupportsNotch(style),
        compact: compact, railLength: railLengthForCount(m, count, compact: compact), railBias: nil, joined: nil
      ),
      theme: theme, display: .used, demoNow: Demo.now
    )
  }

  func render(_ name: String, look: DockLook, card: Card, peek: Bool = false) async throws -> NSBitmapImageRep {
    _ = NSApplication.shared
    let behavior = DockBehavior(clock: MainClock())
    let view = DockView(look: look, behavior: behavior)
    var inputs = DockBehavior.Inputs()
    var readings = Demo.snapshots
    switch card {
    case .unauthenticated:
      readings[0] = UsageSnapshot(
        providerId: .claude, displayName: "Claude", iconId: .claude, primaryPercent: nil, buckets: [],
        status: .unauthenticated, fetchedAt: isoString(Demo.now))
    case .stale:
      readings[0].status = .stale
      readings[0].staleSince = isoString(Demo.now.addingTimeInterval(-3600))
      readings[1].refreshing = true
    case .sessions:
      let since = isoString(Demo.now.addingTimeInterval(-25 * 60))
      inputs.activity = [
        .claude: [
          AgentSession(id: "a", providerId: .claude, name: "capsule", detail: "Terminal", state: .busy, waitingFor: nil, since: since),
          AgentSession(
            id: "b", providerId: .claude, name: "egglify", detail: "VS Code", state: .waiting,
            waitingFor: "Approve a command", since: since),
        ]
      ]
      inputs.tokens = [
        .claude: TokenUsage(providerId: .claude, todayTokens: 1_250_000, monthTokens: 48_600_000, scannedAt: isoString(Demo.now))
      ]
    default: break
    }
    inputs.snapshots = readings
    inputs.autoHide = peek
    if card != .closed, card != .notices { inputs.forceOpen = .claude }
    behavior.update(inputs)
    if card == .notices {
      behavior.updateNotices([
        ActivityNotice(id: "1", sessionId: "a", providerId: .claude, title: "Fix the poller loop", kind: .completed, at: isoString(Demo.now), summary: "All tests pass"),
        ActivityNotice(id: "2", sessionId: "b", providerId: .claude, title: "Port the settings window", kind: .waiting, at: isoString(Demo.now)),
      ])
    }
    view.settle()
    let window = NSWindow(
      contentRect: NSRect(origin: NSPoint(x: -20_000, y: -20_000), size: view.frameSize),
      styleMask: .borderless, backing: .buffered, defer: false)
    window.isOpaque = false
    window.isReleasedWhenClosed = false
    window.backgroundColor = .clear
    window.contentView = view
    view.frame = NSRect(origin: .zero, size: view.frameSize)
    window.appearance = NSAppearance(named: look.theme.appearance == .dark ? .darkAqua : .aqua)
    view.layoutSubtreeIfNeeded()
    view.settle()
    // Let SwiftUI lay the card out before the layers are drawn.
    try await Task.sleep(for: .milliseconds(250))
    view.settle()
    let scale = 2.0
    let size = view.frameSize
    let rep = try #require(
      NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: Int(size.width * scale), pixelsHigh: Int(size.height * scale),
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
        bytesPerRow: 0, bitsPerPixel: 0))
    let context = try #require(NSGraphicsContext(bitmapImageRep: rep))
    let cg = context.cgContext
    // A desktop to read the shadows and the surface against.
    cg.setFillColor(look.theme.appearance == .dark ? CGColor(gray: 0.45, alpha: 1) : CGColor(gray: 0.82, alpha: 1))
    cg.fill(CGRect(x: 0, y: 0, width: size.width * scale, height: size.height * scale))
    // The dock draws y-down; the bitmap is y-up.
    cg.translateBy(x: 0, y: size.height * scale)
    cg.scaleBy(x: scale, y: -scale)
    try #require(view.layer).render(in: cg)
    try FileManager.default.createDirectory(at: Self.output, withIntermediateDirectories: true)
    let data = try #require(rep.representation(using: .png, properties: [:]))
    try data.write(to: Self.output.appendingPathComponent("\(name).png"))
    window.close()
    return rep
  }

  @Test func everyEdgeStyleAndTheme() async throws {
    for preset in Self.presets {
      for style in DockStyleId.allCases {
        for theme in [HudTheme.midnight, .porcelain] {
          let name = "\(preset.rawValue)-\(style.rawValue)-\(theme.id.rawValue)"
          let rep = try await render(name, look: look(preset, style: style, theme: theme, count: 3), card: .open)
          #expect(rep.pixelsWide > 0)
        }
      }
    }
  }

  @Test func everyCardState() async throws {
    for theme in [HudTheme.midnight, .graphite, .ink, .aurora, .porcelain, .linen, .sage, .blush] {
      let base = look(.rightEdge, style: .rail, theme: theme, count: 3)
      for (card, label) in [
        (Card.closed, "closed"), (.open, "open"), (.notices, "notices"), (.sessions, "sessions"),
        (.unauthenticated, "unauthenticated"), (.stale, "stale"),
      ] {
        _ = try await render("right-edge-\(label)-\(theme.id.rawValue)", look: base, card: card)
      }
      _ = try await render("right-edge-latch-\(theme.id.rawValue)", look: base, card: .closed, peek: true)
    }
  }
}

/// The settings window's pages, rendered the way the window draws them.
@MainActor
@Suite("Settings snapshots", .serialized)
struct SettingsSnapshotTests {
  @Test func everyPage() async throws {
    _ = NSApplication.shared
    for appearance in [NSAppearance.Name.aqua, .darkAqua] {
      for page in SettingsPage.allCases {
        let model = SettingsModel(settings: .defaults, update: .initial(version: "0.1.0", canInstall: false))
        model.snapshots = Demo.snapshots
        model.page = page
        model.appearance = appearance == .darkAqua ? .dark : .light
        let host = NSHostingView(rootView: SettingsRoot(model: model))
        let window = NSWindow(
          contentRect: NSRect(x: -20_000, y: -20_000, width: 940, height: 1400), styleMask: [.titled],
          backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.appearance = NSAppearance(named: appearance)
        window.contentView = host
        host.layoutSubtreeIfNeeded()
        try await Task.sleep(for: .milliseconds(400))
        let rep = try #require(host.bitmapImageRepForCachingDisplay(in: host.bounds))
        host.cacheDisplay(in: host.bounds, to: rep)
        let data = try #require(rep.representation(using: .png, properties: [:]))
        let name = "settings-\(page.rawValue)-\(appearance == .darkAqua ? "dark" : "light").png"
        try FileManager.default.createDirectory(at: SnapshotTests.output, withIntermediateDirectories: true)
        try data.write(to: SnapshotTests.output.appendingPathComponent(name))
        window.close()
      }
    }
  }
}

@MainActor
@Suite("Settings controls")
struct SettingsControlTests {
  /// Every switch on the General page, top to bottom, as AppKit holds it.
  func switches(_ settings: CapsuleSettings) async throws -> [NSControl.StateValue] {
    _ = NSApplication.shared
    let model = SettingsModel(settings: settings, update: .initial(version: "0.1.0", canInstall: false))
    model.page = .general
    let host = NSHostingView(rootView: SettingsRoot(model: model))
    let window = NSWindow(
      contentRect: NSRect(x: -20_000, y: -20_000, width: 940, height: 1400), styleMask: [.titled],
      backing: .buffered, defer: false)
    window.isReleasedWhenClosed = false
    window.contentView = host
    host.layoutSubtreeIfNeeded()
    try await Task.sleep(for: .milliseconds(400))
    defer { window.close() }
    func all(_ view: NSView) -> [NSSwitch] { (view as? NSSwitch).map { [$0] } ?? view.subviews.flatMap(all) }
    return all(host).sorted { $0.convert($0.bounds, to: nil).maxY > $1.convert($1.bounds, to: nil).maxY }.map(\.state)
  }

  @Test func theGeneralPagesSwitchesShowTheSettings() async throws {
    var settings = CapsuleSettings.defaults
    settings.notificationPopups = true
    settings.launchAtLogin = false
    // Adaptive refresh, show pace, check status, low warnings, resets,
    // notification popups, launch at login.
    #expect(try await switches(settings) == [.on, .on, .on, .on, .on, .on, .off])
    settings.notificationPopups = false
    settings.showPace = false
    settings.checkStatus = false
    settings.quotaAlerts = false
    settings.celebrateResets = false
    settings.adaptiveRefresh = false
    #expect(try await switches(settings) == [.off, .off, .off, .off, .off, .off, .off])
  }
}
