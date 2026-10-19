import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD
import SwiftUI

/// How a status reads at a glance, across the settings window.
enum Tone {
  case good, warn, bad, neutral, busy

  var color: Color {
    switch self {
    case .good: return .green
    case .warn: return .orange
    case .bad: return .red
    case .neutral: return .secondary
    case .busy: return .blue
    }
  }

  init(_ tone: UpdateTone) {
    switch tone {
    case .good: self = .good
    case .warn: self = .warn
    case .bad: self = .bad
    case .neutral: self = .neutral
    case .busy: self = .busy
    }
  }

  /// The four severity bands, as the settings shell's tones: the dock's own
  /// colours are drawn for its surface and vanish on a light panel.
  static func severity(_ percent: Double) -> Tone {
    switch severityForPercent(percent) {
    case .low: return .good
    case .mid: return .warn
    case .high, .critical: return .bad
    }
  }
}

struct StatusPill: View {
  let tone: Tone
  let text: String

  var body: some View {
    HStack(spacing: 5) {
      Circle().fill(tone.color).frame(width: 6, height: 6)
      Text(text).font(.system(size: 11.5, weight: .medium)).foregroundStyle(tone.color)
    }
  }
}

/// A page: the system's grouped form, as System Settings draws its own.
/// It handles the title bar, scrolling, and light and dark by itself.
struct SettingsForm<Content: View>: View {
  var lead: String?
  @ViewBuilder let content: Content

  var body: some View {
    Form {
      // The intro is a callout row of its own, so every section's header
      // below it looks alike.
      if let lead {
        Section {
          Label {
            Text(lead).font(.system(size: 12.5)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
          } icon: {
            Image(systemName: "info.circle").foregroundStyle(.secondary)
          }
        }
      }
      content
    }
    .formStyle(.grouped)
  }
}

/// A group of related settings: a title, the rows, and a note under them.
struct SettingsSection<Content: View, Aside: View>: View {
  var title: String?
  var hint: String?
  @ViewBuilder let aside: Aside
  @ViewBuilder let content: Content

  var body: some View {
    Section {
      content
    } header: {
      if let title {
        HStack(alignment: .firstTextBaseline) {
          Text(title)
          Spacer(minLength: 0)
          aside
        }
      }
    } footer: {
      if let hint {
        Text(hint).font(.system(size: 11.5)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
          .frame(maxWidth: .infinity, alignment: .leading).multilineTextAlignment(.leading)
      }
    }
  }
}

extension SettingsSection where Aside == EmptyView {
  init(title: String? = nil, hint: String? = nil, @ViewBuilder content: () -> Content) {
    self.init(title: title, hint: hint, aside: { EmptyView() }, content: content)
  }
}

/// One setting: what it is, a line on what it does, and its control.
struct SettingRow<Control: View>: View {
  let label: String
  var hint: String?
  @ViewBuilder let control: Control

  var body: some View {
    LabeledContent {
      control
    } label: {
      Text(label)
      if let hint { Text(hint) }
    }
  }
}

/// An on/off setting, the most common row.
struct SwitchRow: View {
  let label: String
  var hint: String?
  let isOn: Binding<Bool>

  var body: some View {
    Toggle(isOn: isOn) {
      Text(label)
      if let hint { Text(hint) }
    }
    .toggleStyle(.switch)
  }
}

/// A sidebar icon: a white symbol on a tinted rounded square, as System
/// Settings marks its panes.
struct PaneIcon: View {
  let symbol: String
  let tint: Color

  var body: some View {
    Image(systemName: symbol)
      .font(.system(size: 11.5, weight: .semibold))
      .foregroundStyle(.white)
      .frame(width: 22, height: 22)
      .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(tint.gradient))
  }
}

/// Where a chosen figure sits in the menu bar.
enum ChipPlace {
  case only, top, bottom

