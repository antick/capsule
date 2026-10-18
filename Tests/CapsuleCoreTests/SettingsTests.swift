import CapsuleCore
import CapsuleFixtures
import Foundation
import Testing

/// `{ "accepted": settings }` or `{ "rejected": true }`.
struct ParseOutcome: Decodable, Equatable {
  let accepted: CapsuleSettings?
  let rejected: Bool?
}

@Suite("Settings, against the shared corpus")
struct SettingsTests {
  @Test("defaults")
  func defaults() throws {
    let file: FixtureFile<Int?, CapsuleSettings> = try Fixtures.load(
      "settings/defaults"
    )
    #expect(CapsuleSettings.defaults == file.cases.first?.expected)
  }

  @Test("a schema v7 file, field by field")
  func parseCurrent() throws {
    let file: FixtureFile<JSONValue, ParseOutcome> = try Fixtures.load(
      "settings/parse-current"
    )
    for testCase in file.cases {
      let parsed = CapsuleSettings.parseCurrent(testCase.input)
      let actual =
        parsed.map { ParseOutcome(accepted: $0, rejected: nil) }
        ?? ParseOutcome(accepted: nil, rejected: true)
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }
}

/// Decision 9 is a deliberate difference from the Electron app, so the
/// corpus does not cover it; these pin it natively.
@Suite("Reading a stored settings file")
struct SettingsReadTests {
  private func file(_ fields: [String: JSONValue]) -> JSONValue {
    guard
      var stored = try? JSONDecoder().decode(
        [String: JSONValue].self,
        from: JSONEncoder().encode(CapsuleSettings.defaults)
      )
    else { return .null }
    for (key, value) in fields { stored[key] = value }
    return .object(stored)
  }

  @Test("a current file is read")
  func current() {
    let settings = CapsuleSettings.read(file(["placementPreset": .string("left-edge")]))
    #expect(settings?.placementPreset == .leftEdge)
  }

  @Test("an older file falls back to defaults instead of being migrated")
  func older() {
    #expect(CapsuleSettings.read(file(["schemaVersion": .number(5)])) == nil)
  }

  @Test("a file with no schema version is not trusted")
  func unversioned() {
    guard case .object(var fields) = file([:]) else {
      Issue.record("could not build a settings file")
      return
    }
    fields["schemaVersion"] = nil
    #expect(CapsuleSettings.read(.object(fields)) == nil)
  }

  @Test("something that is not a settings object at all")
  func notAnObject() {
    #expect(CapsuleSettings.read(.string("garbage")) == nil)
    #expect(CapsuleSettings.read(.null) == nil)
  }
}

struct PlacementHudOnly: Decodable {
  struct Input: Decodable {
    let hud: HudSize
  }
}

@Suite("Dock styles")
struct DockStyleTests {
  /// The placement fixtures carry the edge gap the TypeScript worked out for
  /// each style, which makes them a check on this port of the same rule.
  @Test("edge gaps match the ones recorded in the placement corpus")
  func edgeGaps() throws {
    let file: FixtureFile<PlacementHudOnly.Input, JSONValue> = try Fixtures.load(
      "placement/compute-placement"
    )
    let m = hudMetrics(1)
    for testCase in file.cases where testCase.name.contains("capsule style") {
      #expect(testCase.input.hud.edgeGap == dockEdgeGap(m, .capsule), "\(testCase.name)")
    }
    for testCase in file.cases where testCase.name.contains("rail style") {
      #expect(testCase.input.hud.edgeGap == dockEdgeGap(m, .rail), "\(testCase.name)")
    }
  }

  @Test("only the rail style can pass for a notch")
  func notch() {
    #expect(styleSupportsNotch(.rail))
    #expect(!styleSupportsNotch(.capsule))
    #expect(!styleSupportsNotch(.tray))
  }
}

@Suite("Settings document")
struct SettingsDocumentTests {
  @Test func defaultsRoundTrip() throws {
    let data = try #require(CapsuleSettings.defaults.documentData)
    #expect(CapsuleSettings.read(data: data) == .defaults)
  }

  @Test func everyFieldRoundTrips() throws {
    var settings = CapsuleSettings.defaults
    settings.placementPreset = .topEdge
    settings.enabledProviderIds = [.codex, .cursor]
    settings.demoMode = true
    settings.pollIntervalMs = 300_000
    settings.hudScale = 1.2
    settings.hudTheme = .ink
    settings.dockStyle = .tray
    settings.autoHide = false
    settings.hideDelay = .relaxed
    settings.topEdgeNotch = false
    settings.usageDisplay = .remaining
    settings.customPosition = DockPosition(x: 120, y: 0)
    let data = try #require(settings.documentData)
    #expect(CapsuleSettings.read(data: data) == settings)
  }

  @Test func absentValuesAreWrittenAsNull() throws {
    let data = try #require(CapsuleSettings.defaults.documentData)
    let text = String(decoding: data, as: UTF8.self)
    #expect(text.contains("\"customPosition\" : null"))
    #expect(text.contains("\"customCorner\" : null"))
  }
}
