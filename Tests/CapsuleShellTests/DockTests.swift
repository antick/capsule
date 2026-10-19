import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD
import Foundation
import Testing

@testable import CapsuleShell

/// A 1512×982 display with a 37 pt menu bar and a 70 pt Dock along the bottom.
let screen = CGRect(x: 0, y: 0, width: 1512, height: 982)
let visible = CGRect(x: 0, y: 70, width: 1512, height: 875)
let bottomDock = ChromeSnapshot.Dock(orientation: .bottom, autohide: false, tilesize: 48)
let chrome = chromeSnapshot(id: 1, frame: screen, visibleFrame: visible, primaryHeight: screen.height, dock: bottomDock)

struct Placed {
  let placement: PlacementResult
  let window: Rect
  let frame: FrameLayout
  /// The drawn rail, in the placement engine's screen coordinates.
  let rail: CGRect
}

func place(
  _ preset: PlacementPreset, style: DockStyleId = .rail, meters: Int = 3, joined: HardwareNotch? = nil,
  railStart: Double? = nil, percent: Bool = false
) -> Placed {
  var settings = CapsuleSettings.defaults
  settings.dockPercent = percent
  settings.placementPreset = preset
  settings.dockStyle = style
  var placement = dockPlacement(settings: settings, preset: preset, meterCount: meters, chrome: chrome, joined: joined)
  if let railStart { placement = slid(placement, railStart: railStart) }
  let spec = frameSpec(settings: settings, placement: placement, meterCount: meters, joined: joined)
  let frame = frameLayout(spec, FrameMotion(openness: 1, joinOffset: 0, cardAlong: 0))
  let window = windowBox(placement)
  let rail = frame.rail.boundingBoxOfPath.offsetBy(dx: window.x, dy: window.y)
  return Placed(placement: placement, window: window, frame: frame, rail: rail)
}

@Suite("Dock placement")
struct PlacementShellTests {
  @Test func flipsIntoThePlacementEnginesCoordinates() {
    #expect(chrome.display.bounds == Rect(x: 0, y: 0, width: 1512, height: 982))
    #expect(chrome.display.workArea == Rect(x: 0, y: 37, width: 1512, height: 875))
    // A display stacked above the primary sits at negative y, as in Electron.
    let above = topLeft(CGRect(x: 0, y: 982, width: 1920, height: 1080), screen.height)
    #expect(above == Rect(x: 0, y: -1080, width: 1920, height: 1080))
    #expect(appKit(above, screen.height) == CGRect(x: 0, y: 982, width: 1920, height: 1080))
  }

