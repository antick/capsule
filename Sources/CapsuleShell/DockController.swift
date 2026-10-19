import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD

/// Keeps the dock's panel where the placement engine says and the dock view
/// drawn for the current readings; follows the pointer to decide when the
/// panel takes the mouse; and moves the dock when it is dragged. Replaces
/// the Electron app's `OverlayController` and `HoverTracker`.
@MainActor
public final class DockController {
  public let panel = DockPanel()
  public let behavior: DockBehavior
  let view: DockView
  private let container = NSView()
  private var settings: CapsuleSettings
  private var meterCount: Int
  /// The display the dock was last placed on; the primary one until then.
  private var displayId: UInt32?
  private var placement: PlacementResult?
  private var joined: HardwareNotch?
  private var drag: DragState?
  private var pressed = false
  private var demoNow: Date?
  private lazy var tracker = HoverTracker { [weak self] point in self?.pointerMoved(point) }
  private var observers: [(NotificationCenter, NSObjectProtocol)] = []
  private var appearanceObservation: NSKeyValueObservation?

  /// A drag ended: the edge it was dropped on, and where along it.
  public var onMoved: ((PlacementPreset, DockPosition) -> Void)?
  /// The menu a right-click on the dock shows.
  public var contextMenu: (() -> NSMenu)?
  /// An edit made on the card itself: a flip, a hidden or starred row.
  public var onEdit: ((inout CapsuleSettings) -> Void) -> Void = { _ in }

  private struct DragState {
    var preset: PlacementPreset
    var placement: PlacementResult
    var displayId: UInt32
    /// Cursor offset from the leading edge of the rail, along the slide.
    var grabOffset: Double
    var railStart: Double
  }

  public init(settings: CapsuleSettings, clock: DockClock = MainClock()) {
    self.settings = settings
    meterCount = max(1, settings.enabledMeters.count)
    behavior = DockBehavior(clock: clock)
    let screen = NSScreen.screens.first
    let placeholder = DockLook(
      spec: frameSpec(
        settings: settings,
        placement: dockPlacement(
          settings: settings, preset: settings.placementPreset, meterCount: meterCount,
          chrome: screen.map { Self.chrome($0) }
            ?? ChromeSnapshot(
              display: .init(id: 0, bounds: Rect(x: 0, y: 0, width: 1440, height: 900),
                workArea: Rect(x: 0, y: 0, width: 1440, height: 900)),
              dock: macDockPreferences(nil)),
          joined: nil
        ),
        meterCount: meterCount, joined: nil
      ),
      theme: .midnight, display: settings.usageDisplay
    )
    view = DockView(look: placeholder, behavior: behavior)
    container.addSubview(view)
    panel.contentView = container
    view.onHitRectsChange = { [weak self] in self?.pointerMoved(NSEvent.mouseLocation) }
    view.onPressedChange = { [weak self] pressed in
      self?.pressed = pressed
      self?.pointerMoved(NSEvent.mouseLocation)
    }
    view.onMoveStart = { [weak self] point in self?.startMove(point) }
    view.onMove = { [weak self] point in self?.move(to: point) }
    view.onMoveEnd = { [weak self] in self?.endMove() }
    view.onContextMenu = { [weak self] event in
      guard let self, let menu = self.contextMenu?() else { return }
      NSMenu.popUpContextMenu(menu, with: event, for: self.view)
    }
  }

  /// Whether the dock is on screen.
  public private(set) var isShown = false

