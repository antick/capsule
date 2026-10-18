import Foundation

/// Everything about updating Capsule that is not the updater itself: the
/// state it publishes, the words for each phase, and the arithmetic the
/// updates pane would otherwise do inline. Mirrors `updates.ts`.
public enum AppRepo {
  public static let owner = "antick"
  public static let name = "capsule"
  public static let releasesURL = "https://github.com/\(owner)/\(name)/releases"
  /// The newest published release, as GitHub's API describes it.
  public static let latestReleaseAPI = "https://api.github.com/repos/\(owner)/\(name)/releases/latest"
}

public enum UpdateTiming {
  public static let launchDelayMs = 15_000.0
  public static let intervalMs = 24 * 60 * 60 * 1000.0
  /// How long a check may run before it is called a failure.
  public static let timeoutMs = 30_000.0
}

/// The page for one published version, which is where a manual install starts.
public func releaseURL(for version: String?) -> String {
  // `!version`: an empty string is no version, as it is in JavaScript.
  guard let version, !version.isEmpty else { return AppRepo.releasesURL }
  let tag = version.hasPrefix("v") ? version : "v\(version)"
  return "\(AppRepo.releasesURL)/tag/\(tag)"
}

public enum UpdatePhase: String, Sendable, Codable, CaseIterable {
  case idle, checking, available, downloading, ready, current, error, unsupported
}

public enum UpdateTone: String, Sendable, Codable {
  case good, warn, bad, neutral, busy
}

public struct UpdateProgress: Sendable, Codable, Equatable {
  /// 0 to 1.
  public var fraction: Double
  public var transferredBytes: Double
  public var totalBytes: Double
  public var bytesPerSecond: Double

  public init(fraction: Double, transferredBytes: Double, totalBytes: Double, bytesPerSecond: Double) {
    self.fraction = fraction
    self.transferredBytes = transferredBytes
    self.totalBytes = totalBytes
    self.bytesPerSecond = bytesPerSecond
  }
}

public struct UpdateState: Sendable, Codable, Equatable {
  public var phase: UpdatePhase
  /// The version running right now.
  public var currentVersion: String
  /// The version the feed is offering, once a check has found one.
  public var availableVersion: String?
  /// Notes for that version, already reduced to plain text.
  public var releaseNotes: String?
  /// ISO instant the last check finished, successfully or not.
  public var checkedAt: String?
  public var progress: UpdateProgress?
  public var error: String?
  /// Whether this build is one macOS will let replace itself in place.
  public var canInstall: Bool

  public static func initial(version: String, canInstall: Bool) -> UpdateState {
    UpdateState(
      phase: canInstall ? .idle : .unsupported, currentVersion: version, availableVersion: nil,
      releaseNotes: nil, checkedAt: nil, progress: nil, error: nil, canInstall: canInstall
    )
  }

  public var tone: UpdateTone {
    switch phase {
    case .idle, .unsupported: return .neutral
    case .checking, .downloading: return .busy
    case .available: return .warn
    case .ready, .current: return .good
    case .error: return .bad
    }
  }

  /// Whether asking for a check right now would do anything.
  public var canCheck: Bool { phase != .unsupported && phase != .checking && phase != .downloading && phase != .ready }

  /// Background checks must not refocus an update already awaiting a decision.
  public var canCheckAutomatically: Bool {
    canInstall && (phase == .idle || phase == .current || phase == .error)
  }

  /// The standing in two or three words, for the sidebar and menus.
  public var shortLabel: String {
    switch phase {
    case .idle: return "Not checked"
    case .checking: return "Checking"
    case .available: return "Available"
    case .downloading: return "Downloading"
    case .ready: return "Ready"
    case .current: return "Up to date"
    case .error: return "Update failed"
    case .unsupported: return "Manual"
    }
  }

  public var title: String {
    switch phase {
    case .checking: return UpdateCopy.checking
    case .available: return UpdateCopy.availableTitle
    case .downloading: return UpdateCopy.downloadingTitle
    case .ready: return UpdateCopy.readyTitle
    case .current: return UpdateCopy.upToDate
    case .error: return UpdateCopy.errorTitle
    case .unsupported: return UpdateCopy.unsupportedTitle
    case .idle: return UpdateCopy.idleTitle
    }
  }

  public var detail: String? {
    switch phase {
    case .available, .downloading:
      return availableVersion.map {
        "\(UpdateCopy.availableDetailPrefix)\($0)\(UpdateCopy.availableDetailSuffix)"
      } ?? UpdateCopy.availableDetail
    case .ready: return UpdateCopy.readyDetail
    case .current: return UpdateCopy.upToDateDetail
    case .error: return error
    case .unsupported: return UpdateCopy.unsupportedDetail
    case .idle: return UpdateCopy.idleDetail
    case .checking: return nil
    }
  }
}

