import CapsuleActivity
import CapsuleCore
import CapsuleSystem
import Foundation
import Testing

@testable import CapsuleShell

@Suite("Carrying over from the Electron app")
struct CarryOverTests {
  func store() throws -> JSONStore {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("capsule-carry-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return JSONStore(directory: url)
  }

  func write(_ text: String, _ name: String, in store: JSONStore) throws {
    try Data(text.utf8).write(to: store.directory.appendingPathComponent(name))
  }

  var v7: String {
    """
    {"settings": {"placementPreset": "left-edge", "enabledProviderIds": ["codex", "cursor"], "demoMode": false,
      "pollIntervalMs": 300000, "launchAtLogin": false, "hudScale": 1.2, "hudTheme": "ink", "dockStyle": "tray",
      "cornerArc": false, "autoHide": false, "notificationPopups": true, "autoUpdateCheck": true,
      "autoUpdateDownload": false, "hideDelay": "quick", "customCorner": null, "topEdgeNotch": true,
      "usageDisplay": "remaining", "customPosition": {"x": 0, "y": 240}, "schemaVersion": 7},
     "backoff": {"claude": 1800000000000}}
    """
  }

  @Test func adoptsVersion7SettingsReadingsAndPenalties() throws {
    let store = try store()
    try write(v7, ElectronFiles.settings, in: store)
    try write(
      """
      {"snapshots": [{"providerId": "codex", "displayName": "Codex", "iconId": "codex", "primaryPercent": 21,
        "buckets": [], "status": "ok", "fetchedAt": "2026-08-27T11:22:00.000Z"}],
       "tokenCache": {"/a.jsonl": {"size": 10, "modifiedMs": 1, "days": {"2026-08-27": 5}}}}
      """, ElectronFiles.readings, in: store)
    #expect(CarryOver.run(store) == .adopted)
    let settings = Engine.loadSettings(store)
    #expect(settings.placementPreset == .leftEdge)
    #expect(settings.enabledProviderIds == [.codex, .cursor])
    #expect(settings.hudTheme == .ink)
    #expect(settings.customPosition == DockPosition(x: 0, y: 240))
    let snapshots: [UsageSnapshot]? = store.load(StoreFiles.snapshots)
    #expect(snapshots?.first?.primaryPercent == 21)
    let backoff: [String: Double]? = store.load(StoreFiles.backoff)
    #expect(backoff?["claude"] == 1_800_000_000_000)
    let cache: [String: TokenFileEntry]? = store.load(StoreFiles.tokenCache)
    #expect(cache?["/a.jsonl"]?.size == 10)
  }

  @Test func runsOnceOnly() throws {
    let store = try store()
    try write(v7, ElectronFiles.settings, in: store)
    #expect(CarryOver.run(store) == .adopted)
    var changed = Engine.loadSettings(store)
    changed.hudTheme = .linen
    Engine.saveSettings(changed, to: store)
    #expect(CarryOver.run(store) == .skipped)
    #expect(Engine.loadSettings(store).hudTheme == .linen)
  }

  @Test func anOlderOrBrokenFileStartsFresh() throws {
    for text in [
      #"{"settings": {"placementPreset": "right-edge", "enabledProviderIds": ["claude"], "demoMode": false, "pollIntervalMs": 60000, "launchAtLogin": false}}"#,
      "not json at all",
    ] {
      let store = try store()
      try write(text, ElectronFiles.settings, in: store)
      #expect(CarryOver.run(store) == .fresh)
      #expect(Engine.loadSettings(store) == .defaults)
    }
  }

  @Test func nothingToCarryIsAFirstRun() throws {
    #expect(CarryOver.run(try store()) == .fresh)
  }

  @Test func aNativeAppWithItsOwnSettingsIsLeftAlone() throws {
    let store = try store()
    var mine = CapsuleSettings.defaults
    mine.dockStyle = .capsule
    Engine.saveSettings(mine, to: store)
    try write(v7, ElectronFiles.settings, in: store)
    #expect(CarryOver.run(store) == .skipped)
    #expect(Engine.loadSettings(store).dockStyle == .capsule)
  }
}