  var symbol: String? {
    switch self {
    case .only: return nil
    case .top: return "arrow.up"
    case .bottom: return "arrow.down"
    }
  }
}

/// A selectable chip: a provider's mark and a name, filled when chosen, and
/// where it sits when that matters.
struct Chip: View {
  let provider: ProviderId?
  let label: String
  let selected: Bool
  var place: ChipPlace? = nil
  var disabled = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 6) {
        if let provider { ProviderMark(id: provider, tint: selected ? .white : .primary).frame(width: 12, height: 12) }
        Text(label).font(.system(size: 12, weight: .medium)).lineLimit(1)
        if selected {
          Image(systemName: place?.symbol ?? "checkmark").font(.system(size: 9.5, weight: .bold))
        }
      }
      .padding(.horizontal, 10).padding(.vertical, 5)
      .foregroundStyle(selected ? Color.white : Color.primary)
      .background(Capsule().fill(selected ? Color.accentColor : Color.primary.opacity(0.06)))
      .overlay(Capsule().strokeBorder(selected ? Color.clear : Color.primary.opacity(0.12)))
      .contentShape(Capsule())
    }
    .buttonStyle(.plain)
    .disabled(disabled && !selected)
    .opacity(disabled && !selected ? 0.4 : 1)
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}

/// Lays chips out in rows, wrapping when a row is full.
struct FlowLayout: Layout {
  var spacing: CGFloat = 6

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    arrange(proposal.width ?? .infinity, subviews).size
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    for (index, origin) in arrange(bounds.width, subviews).origins.enumerated() {
      subviews[index].place(at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y), proposal: .unspecified)
    }
  }

  private func arrange(_ width: CGFloat, _ subviews: Subviews) -> (origins: [CGPoint], size: CGSize) {
    var origins: [CGPoint] = []
    var x: CGFloat = 0
    var y: CGFloat = 0
    var line: CGFloat = 0
    var widest: CGFloat = 0
    for subview in subviews {
      let size = subview.sizeThatFits(.unspecified)
      if x > 0, x + size.width > width {
        x = 0
        y += line + spacing
        line = 0
      }
      origins.append(CGPoint(x: x, y: y))
      x += size.width + spacing
      line = max(line, size.height)
      widest = max(widest, x - spacing)
    }
    return (origins, CGSize(width: widest, height: y + line))
  }
}

/// A choice drawn as a card: a picture of the option beside or above its name.
struct OptionCard<Picture: View>: View {
  let selected: Bool
  let label: String
  var hint: String?
  var inline = false
  let action: () -> Void
  @ViewBuilder let picture: Picture

  var body: some View {
    Button(action: action) {
      let words = VStack(alignment: .leading, spacing: 2) {
        Text(label).font(.system(size: 12.5, weight: .medium))
        if let hint {
          Text(hint).font(.system(size: 11)).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true).multilineTextAlignment(.leading)
        }
      }
      Group {
        if inline {
          HStack(spacing: 12) { picture; words; Spacer(minLength: 0) }
        } else {
          VStack(alignment: .leading, spacing: 8) { picture; words }
        }
      }
      .padding(9)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .fill(selected ? Color.accentColor.opacity(0.1) : Color.primary.opacity(0.025))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(
          selected ? Color.accentColor : Color.primary.opacity(0.1), lineWidth: selected ? 2 : 1)
      )
      .contentShape(RoundedRectangle(cornerRadius: 10))
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}

extension ThemeColor {
  var swiftUI: Color { Color(nsColor: NSColor(srgbRed: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)) }
}

/// The app's own icon, as the Dock would show it.
struct AppMark: View {
  var size: Double = 34

  var body: some View {
    Image(nsImage: BrandIcon.image()).resizable().frame(width: size, height: size)
  }
}

/// Reads and writes one setting through the model.
extension SettingsModel {
  func binding<Value>(_ key: WritableKeyPath<CapsuleSettings, Value>) -> Binding<Value> {
    Binding(get: { self.settings[keyPath: key] }, set: { value in self.change { $0[keyPath: key] = value } })
  }
}
