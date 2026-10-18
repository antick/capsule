import CapsuleCore
import CapsuleFixtures
import Testing

@Suite("Update wording and sizes, against the shared corpus")
struct UpdateTests {
  @Test("Scheduled checks leave pending updates and development builds alone")
  func quietAutomaticChecks() {
    for phase in [UpdatePhase.available, .downloading, .ready, .checking, .unsupported] {
      var state = UpdateState.initial(version: "0.2.1", canInstall: true)
      state.phase = phase
      #expect(!state.canCheckAutomatically)
    }
    for phase in [UpdatePhase.idle, .current, .error] {
      var state = UpdateState.initial(version: "0.2.1", canInstall: true)
      state.phase = phase
      #expect(state.canCheckAutomatically)
      state.canInstall = false
      #expect(!state.canCheckAutomatically)
    }
  }

  @Test("formatBytes")
  func bytes() throws {
    let file: FixtureFile<Double, String> = try Fixtures.load("updates/format-bytes")
    for testCase in file.cases {
      #expect(formatBytes(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("formatProgress")
  func progress() throws {
    let file: FixtureFile<UpdateProgress, String> = try Fixtures.load("updates/format-progress")
    for testCase in file.cases {
      #expect(formatProgress(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  struct InitialInput: Decodable {
    let version: String
    let canInstall: Bool
  }

  @Test("initialUpdateState")
  func initial() throws {
    let file: FixtureFile<InitialInput, UpdateState> = try Fixtures.load("updates/initial-state")
    for testCase in file.cases {
      #expect(
        UpdateState.initial(version: testCase.input.version, canInstall: testCase.input.canInstall)
          == testCase.expected,
        "\(testCase.name)"
      )
    }
  }

  @Test("plainReleaseNotes")
  func notes() throws {
    let file: FixtureFile<JSONValue, String?> = try Fixtures.load("updates/plain-release-notes")
    for testCase in file.cases {
      #expect(plainReleaseNotes(testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("releaseUrlFor")
  func url() throws {
    let file: FixtureFile<String?, String> = try Fixtures.load("updates/release-url")
    for testCase in file.cases {
      #expect(releaseURL(for: testCase.input) == testCase.expected, "\(testCase.name)")
    }
  }

  struct Wording: Decodable, Equatable {
    let tone: String
    let shortLabel: String
    let title: String
    let detail: String?
    let canCheck: Bool
  }

  @Test("tone, labels and whether a check can start")
  func wording() throws {
    let file: FixtureFile<UpdateState, Wording> = try Fixtures.load("updates/wording")
    for testCase in file.cases {
      let state = testCase.input
      let got = Wording(
        tone: state.tone.rawValue, shortLabel: state.shortLabel, title: state.title,
        detail: state.detail, canCheck: state.canCheck
      )
      #expect(got == testCase.expected, "\(testCase.name)")
    }
  }
}
