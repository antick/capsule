import CapsuleCore
import CapsuleSystem
import CapsuleUsage
import Foundation

/// `capsule`: the same limits the dock shows, as JSON on standard output.
let arguments = Array(CommandLine.arguments.dropFirst())
func has(_ flag: String) -> Bool { arguments.contains(flag) }
func value(after flag: String) -> String? {
  arguments.firstIndex(of: flag).flatMap { $0 + 1 < arguments.count ? arguments[$0 + 1] : nil }
}

if has("--help") || has("-h") {
  print(CLICopy.usage)
  exit(0)
}

/// Inside Capsule Dev.app, or asked for, the dev build's data.
let ownPath = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath().path
let channel: AppChannel = has("--dev") || ownPath.contains("\(AppChannel.development.name).app") ? .development : .production
let store = JSONStore.applicationSupport(channel.supportDirectory)

if has("--version") {
  let plist = URL(fileURLWithPath: ownPath).deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Info.plist")
  let version = (NSDictionary(contentsOf: plist)?["CFBundleShortVersionString"] as? String) ?? "unknown"
  print("capsule \(version)")
  exit(0)
}

let settings =
  FileManager.default.contents(atPath: store.directory.appendingPathComponent(AppIdentity.settingsFile).path)
  .flatMap { CapsuleSettings.read(data: $0) } ?? .defaults
let named = value(after: "--provider")
let wanted = named.flatMap(ProviderId.init(rawValue:))
if let named, wanted == nil {
  FileHandle.standardError.write(Data((CLICopy.unknownProvider(named) + "\n").utf8))
  exit(2)
}
let now = Date()

var snapshots: [UsageSnapshot]
var source = "cache"
if has("--refresh") {
  source = "live"
  let host = MacPollerHost(store: store).usage
  let meters = settings.enabledMeters
  var read: [UsageSnapshot] = []
  for provider in usageProviders(settings) where meters.contains(provider.meter) {
    if let wanted, provider.id != wanted { continue }
    guard var snapshot = try? await provider.fetchSnapshot(host, now: now) else { continue }
    snapshot.accountId = provider.meter.account
    snapshot.displayName = settings.label(for: provider.meter)
    read.append(snapshot)
  }
  snapshots = read
} else {
  snapshots = (store.load(StoreFiles.snapshots, as: [UsageSnapshot].self) ?? [])
    .filter { wanted == nil || $0.providerId == wanted }
}

guard !snapshots.isEmpty else {
  FileHandle.standardError.write(Data((CLICopy.nothing + "\n").utf8))
  exit(1)
}
let encoder = JSONEncoder()
encoder.outputFormatting = has("--pretty") ? [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes] : [.sortedKeys, .withoutEscapingSlashes]
let data = try encoder.encode(limitsReport(snapshots, source: source, now: now))
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
