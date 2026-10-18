import AppKit
import CapsuleCore
import Foundation

/// Looks for a newer release on GitHub and says so. This build cannot replace
/// itself — that arrives with Sparkle at the cutover (tasks 4.1 to 4.5) — so a
/// release that is found is downloaded from its page, by hand.
@MainActor
public final class Updater {
  public private(set) var state: UpdateState
  public var onChange: ((UpdateState) -> Void)?
  private let autoCheck: () -> Bool
  private let session: URLSession
  private var launchTimer: Timer?
  private var dailyTimer: Timer?
  private var inFlight: Task<Void, Never>?

  public init(version: String, autoCheck: @escaping () -> Bool) {
    state = .initial(version: version, canInstall: false)
    self.autoCheck = autoCheck
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = UpdateTiming.timeoutMs / 1000
    configuration.timeoutIntervalForResource = UpdateTiming.timeoutMs / 1000
    session = URLSession(configuration: configuration)
  }

  /// Once shortly after launch, so a cold start is not competing with the
  /// first usage poll, and once a day after that, while the setting allows.
  public func syncSchedule() {
    launchTimer?.invalidate()
    dailyTimer?.invalidate()
    launchTimer = nil
    dailyTimer = nil
    guard autoCheck() else { return }
    launchTimer = Timer.scheduledTimer(withTimeInterval: UpdateTiming.launchDelayMs / 1000, repeats: false) {
      [weak self] _ in MainActor.assumeIsolated { self?.check() }
    }
    dailyTimer = Timer.scheduledTimer(withTimeInterval: UpdateTiming.intervalMs / 1000, repeats: true) {
      [weak self] _ in MainActor.assumeIsolated { self?.check() }
    }
  }

  public func stop() {
    launchTimer?.invalidate()
    dailyTimer?.invalidate()
  }

  /// Asks GitHub for the newest release.
  public func check() {
    guard inFlight == nil, state.canCheck else { return }
    publish { $0.phase = .checking; $0.error = nil }
    let session = session
    inFlight = Task { [weak self] in
      let outcome = await Self.latest(session)
      guard let self else { return }
      self.inFlight = nil
      let checked = isoString(Date())
      switch outcome {
      case .success(let release):
        let newer = Self.isNewer(release.version, than: self.state.currentVersion)
        self.publish {
          $0.phase = newer ? .available : .current
          $0.availableVersion = newer ? release.version : nil
          $0.releaseNotes = newer ? plainReleaseNotes(release.notes.map(JSONValue.string)) : nil
          $0.checkedAt = checked
          $0.error = nil
        }
      case .failure(let message):
        self.publish {
          $0.phase = .error
          $0.error = message
          $0.checkedAt = checked
        }
      }
    }
  }

  /// This build installs by hand: the release page is the download.
  public func download() { openReleasePage() }

  public func openReleasePage() {
    guard let url = URL(string: releaseURL(for: state.availableVersion ?? state.currentVersion)) else { return }
    NSWorkspace.shared.open(url)
  }

  private func publish(_ change: (inout UpdateState) -> Void) {
    change(&state)
    onChange?(state)
  }

  private struct Release {
    let version: String
    let notes: String?
  }

  private enum Outcome {
    case success(Release)
    case failure(String)
  }

  private static func latest(_ session: URLSession) async -> Outcome {
    guard let url = URL(string: AppRepo.latestReleaseAPI) else { return .failure(UpdateCopy.errorTitle) }
    var request = URLRequest(url: url)
    request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await session.data(for: request)
      guard let http = response as? HTTPURLResponse, http.statusCode == 200,
        let body = JSONValue.parse(String(decoding: data, as: UTF8.self)),
        let tag = body["tag_name"]?.asString
      else {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        return .failure("GitHub answered \(status).")
      }
      let version = tag.hasPrefix("v") ? String(tag.dropFirst()) : tag
      return .success(Release(version: version, notes: body["body"]?.asString))
    } catch let error as URLError where error.code == .timedOut {
      return .failure(UpdateCopy.timedOut)
    } catch {
      return .failure(error.localizedDescription)
    }
  }

  /// Dotted versions compared number by number; anything after a hyphen is
  /// ignored.
  static func isNewer(_ candidate: String, than current: String) -> Bool {
    func parts(_ version: String) -> [Int] {
      let core = version.split(separator: "-").first.map(String.init) ?? version
      return core.split(separator: ".").map { Int($0) ?? 0 }
    }
    let a = parts(candidate)
    let b = parts(current)
    for index in 0..<max(a.count, b.count) {
      let x = index < a.count ? a[index] : 0
      let y = index < b.count ? b[index] : 0
      if x != y { return x > y }
    }
    return false
  }
}