  @Test func theWindowIsExactlyTheFrameTheViewDraws() {
    for preset in PlacementPreset.allCases {
      for style in DockStyleId.allCases {
        let placed = place(preset, style: style)
        #expect(
          abs(placed.frame.size.width - placed.window.width) < 1
            && abs(placed.frame.size.height - placed.window.height) < 1,
          "\(preset) \(style): frame \(placed.frame.size) window \(placed.window)"
        )
      }
    }
  }

  @Test func theRailSitsFlushOnTheRightEdgeCentredOnTheUsableHeight() {
    let placed = place(.rightEdge)
    #expect(abs(placed.rail.maxX - screen.maxX) < 0.001)
    let p = placed.placement
    #expect(abs(placed.rail.minY - railStartOf(p)) < 0.001)
    #expect(abs(placed.rail.midY - (37 + 875.0 / 2)) < 2)
  }

  @Test func theLeftEdgeMirrorsIt() {
    #expect(abs(place(.leftEdge).rail.minX) < 0.001)
  }

  @Test func theTopEdgeHangsFromTheTopOfTheDisplay() {
    let placed = place(.topEdge)
    #expect(abs(placed.rail.minY) < 0.001)
    #expect(abs(placed.rail.midX - screen.midX) < 1)
    #expect(placed.placement.notch)
  }

  @Test func floatingStylesStandClearOfTheEdge() {
    let m = hudMetrics()
    for style in [DockStyleId.capsule, .tray] {
      let gap = screen.maxX - place(.rightEdge, style: style).rail.maxX
      #expect(abs(gap - dockEdgeGap(m, .of(style))) < 0.001)
      #expect(gap > 0)
    }
  }

  @Test func moreMetersMakeALongerRail() {
    let m = hudMetrics()
    let grown = place(.rightEdge, meters: 5).rail.height - place(.rightEdge, meters: 3).rail.height
    // Percentages are off by default, so a side dock packs its meters close.
    #expect(abs(grown - 2 * meterStrideSize(m, compact: true)) < 0.001)
    let labelled = place(.rightEdge, meters: 5, percent: true).rail.height
      - place(.rightEdge, meters: 3, percent: true).rail.height
    #expect(abs(labelled - 2 * meterStrideSize(m)) < 0.001)
  }

  @Test func aRememberedPositionPutsTheRailExactlyThere() {
    // 120 puts the window at -13.5: the rail must still start at 120, not at
    // the 121 that rounding the window and the offset apart would give.
    for start in [120.0, 121.0, 300.0] {
      let placed = place(.rightEdge, railStart: start)
      #expect(abs(placed.rail.minY - start) < 0.001, "\(start) drew \(placed.rail.minY) window \(placed.window.y) bias \(placed.placement.railBias) railBox \(placed.frame.railBox)")
    }
  }

  @Test func aJoinedNotchIsAtLeastTheHardwareWideAndDeeperByIt() {
    let notch = HardwareNotch(width: 200, height: 32)
    let m = hudMetrics()
    let placed = place(.topEdge, joined: notch)
    #expect(placed.frame.railBox.width >= notch.width + 2 * m.notchRadius)
    #expect(abs(placed.frame.railBox.height - (m.railWidth + notch.height)) < 0.001)
    #expect(abs(placed.rail.midX - screen.midX) < 1)
  }

  @Test func onlyTheTopEdgeInANotchStyleIsJoined() {
    var settings = CapsuleSettings.defaults
    let hardware = HardwareNotch(width: 180, height: 32)
    #expect(joinedNotch(settings: settings, preset: .rightEdge, hardware: hardware, chrome: chrome) == nil)
    #expect(joinedNotch(settings: settings, preset: .topEdge, hardware: hardware, chrome: chrome) == hardware)
    // No hardware notch: one the dock draws, as deep as the menu bar.
    #expect(joinedNotch(settings: settings, preset: .topEdge, hardware: nil, chrome: chrome)?.height == 37)
    settings.topEdgeNotch = false
    #expect(joinedNotch(settings: settings, preset: .topEdge, hardware: hardware, chrome: chrome) == nil)
  }

  @Test func readsTheMacDocksPreferences() throws {
    let name = "capsule-shell-tests-\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: name))
    defer { defaults.removePersistentDomain(forName: name) }
    #expect(macDockPreferences(defaults) == bottomDock)
    defaults.set("left", forKey: MacDockDefaults.orientationKey)
    defaults.set(true, forKey: MacDockDefaults.autohideKey)
    defaults.set(64.0, forKey: MacDockDefaults.tilesizeKey)
    #expect(
      macDockPreferences(defaults) == ChromeSnapshot.Dock(orientation: .left, autohide: true, tilesize: 64)
    )
    defaults.set("sideways", forKey: MacDockDefaults.orientationKey)
    #expect(macDockPreferences(defaults).orientation == .bottom)
    #expect(macDockPreferences(nil) == bottomDock)
  }
}

@MainActor
@Suite("Dock panel")
struct DockPanelTests {
  @Test func isANonActivatingPanelOnEverySpace() {
    let panel = DockPanel()
    #expect(panel.styleMask.contains(.nonactivatingPanel))
    #expect(panel.isFloatingPanel)
    #expect(!panel.hidesOnDeactivate)
    #expect(panel.level == .statusBar)
    #expect(
      panel.collectionBehavior == [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenNone]
    )
  }

  @Test func neverTakesFocus() {
    let panel = DockPanel()
    #expect(!panel.canBecomeKey)
    #expect(!panel.canBecomeMain)
    panel.makeKeyAndOrderFront(nil)
    #expect(!panel.isKeyWindow)
    panel.orderOut(nil)
  }
}

@Suite("Themes")
struct ThemeTests {
  @Test func autoFollowsTheSystem() {
    #expect(resolveHudTheme(.auto, system: .dark) == .midnight)
    #expect(resolveHudTheme(.auto, system: .light) == .porcelain)
  }

  @Test func aChosenPaletteIgnoresTheSystem() {
    for choice in HudThemeChoice.allCases where choice != .auto {
      #expect(resolveHudTheme(choice, system: .dark).id == choice)
      #expect(resolveHudTheme(choice, system: .light).id == choice)
    }
  }
}
