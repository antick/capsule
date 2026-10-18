import AppKit
import CapsuleCore
import Foundation
import Testing

@testable import CapsuleShell

/// A 1512×982 display with a 37 pt menu bar and a 70 pt Dock along the bottom.
let screen = CGRect(x: 0, y: 0, width: 1512, height: 982)
let visible = CGRect(x: 0, y: 70, width: 1512, height: 875)
let bottomDock = ChromeSnapshot.Dock(orientation: .bottom, autohide: false, tilesize: 48)

func frame(_ preset: PlacementPreset, style: DockStyleId = .rail, meters: Int = 3) -> DockFrame {
  var settings = CapsuleSettings.defaults
  settings.placementPreset = preset
  settings.dockStyle = style
  let chrome = chromeSnapshot(
    id: 1, frame: screen, visibleFrame: visible, primaryHeight: screen.height, dock: bottomDock
  )
  return dockFrame(settings: settings, meterCount: meters, chrome: chrome, primaryHeight: screen.height)
}

/// The rail's outline in screen coordinates.
func railOnScreen(_ frame: DockFrame) -> CGRect {
  frame.rail.boundingBoxOfPath.offsetBy(dx: frame.window.minX, dy: frame.window.minY)
}

@Suite("Dock geometry")
struct DockGeometryTests {
  @Test func flipsIntoThePlacementEnginesCoordinates() {
    let chrome = chromeSnapshot(
      id: 7, frame: screen, visibleFrame: visible, primaryHeight: screen.height, dock: bottomDock
    )
    #expect(chrome.display.bounds == Rect(x: 0, y: 0, width: 1512, height: 982))
    #expect(chrome.display.workArea == Rect(x: 0, y: 37, width: 1512, height: 875))
    // A display stacked above the primary sits at negative y, as in Electron.
    let above = topLeft(CGRect(x: 0, y: 982, width: 1920, height: 1080), screen.height)
    #expect(above == Rect(x: 0, y: -1080, width: 1920, height: 1080))
    #expect(appKit(above, screen.height) == CGRect(x: 0, y: 982, width: 1920, height: 1080))
  }

  @Test func theRailSitsFlushOnTheRightEdgeCentredOnTheUsableHeight() {
    let dock = frame(.rightEdge)
    let rail = railOnScreen(dock)
    #expect(abs(rail.maxX - screen.maxX) < 0.001)
    #expect(dock.window.contains(rail))
    // Drawn exactly where placement put it: the window, its shadow gutter,
    // then the rail's bias inside the frame.
    let placement = dock.placement
    let railTop = screen.height - rail.maxY
    #expect(abs(railTop - (placement.y + placement.slide.gutter + placement.railBias)) < 0.001, "\(railTop)")
    // Which is the middle of the usable height, to the engine's rounding.
    #expect(abs(rail.midY - visible.midY) < 2)
    #expect(dock.placement.edge == .right)
    #expect(dock.placement.cardGrowth == .left)
  }

  @Test func theLeftEdgeMirrorsIt() {
    let rail = railOnScreen(frame(.leftEdge))
    #expect(abs(rail.minX - screen.minX) < 0.001)
  }

  @Test func theTopEdgeHangsFromTheTopOfTheDisplay() {
    let dock = frame(.topEdge)
    let rail = railOnScreen(dock)
    #expect(abs(rail.maxY - screen.maxY) < 0.001)
    #expect(abs(rail.midX - screen.midX) < 1)
    #expect(dock.placement.notch)
  }

  @Test func floatingStylesStandClearOfTheEdge() {
    let m = hudMetrics()
    for style in [DockStyleId.capsule, .tray] {
      let rail = railOnScreen(frame(.rightEdge, style: style))
      let gap = screen.maxX - rail.maxX
      #expect(abs(gap - dockEdgeGap(m, .of(style))) < 0.001)
      #expect(gap > 0)
    }
  }

  @Test func moreMetersMakeALongerRail() {
    let three = railOnScreen(frame(.rightEdge, meters: 3)).height
    let five = railOnScreen(frame(.rightEdge, meters: 5)).height
    let m = hudMetrics()
    #expect(abs(five - three - 2 * meterStrideSize(m)) < 0.001)
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

  @Test func theSurfaceAnswersInsideTheRailOnly() {
    let dock = frame(.rightEdge)
    let view = DockView(frame: NSRect(origin: .zero, size: dock.window.size))
    view.show(rail: dock.rail, style: dock.style, theme: .midnight, reduceTransparency: false)
    let rail = dock.rail.boundingBoxOfPath
    #expect(view.contains(NSPoint(x: rail.midX, y: rail.midY)))
    #expect(!view.contains(NSPoint(x: 1, y: 1)))
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
