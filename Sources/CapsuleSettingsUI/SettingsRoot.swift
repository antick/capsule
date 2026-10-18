import AppKit
import CapsuleCore
import SwiftUI

/// The settings window's content: a sidebar of pages and the page itself.
public struct SettingsRoot: View {
  @ObservedObject var model: SettingsModel

  public init(model: SettingsModel) { self.model = model }

  private let nav: [(SettingsPage, String, String)] = [
    (.appearance, Copy.appearance, "paintpalette"),
    (.providers, Copy.providers, "powerplug"),
    (.updates, UpdateCopy.updates, "arrow.down.to.line"),
    (.general, Copy.general, "gearshape"),
  ]

  public var body: some View {
    HStack(spacing: 0) {
      sidebar
      Divider()
      ScrollView {
        page.padding(.horizontal, 32).padding(.top, 20).padding(.bottom, 48)
          .frame(maxWidth: 672)
          .frame(maxWidth: .infinity)
      }
      .background(Color(nsColor: .windowBackgroundColor))
    }
    .frame(minWidth: 820, minHeight: 600)
  }

  @ViewBuilder private var page: some View {
    switch model.page {
    case .appearance: AppearancePage(model: model)
    case .providers: ProvidersPage(model: model)
    case .updates: UpdatesPage(model: model)
    case .general: GeneralPage(model: model)
    case .onboarding: OnboardingPage(model: model)
    }
  }

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 10) {
        AppMark()
        VStack(alignment: .leading, spacing: 1) {
          Text(AppIdentity.name).font(.system(size: 15, weight: .semibold))
          Text("Version \(model.update.currentVersion)").font(.system(size: 11.5)).foregroundStyle(.secondary)
        }
      }
      .padding(.horizontal, 16).padding(.top, 52).padding(.bottom, 20)
      ForEach(nav, id: \.0) { item in navLink(item.0, item.1, item.2) }
        .padding(.horizontal, 10)
      Spacer()
      Button { model.page = .updates } label: {
        HStack {
          Text(UpdateCopy.updates).font(.system(size: 11.5)).foregroundStyle(.secondary)
          Spacer()
          StatusPill(tone: Tone(model.update.tone), text: model.update.shortLabel)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.primary.opacity(0.1)))
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .padding(.horizontal, 10).padding(.bottom, 12)
    }
    .frame(width: 228)
    .background(SidebarMaterial())
  }

  private func navLink(_ page: SettingsPage, _ label: String, _ symbol: String) -> some View {
    let active = model.page == page
    return Button { model.page = page } label: {
      HStack(spacing: 10) {
        Image(systemName: symbol).frame(width: 16).foregroundStyle(active ? Color.accentColor : .secondary)
        Text(label).font(.system(size: 13.5, weight: active ? .medium : .regular))
        Spacer()
      }
      .padding(.horizontal, 10).padding(.vertical, 7)
      .background(RoundedRectangle(cornerRadius: 10).fill(active ? Color.primary.opacity(0.08) : .clear))
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(active ? .isSelected : [])
  }
}

/// The macOS sidebar material behind the page list.
struct SidebarMaterial: NSViewRepresentable {
  func makeNSView(context: Context) -> NSVisualEffectView {
    let view = NSVisualEffectView()
    view.material = .sidebar
    view.blendingMode = .behindWindow
    view.state = .followsWindowActiveState
    return view
  }

  func updateNSView(_ view: NSVisualEffectView, context: Context) {}
}

/// The settings window: an ordinary, titled window with the content running
/// under a transparent title bar.
@MainActor
public final class SettingsWindowController: NSWindowController, NSWindowDelegate {
  public let model: SettingsModel

  public init(model: SettingsModel) {
    self.model = model
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 940, height: 740),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered, defer: false
    )
    window.title = "\(AppIdentity.name) Settings"
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.minSize = NSSize(width: 820, height: 600)
    window.isReleasedWhenClosed = false
    window.contentView = NSHostingView(rootView: SettingsRoot(model: model))
    window.center()
    super.init(window: window)
    window.delegate = self
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("built in code") }

  /// Shows the window on a page, bringing the app forward: an accessory app
  /// has no Dock tile, so nothing else will.
  public func show(_ page: SettingsPage) {
    model.page = page
    NSApp.activate(ignoringOtherApps: true)
    if window?.isMiniaturized == true { window?.deminiaturize(nil) }
    showWindow(nil)
    window?.makeKeyAndOrderFront(nil)
  }
}
