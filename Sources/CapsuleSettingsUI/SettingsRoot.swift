import AppKit
import CapsuleCore
import SwiftUI

/// The panes of the settings window, in sidebar order.
struct Pane: Identifiable {
  let page: SettingsPage
  let title: String
  let symbol: String
  let tint: Color
  var id: SettingsPage { page }

  static let all: [Pane] = [
    Pane(page: .general, title: Copy.general, symbol: "gearshape.fill", tint: .gray),
    Pane(page: .appearance, title: Copy.appearance, symbol: "paintpalette.fill", tint: .indigo),
    Pane(page: .menuBar, title: Copy.menuBar, symbol: "menubar.rectangle", tint: .blue),
    Pane(page: .providers, title: Copy.providers, symbol: "powerplug.fill", tint: .green),
    Pane(page: .accounts, title: Copy.accountsPane, symbol: "person.2.fill", tint: .teal),
    Pane(page: .cards, title: Copy.cardsPane, symbol: "rectangle.stack.fill", tint: .orange),
    Pane(page: .history, title: Copy.history, symbol: "chart.xyaxis.line", tint: .pink),
    Pane(page: .updates, title: UpdateCopy.updates, symbol: "arrow.down.circle.fill", tint: .purple),
  ]
}

/// The settings window's content: the system's split view, a sidebar of
/// panes, and the chosen pane as a grouped form.
public struct SettingsRoot: View {
  @ObservedObject var model: SettingsModel

  public init(model: SettingsModel) { self.model = model }

  public var body: some View {
    NavigationSplitView {
      List(selection: Binding(get: { model.page }, set: { if let page = $0 { model.page = page } })) {
        ForEach(Pane.all) { pane in
          Label {
            Text(pane.title)
          } icon: {
            PaneIcon(symbol: pane.symbol, tint: pane.tint)
          }
          .tag(pane.page)
        }
      }
      .listStyle(.sidebar)
      .navigationSplitViewColumnWidth(min: 200, ideal: 216, max: 260)
      .safeAreaInset(edge: .bottom) { identity }
    } detail: {
      page
        .navigationTitle(title)
        .frame(minWidth: 520)
    }
    .navigationSplitViewStyle(.balanced)
    .frame(minWidth: 780, minHeight: 560)
  }

  private var title: String {
    Pane.all.first { $0.page == model.page }?.title ?? Copy.welcome
  }

  @ViewBuilder private var page: some View {
    switch model.page {
    case .general: GeneralPage(model: model)
    case .appearance: AppearancePage(model: model)
    case .menuBar: MenuBarPage(model: model)
    case .providers: ProvidersPage(model: model)
    case .accounts: AccountsPage(model: model)
    case .cards: CardsPage(model: model)
    case .history: HistoryPage(model: model)
    case .updates: UpdatesPage(model: model)
    case .onboarding: OnboardingPage(model: model)
    }
  }

  /// Which Capsule this is and whether it is current, at the sidebar's foot.
  private var identity: some View {
    Button { model.page = .updates } label: {
      HStack(spacing: 10) {
        AppMark(size: 30)
        VStack(alignment: .leading, spacing: 1) {
          Text(AppIdentity.name).font(.system(size: 12.5, weight: .semibold))
          HStack(spacing: 6) {
            Text("\(Copy.versionPrefix) \(model.update.currentVersion)").font(.system(size: 11)).foregroundStyle(.secondary)
            StatusPill(tone: Tone(model.update.tone), text: model.update.shortLabel)
          }
        }
        Spacer(minLength: 0)
      }
      .padding(10)
      .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.primary.opacity(0.05)))
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .padding(.horizontal, 10).padding(.bottom, 10)
    .accessibilityLabel("\(AppIdentity.name) \(model.update.currentVersion), \(model.update.shortLabel)")
  }
}

/// The settings window: an ordinary titled window whose toolbar and title
/// come from the split view. While it is open Capsule shows in the Dock and
/// the app switcher, so it can be found, minimised and brought back like any
/// window; closing it puts Capsule back in the menu bar alone.
@MainActor
public final class SettingsWindowController: NSWindowController, NSWindowDelegate {
  public let model: SettingsModel

  public init(model: SettingsModel) {
    self.model = model
    let hosting = NSHostingController(rootView: SettingsRoot(model: model))
    hosting.sceneBridgingOptions = [.title, .toolbars]
    let window = NSWindow(contentViewController: hosting)
    window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
    window.toolbarStyle = .unified
    window.setContentSize(NSSize(width: SettingsWindowSize.width, height: SettingsWindowSize.height))
    window.minSize = NSSize(width: SettingsWindowSize.minWidth, height: SettingsWindowSize.minHeight)
    window.isReleasedWhenClosed = false
    window.setFrameAutosaveName(SettingsWindowSize.autosaveName)
    window.center()
    super.init(window: window)
    window.delegate = self
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("built in code") }

  /// Shows the window on a page and brings Capsule forward as a regular app.
  public func show(_ page: SettingsPage) {
    model.page = page
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
    if window?.isMiniaturized == true { window?.deminiaturize(nil) }
    showWindow(nil)
    window?.makeKeyAndOrderFront(nil)
  }

  /// Back to living in the menu bar only.
  public func windowWillClose(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
  }
}

public enum SettingsWindowSize {
  public static let width = 900.0
  public static let height = 680.0
  public static let minWidth = 780.0
  public static let minHeight = 560.0
  public static let autosaveName = "CapsuleSettingsWindow"
}

extension Copy {
  public static let menuBarPane = "Menu bar"
  public static let accountsPane = "Accounts & keys"
  public static let cardsPane = "Cards"
  public static let welcome = "Welcome"
  public static let versionPrefix = "Version"
}
