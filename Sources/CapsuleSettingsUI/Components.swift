import AppKit
import CapsuleCore
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

/// A small dot and a word, coloured by tone.
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

/// The heading each page opens with.
struct PageHeader: View {
  let title: String
  var description: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title).font(.system(size: 22, weight: .semibold))
      if let description {
        Text(description).font(.system(size: 13)).foregroundStyle(.secondary)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 4)
  }
}

/// A card of related settings.
struct SettingsSection<Content: View, Aside: View>: View {
  var title: String?
  var hint: String?
  var padded = true
  @ViewBuilder let aside: Aside
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let title {
        HStack(alignment: .top, spacing: 16) {
          VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 15, weight: .semibold))
            if let hint {
              Text(hint).font(.system(size: 12.5)).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            }
          }
          Spacer(minLength: 0)
          aside
        }
      }
      content
    }
    .padding(padded ? 20 : 0)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: 16).fill(Color(nsColor: .controlBackgroundColor)))
    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.primary.opacity(0.08)))
    .clipShape(RoundedRectangle(cornerRadius: 16))
  }
}

extension SettingsSection where Aside == EmptyView {
  init(title: String? = nil, hint: String? = nil, padded: Bool = true, @ViewBuilder content: () -> Content) {
    self.init(title: title, hint: hint, padded: padded, aside: { EmptyView() }, content: content)
  }
}

/// One setting: what it is on the left, the control on the right.
struct SettingRow<Control: View>: View {
  let label: String
  var hint: String?
  @ViewBuilder let control: Control

  var body: some View {
    HStack(spacing: 24) {
      VStack(alignment: .leading, spacing: 2) {
        Text(label).font(.system(size: 13.5, weight: .medium))
        if let hint {
          Text(hint).font(.system(size: 12)).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      Spacer(minLength: 0)
      control
    }
    .padding(.vertical, 6)
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
        Text(label).font(.system(size: 13, weight: .medium))
        if let hint {
          Text(hint).font(.system(size: 11.5)).foregroundStyle(.secondary)
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
      .padding(10)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(
        RoundedRectangle(cornerRadius: 12).fill(selected ? Color.accentColor.opacity(0.12) : Color.primary.opacity(0.03))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 12).strokeBorder(
          selected ? Color.accentColor : Color.primary.opacity(0.1), lineWidth: selected ? 1.5 : 1)
      )
      .contentShape(RoundedRectangle(cornerRadius: 12))
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