public enum UpdateCopy {
  public static let updates = "Updates"
  public static let updatesHint =
    "Install verified updates from Capsule’s public releases. Checks contact the update host; no provider sessions or usage readings are sent."
  public static let currentVersion = "Current version"
  public static let checkNow = "Check now"
  public static let checking = "Checking…"
  public static let upToDate = "Capsule is up to date"
  public static let upToDateDetail = "You are running the newest release."
  public static let idleTitle = "Not checked yet"
  public static let idleDetail = "Check to see whether a newer release is available."
  public static let availableTitle = "Update available"
  public static let availableDetail = "A newer release is ready to download."
  public static let availableDetailPrefix = "Capsule "
  public static let availableDetailSuffix = " is ready to download."
  public static let downloadingTitle = "Downloading update"
  public static let readyTitle = "Update ready to install"
  public static let readyDetail = "Restart to finish installing, or the update will be applied when you quit Capsule."
  public static let errorTitle = "Could not update Capsule"
  public static let timedOut = "The update service did not answer in time."
  public static let unsupportedTitle = "Updates are handled outside this build"
  public static let unsupportedDetail =
    "Development builds do not check for or install updates. Install Capsule from its release page for everyday use."
  public static let download = "Download"
  public static let restartAndInstall = "Restart and install"
  public static let viewRelease = "View release"
  public static let releaseNotes = "What's new"
  public static let lastChecked = "Last checked"
  public static let never = "Never"
  public static let autoCheck = "Check automatically"
  public static let autoCheckHint = "Look for a new release on launch and once a day after that."
  public static let autoDownload = "Download in the background"
  public static let autoDownloadHint =
    "Fetch a new release as soon as it is found, so installing is only a restart."
  public static let menuCheck = "Check for Updates…"
  public static let menuReady = "Restart to Update"
  public static let ofSize = " of "
}

private let byteUnits = ["B", "KB", "MB", "GB"]

/// Download sizes, at the precision a progress line can use: one decimal,
/// never a bare ".0".
public func formatBytes(_ bytes: Double) -> String {
  guard bytes.isFinite, bytes > 0 else { return "0 MB" }
  var value = bytes
  var unit = 0
  while value >= 1024, unit < byteUnits.count - 1 {
    value /= 1024
    unit += 1
  }
  // `Number(value.toFixed(1))`: an exact tie rounds up, as `toFixed` does.
  let rounded = value >= 100 ? jsRound(value) : (value * 10).rounded(.toNearestOrAwayFromZero) / 10
  return "\(jsString(.number(rounded))) \(byteUnits[unit])"
}

/// How far a download has got, as one line: "12.4 MB of 98.1 MB".
public func formatProgress(_ progress: UpdateProgress) -> String {
  "\(formatBytes(progress.transferredBytes))\(UpdateCopy.ofSize)\(formatBytes(progress.totalBytes))"
}

private let maxReleaseNoteChars = 1200

/// Release notes as plain text. GitHub hands them over as HTML; the tags are
/// dropped rather than rendered, so a release body can never run script.
public func plainReleaseNotes(_ raw: JSONValue?) -> String? {
  guard let text = releaseNoteText(raw) else { return nil }
  var stripped = text
  let rules: [(String, String, Bool)] = [
    ("<br\\s*/?>", "\n", true),
    ("</(p|li|h\\d|div)>", "\n", true),
    ("<li[^>]*>", "• ", true),
    ("<[^>]+>", "", false),
  ]
  for (pattern, replacement, caseless) in rules {
    stripped = replace(stripped, pattern, replacement, caseless: caseless)
  }
  for (entity, character) in [
    ("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'"),
  ] {
    stripped = stripped.replacingOccurrences(of: entity, with: character)
  }
  stripped = replace(stripped, "[ \\t]+\\n", "\n", caseless: false)
  stripped = replace(stripped, "\\n{3,}", "\n\n", caseless: false)
  stripped = jsTrim(stripped)
  guard !stripped.isEmpty else { return nil }
  guard stripped.utf16.count > maxReleaseNoteChars else { return stripped }
  let head = jsSlice(stripped, maxReleaseNoteChars)
  return "\(trimEnd(head))…"
}

private func releaseNoteText(_ raw: JSONValue?) -> String? {
  switch raw {
  case .string(let text): return text
  case .array(let entries):
    // One entry per release when several were skipped.
    return entries.map { entry in
      guard let note = entry["note"] else { return "" }
      if case .null = note { return "" }
      return jsString(note)
    }
    .filter { !$0.isEmpty }
    .joined(separator: "\n\n")
  default: return nil
  }
}

private func replace(_ text: String, _ pattern: String, _ replacement: String, caseless: Bool) -> String {
  guard
    let regex = try? NSRegularExpression(
      pattern: pattern, options: caseless ? [.caseInsensitive] : []
    )
  else { return text }
  let range = NSRange(text.startIndex..., in: text)
  return regex.stringByReplacingMatches(
    in: text, range: range, withTemplate: NSRegularExpression.escapedTemplate(for: replacement)
  )
}

private func trimEnd(_ text: String) -> String {
  var scalars = Substring(text).unicodeScalars
  while let last = scalars.last, jsIsSpace(last) { scalars.removeLast() }
  return String(scalars)
}
