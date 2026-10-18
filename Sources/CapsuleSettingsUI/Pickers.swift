import CapsuleCore
import CapsuleDock
import CapsuleHUD
import SwiftUI

/// The real dock, pinned to the edge it will occupy and shrunk to fit, with
/// its first card open. Reusing the dock view means the preview cannot drift
/// from what it previews.
struct DockPreview: View {
  @ObservedObject var model: SettingsModel
  private let height = 268.0
  private let inset = 16.0

  var body: some View {
    let settings = model.settings
    let layout = layoutForPreset(settings.placementPreset)
    let live = !model.snapshots.isEmpty
    let readings = live ? model.snapshots : Demo.snapshots
    // Demo readings are dated against the demo clock, live or not.
    let look = previewLook(settings, layout: layout, count: readings.count, demo: !live || settings.demoMode)
    let size = frameLayout(look.spec, FrameMotion(openness: 1, joinOffset: 0, cardAlong: 0)).size
    GeometryReader { box in
      let zoom = min(1, (height - inset) / size.height, (box.size.width - inset) / size.width)
      PreviewDock(look: look, readings: readings)
        .frame(width: size.width, height: size.height)
        .scaleEffect(zoom, anchor: anchor(layout.cardGrowth))
        .frame(width: box.size.width, height: height, alignment: alignment(layout.cardGrowth))
        .allowsHitTesting(false)
    }
    .frame(height: height)
    .background(
      LinearGradient(colors: [Color(white: 0.32), Color(white: 0.18)], startPoint: .top, endPoint: .bottom)
    )
    .clipShape(RoundedRectangle(cornerRadius: 16))
  }

  private func previewLook(_ s: CapsuleSettings, layout: PresetLayout, count: Int, demo: Bool) -> DockLook {
    let m = hudMetrics(s.hudScale)
    let style = DockStyle.of(s.dockStyle)
    let compact = layout.orientation == .horizontal
    return DockLook(
      spec: FrameSpec(
        metrics: m, style: style, growth: layout.cardGrowth, notch: layout.notch && styleSupportsNotch(style),
        compact: compact, railLength: railLengthForCount(m, count, compact: compact), railBias: nil, joined: nil
      ),
      theme: resolveHudTheme(s.hudTheme, system: model.appearance), display: s.usageDisplay,
      demoNow: demo ? Demo.now : nil
    )
  }

  private func anchor(_ growth: CardGrowth) -> UnitPoint {
    switch growth {
    case .left: return .trailing
    case .right: return .leading
    case .up: return .bottom
    case .down: return .top
    }
  }

  private func alignment(_ growth: CardGrowth) -> Alignment {
    switch growth {
    case .left: return .trailing
    case .right: return .leading
    case .up: return .bottom
    case .down: return .top
    }
  }
}

/// The dock view, hosted for the preview with its first card held open.
struct PreviewDock: NSViewRepresentable {
  let look: DockLook
  let readings: [UsageSnapshot]

  func makeNSView(context: Context) -> DockView {
    let view = DockView(look: look, behavior: DockBehavior(clock: MainClock()))
    configure(view)
    return view
  }

  func updateNSView(_ view: DockView, context: Context) {
    view.update(look: look)
    configure(view)
  }

  private func configure(_ view: DockView) {
    var inputs = view.behavior.inputs
    inputs.snapshots = readings
    inputs.forceOpen = readings.first?.providerId
    view.behavior.update(inputs)
    view.settle()
  }
}

/// Each dock style's real silhouette resting on a sliver of screen edge.
struct StylePicker: View {
  let value: DockStyleId
  let onChange: (DockStyleId) -> Void

  var body: some View {
    HStack(spacing: 8) {
      ForEach(DockStyleId.allCases, id: \.self) { id in
        let style = DockStyle.of(id)
        OptionCard(selected: value == id, label: style.label, hint: style.hint, action: { onChange(id) }) {
          Silhouette(style: style)
            .frame(maxWidth: .infinity).frame(height: 70)
            .background(Color(white: 0.25)).clipShape(RoundedRectangle(cornerRadius: 8))
        }
      }
    }
  }
}

struct Silhouette: View {
  let style: DockStyle

  var body: some View {
    Canvas { context, size in
      let m = hudMetrics(HudScale.min)
      let layout = blobLayout(
        m,
        BlobLayoutInput(
          cardGrowth: .up, railLength: railLengthForCount(m, 3, compact: true),
          joinOffset: joinOffsetForIndex(m, 0, compact: true), style: style
        )
      )
      let gap = dockEdgeGap(m, style)
      let headroom = m.railWidth * 0.3
      let top = layout.rail.y - headroom
      let height = layout.rail.height + headroom + gap
      let scale = min(size.width / layout.width, size.height / height)
      let path = Path(cgPath(railPath(m, .up, layout, style: style)))
      let dx = (size.width - layout.width * scale) / 2
      let dy = size.height - height * scale
      let placed = path.applying(
        CGAffineTransform(translationX: dx, y: dy - top * scale).scaledBy(x: scale, y: scale)
      )
      context.fill(placed, with: .color(Color(white: 0.03)))
      if style.outline { context.stroke(placed, with: .color(.white.opacity(0.3)), lineWidth: 1) }
    }
  }
}

/// A miniature of the dock's surface, rings and type in each palette.
struct ThemePicker: View {
  let value: HudThemeChoice
  let onChange: (HudThemeChoice) -> Void
  private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