  public func show() {
    guard !isShown else { return }
    isShown = true
    let center = NotificationCenter.default
    let workspace = NSWorkspace.shared.notificationCenter
    observers = [
      (center, center.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.relayout() }
      }),
      (workspace, workspace.addObserver(forName: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.relayout() }
      }),
      (workspace, workspace.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.relayout() }
      }),
    ]
    appearanceObservation = NSApp.observe(\.effectiveAppearance) { [weak self] _, _ in
      DispatchQueue.main.async { MainActor.assumeIsolated { self?.relayout() } }
    }
    relayout()
    view.settle()
    panel.orderFrontRegardless()
    tracker.start()
  }

  public func hide() {
    guard isShown else { return }
    isShown = false
    tracker.stop()
    for (center, token) in observers { center.removeObserver(token) }
    observers = []
    appearanceObservation = nil
    panel.orderOut(nil)
  }

  // MARK: What to show

  public func apply(settings next: CapsuleSettings) {
    // A new size eases from the old one rather than jumping to it.
    if next.hudScale != settings.hudScale, placement != nil { zoomFrom = settings.hudScale }
    settings = next
    relayout()
  }

  /// The size a resize is easing from, until it has been drawn.
  private var zoomFrom: Double?
  /// Shrinks the window back onto the dock once a resize has eased.
  private var zoomSettle: DispatchWorkItem?

  public func update(
    state: ShellState, notices: [ActivityNotice], keepOpen: Bool, demoNow: Date?
  ) {
    var inputs = behavior.inputs
    inputs.snapshots = presented(state.snapshots, settings, statuses: state.statuses)
    inputs.activity = state.activity
    inputs.tokens = state.tokens
    inputs.autoHide = settings.autoHide
    inputs.hideDelayMs = settings.hideDelay.milliseconds
    inputs.keepOpen = keepOpen
    inputs.notificationPopups = settings.notificationPopups
    behavior.update(inputs)
    behavior.updateNotices(notices)
    self.demoNow = demoNow
    let count = max(1, state.snapshots.count)
    if count != meterCount {
      meterCount = count
      relayout()
    }
  }

  /// "Show Dock": unroll it and hold it out for a few seconds.
  public func reveal() {
    if !panel.isVisible { panel.orderFrontRegardless() }
    behavior.reveal()
  }

  // MARK: Placement

  private static func chrome(_ screen: NSScreen) -> ChromeSnapshot {
    chromeSnapshot(
      id: Int(screen.displayID), frame: screen.frame, visibleFrame: screen.visibleFrame,
      primaryHeight: primaryHeight,
      dock: macDockPreferences(UserDefaults(suiteName: MacDockDefaults.domain))
    )
  }

  private static var primaryHeight: CGFloat { NSScreen.screens.first?.frame.height ?? 0 }

  private func display() -> NSScreen? {
    NSScreen.screens.first { $0.displayID == displayId } ?? NSScreen.screens.first
  }

  /// Places the dock for the current settings, readings and displays.
  func relayout() {
    guard drag == nil, let screen = display() else { return }
    displayId = screen.displayID
    let chrome = Self.chrome(screen)
    let preset = settings.placementPreset
    joined = joinedNotch(settings: settings, preset: preset, hardware: hardwareNotch(screen), chrome: chrome)
    let edge = dockPlacement(
      settings: settings, preset: preset, meterCount: meterCount, chrome: chrome, joined: joined
    )
    // Drawn as the display's notch, the dock stays over it: a remembered
    // offset would leave a black bar beside the real one. A remembered
    // position only says how far along the edge the rail sits.
    let custom = joined == nil ? settings.customPosition : nil
    let railStart = custom.map { edge.slide.axis == .x ? $0.x : $0.y } ?? railStartOf(edge)
    place(slid(edge, railStart: railStart))
  }

  private func place(_ next: PlacementResult) {
    let previousBox = placement.map(windowBox)
    placement = next
    let box = windowBox(next)
    let zooming = zoomFrom.flatMap { from in previousBox.map { (from, $0) } }
    zoomFrom = nil
    zoomSettle?.cancel()
    // While a resize eases, the window holds both sizes at once, anchored
    // against the docked edge, so neither end of the ease is clipped.
    let shown = zooming.map { _, current in
      let hold = zoomHoldBounds(
        target: WindowBox(x: box.x, y: box.y, width: box.width, height: box.height),
        current: WindowBox(x: current.x, y: current.y, width: current.width, height: current.height),
        cardGrowth: next.cardGrowth
      )
      return Rect(x: hold.x, y: hold.y, width: hold.width, height: hold.height)
    } ?? box
    panel.setFrame(appKit(shown, Self.primaryHeight), display: false)
    let dark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
    var look = DockLook(
      spec: frameSpec(settings: settings, placement: next, meterCount: meterCount, joined: joined),
      theme: resolveHudTheme(settings.hudTheme, system: dark ? .dark : .light),
      display: settings.usageDisplay, demoNow: demoNow
    )
    look.rows = CardRows(settings) { [weak self] edit in self?.onEdit(edit) }
    look.rings = settings.dockRings
    look.meterStyle = settings.meterStyle
    view.update(look: look)
    // Packed against the docked edge, in case the frame and the window
    // disagree by a rounding.
    let size = view.frameSize
    let width = container.bounds.width
    let height = container.bounds.height
    view.frame = CGRect(
      x: next.cardGrowth == .left ? width - size.width : 0,
      y: next.cardGrowth == .up ? 0 : height - size.height,
      width: size.width, height: size.height
    )
    if let (from, _) = zooming {
      easeSize(from: from, to: settings.hudScale, growth: next.cardGrowth)
      let settle = DispatchWorkItem { [weak self] in
        MainActor.assumeIsolated {
          guard let self, let placement = self.placement else { return }
          self.place(placement)
        }
      }
      zoomSettle = settle
      DispatchQueue.main.asyncAfter(
        deadline: .now() + (Motion.zoomMs + Motion.zoomSettleMs) / 1000, execute: settle)
    }
    pointerMoved(NSEvent.mouseLocation)
  }

  /// Draws the new size at once and scales it from the old one, about the
  /// middle of the docked edge, so the dock grows out of where it sits.
  private func easeSize(from: Double, to: Double, growth: CardGrowth) {
    guard let layer = view.layer, to > 0, !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion else { return }
    let size = view.bounds.size
    // The layer's own space runs y-up from its bottom-left corner.
    let pivot: CGPoint
    switch growth {
    case .left: pivot = CGPoint(x: size.width, y: size.height / 2)
    case .right: pivot = CGPoint(x: 0, y: size.height / 2)
    case .up: pivot = CGPoint(x: size.width / 2, y: 0)
    case .down: pivot = CGPoint(x: size.width / 2, y: size.height)
    }
    let start = hudScaleRange(from) / hudScaleRange(to)
    var transform = CATransform3DMakeTranslation(pivot.x, pivot.y, 0)
    transform = CATransform3DScale(transform, start, start, 1)
    transform = CATransform3DTranslate(transform, -pivot.x, -pivot.y, 0)
    let ease = CABasicAnimation(keyPath: "transform")
    ease.fromValue = NSValue(caTransform3D: transform)
    ease.toValue = NSValue(caTransform3D: CATransform3DIdentity)
    ease.duration = Motion.zoomMs / 1000
    ease.timingFunction = CAMediaTimingFunction(controlPoints: 0.22, 1, 0.36, 1)
    layer.add(ease, forKey: "zoom")
  }

  /// The display's own notch, from the menu-bar strips either side of it.
  private func hardwareNotch(_ screen: NSScreen) -> HardwareNotch? {
    if let fake = ProcessInfo.processInfo.environment[ShellTuning.fakeNotchEnvironment] {
      let parts = fake.split(separator: "x").compactMap { Double($0) }
      if parts.count == 2, parts[0] > 0, parts[1] > 0 { return HardwareNotch(width: parts[0], height: parts[1]) }
    }
    guard let left = screen.auxiliaryTopLeftArea, let right = screen.auxiliaryTopRightArea else { return nil }
    let width = screen.frame.width - left.width - right.width
    let height = screen.safeAreaInsets.top
    guard left.width > 0, right.width > 0, width > 0, height > 0 else { return nil }
    return HardwareNotch(width: jsRound(width), height: jsRound(height))
  }

  // MARK: Pointer

  func pointerMoved(_ screenPoint: NSPoint) {
    guard panel.isVisible else { return }
    let windowPoint = panel.convertPoint(fromScreen: screenPoint)
    let point = view.convert(windowPoint, from: nil)
    view.pointer(at: point)
    // Take the mouse only over the dock itself, and for the whole of a
    // press or a drag, which may slide the dock out from under the pointer.
    let taking = view.answers(point) || pressed || drag != nil
    // Leaving, hand the cursor back as it was found.
    if !taking, !panel.ignoresMouseEvents { NSCursor.arrow.set() }
    panel.ignoresMouseEvents = !taking
  }

  // MARK: Drag

  private func topLeftPoint(_ point: NSPoint) -> (x: Double, y: Double) {
    (Double(point.x), Double(Self.primaryHeight - point.y))
  }

  func startMove(_ screenPoint: NSPoint) {
    guard let placement, let screen = display() else { return }
    // Grab the rail, not the window: where the window has been stopped by a
    // screen edge the two no longer move together.
    let railStart = railStartOf(placement)
    let cursor = topLeftPoint(screenPoint)
    drag = DragState(
      preset: settings.placementPreset, placement: placement, displayId: screen.displayID,
      grabOffset: (placement.slide.axis == .x ? cursor.x : cursor.y) - railStart, railStart: railStart
    )
    panel.ignoresMouseEvents = false
  }

  /// Re-docks to whichever edge the cursor is nearest, then slides along it.
  func move(to screenPoint: NSPoint) {
    guard var state = drag else { return }
    let screen =
      NSScreen.screens.first { NSMouseInRect(screenPoint, $0.frame, false) } ?? display()
    guard let screen else { return }
    let cursor = topLeftPoint(screenPoint)
    let chrome = Self.chrome(screen)
    let preset = presetForEdge(nearestEdgeForPoint(point: cursor, bounds: chrome.display.bounds))
    if preset != state.preset || screen.displayID != state.displayId {
      joined = joinedNotch(settings: settings, preset: preset, hardware: hardwareNotch(screen), chrome: chrome)
      state.placement = dockPlacement(
        settings: settings, preset: preset, meterCount: meterCount, chrome: chrome, joined: joined
      )
      // Re-grab the rail from its middle so it does not lurch onto the new edge.
      state.grabOffset = state.placement.slide.railLength / 2
      state.preset = preset
      state.displayId = screen.displayID
    }
    let next = slideAlongEdge(
      slide: state.placement.slide, anchorX: state.placement.x, anchorY: state.placement.y,
      cursor: cursor, grabOffset: state.grabOffset
    )
    state.railStart = next.railStart
    drag = state
    var moved = state.placement
    moved.x = next.x
    moved.y = next.y
    moved.railBias = next.railBias
    place(moved)
  }

  func endMove() {
    guard let state = drag, let placement else {
      drag = nil
      return
    }
    drag = nil
    displayId = state.displayId
    // The slide axis holds the rail's leading edge, so the same number means
    // the same place whatever the card or the style does to the window.
    let along = jsRound(state.railStart)
    let box = windowBox(placement)
    let position =
      placement.slide.axis == .x ? DockPosition(x: along, y: box.y) : DockPosition(x: box.x, y: along)
    onMoved?(state.preset, position)
  }
}

extension NSScreen {
  var displayID: UInt32 {
    (deviceDescription[NSDeviceDescriptionKey(ShellTuning.screenNumberKey)] as? NSNumber)?.uint32Value ?? 0
  }
}