  var body: some View {
    LazyVGrid(columns: columns, spacing: 8) {
      ForEach(HudThemeChoice.allCases, id: \.self) { choice in
        let theme = choice == .auto ? nil : resolveHudTheme(choice, system: .dark)
        OptionCard(
          selected: value == choice, label: theme?.label ?? Copy.themeAuto, hint: theme?.hint ?? Copy.themeAutoHint,
          inline: true, action: { onChange(choice) }
        ) {
          if let theme { swatch(theme) } else { autoSwatch }
        }
      }
    }
  }

  private func swatch(_ theme: HudTheme) -> some View {
    HStack(spacing: 4) {
      Circle().strokeBorder(theme.ringTrack.swiftUI, lineWidth: 2).frame(width: 14, height: 14)
      Circle().strokeBorder(SeverityColors.color(.low).swiftUI, lineWidth: 2).frame(width: 14, height: 14)
      Capsule().fill(theme.text.swiftUI).frame(width: 16, height: 6)
    }
    .frame(width: 64, height: 40)
    .background(RoundedRectangle(cornerRadius: 8).fill(theme.surface.swiftUI))
    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(theme.surfaceEdge.swiftUI))
  }

  private var autoSwatch: some View {
    HStack(spacing: 0) {
      HudTheme.porcelain.surface.swiftUI
      HudTheme.midnight.surface.swiftUI
    }
    .frame(width: 64, height: 40)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color.primary.opacity(0.2)))
  }
}

/// The dock's size, in the steps the stepper can stop at.
struct SizeStepper: View {
  let value: Double
  let onChange: (Double) -> Void

  var body: some View {
    HStack(spacing: 16) {
      step("−", Copy.decreaseSize, disabled: value <= HudScale.min) { onChange(nextHudScale(value, direction: -1)) }
      Slider(
        value: Binding(get: { value }, set: { onChange(clampHudScale($0)) }),
        in: HudScale.min...HudScale.max, step: HudScale.step
      )
      .accessibilityLabel(Copy.dockSize)
      .accessibilityValue("\(Int(jsRound(value * 100)))%")
      Text("\(Int(jsRound(value * 100)))%").font(.system(size: 13, weight: .medium).monospacedDigit())
        .foregroundStyle(.secondary).frame(width: 48, alignment: .trailing)
      step("+", Copy.increaseSize, disabled: value >= HudScale.max) { onChange(nextHudScale(value, direction: 1)) }
    }
  }

  private func step(_ glyph: String, _ label: String, disabled: Bool, _ action: @escaping () -> Void) -> some View {
    Button(action: action) { Text(glyph).font(.system(size: 17)).frame(width: 24, height: 24) }
      .disabled(disabled).accessibilityLabel(label).help(label)
  }
}

/// A miniature screen the dock can be pinned to, and the four edges named.
struct PlacementPicker: View {
  let value: PlacementPreset
  let onChange: (PlacementPreset) -> Void
  private let order: [PlacementPreset] = [.topEdge, .rightEdge, .bottomEdge, .leftEdge]
  private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

  var body: some View {
    VStack(spacing: 16) {
      ZStack {
        RoundedRectangle(cornerRadius: 12).fill(LinearGradient(
          colors: [Color(red: 0.35, green: 0.42, blue: 0.62), Color(red: 0.2, green: 0.24, blue: 0.38)],
          startPoint: .top, endPoint: .bottom))
        VStack(spacing: 0) {
          Rectangle().fill(.black.opacity(0.35)).frame(height: 9)
          Spacer()
          RoundedRectangle(cornerRadius: 5).fill(.white.opacity(0.2)).frame(width: 112, height: 12).padding(.bottom, 5)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        GeometryReader { box in
          ForEach(order, id: \.self) { preset in edge(preset, in: box.size) }
        }
      }
      .aspectRatio(16 / 10, contentMode: .fit)
      .frame(maxWidth: 384)
      LazyVGrid(columns: columns, spacing: 8) {
        ForEach(order, id: \.self) { preset in
          OptionCard(selected: value == preset, label: preset.label, hint: preset.hint, inline: true) {
            onChange(preset)
          } picture: {
            EmptyView()
          }
        }
      }
    }
  }

  private func edge(_ preset: PlacementPreset, in size: CGSize) -> some View {
    let selected = value == preset
    let long = 64.0
    let thin = 10.0
    let rect: CGRect
    switch preset {
    case .topEdge: rect = CGRect(x: size.width / 2 - long / 2, y: 7, width: long, height: thin)
    case .bottomEdge: rect = CGRect(x: size.width * 0.22 - long / 2, y: size.height - 7 - thin, width: long, height: thin)
    case .leftEdge: rect = CGRect(x: 7, y: size.height / 2 - long / 2, width: thin, height: long)
    case .rightEdge: rect = CGRect(x: size.width - 7 - thin, y: size.height / 2 - long / 2, width: thin, height: long)
    }
    return Button { onChange(preset) } label: {
      Capsule().fill(selected ? Color.accentColor : .white.opacity(0.3))
        .shadow(color: selected ? .accentColor.opacity(0.6) : .clear, radius: 7)
    }
    .buttonStyle(.plain)
    .frame(width: rect.width, height: rect.height)
    .position(x: rect.midX, y: rect.midY)
    .accessibilityLabel(preset.label)
    .help(preset.label)
  }
}
