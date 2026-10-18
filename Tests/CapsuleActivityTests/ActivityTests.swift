import CapsuleActivity
import CapsuleCore
import CapsuleFixtures
import Foundation
import Testing

/// A registry record as the corpus stores it: dates as ISO strings.
struct RecordExpected: Decodable, Equatable {
  let pid: Int
  let startedAt: String?
  let session: AgentSession
}

struct CandidateInput: Decodable {
  let id: String
  let name: String
  let at: String
}

struct EventsInput: Decodable {
  let session: AgentSession
  let raw: String?
}

struct TokenExpected: Decodable, Equatable {
  let at: String
  let tokens: Double
}

func recorded(_ row: TokenRow?) -> TokenExpected? {
  row.map { TokenExpected(at: isoString($0.at), tokens: $0.tokens) }
}

@Suite("Registry parsing and the Codex hint, against the shared corpus")
struct RegistryTests {
  @Test("parseClaudeSession")
  func claudeSession() throws {
    let file: FixtureFile<JSONValue, RecordExpected?> = try Fixtures.load(
      "activity/claude-session"
    )
    let now = try file.now()
    for testCase in file.cases {
      let actual = parseClaudeSession(testCase.input, now: now).map {
        RecordExpected(pid: $0.pid, startedAt: $0.startedAt.map(isoString), session: $0.session)
      }
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("parseProcStart")
  func procStart() throws {
    let file: FixtureFile<String, String?> = try Fixtures.load("activity/proc-start")
    for testCase in file.cases {
      #expect(parseProcStart(testCase.input).map(isoString) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("codexSessionFrom")
  func codexHint() throws {
    let file: FixtureFile<[CandidateInput], AgentSession?> = try Fixtures.load(
      "activity/codex-session"
    )
    let now = try file.now()
    for testCase in file.cases {
      let candidates = testCase.input.map {
        CodexCandidate(id: $0.id, name: $0.name, at: looseDate($0.at))
      }
      #expect(codexSessionFrom(candidates, now: now) == testCase.expected, "\(testCase.name)")
    }
  }
}

@Suite("Local event evidence, against the shared corpus")
struct LocalEventTests {
  @Test("applyLocalEvents")
  func events() throws {
    let file: FixtureFile<EventsInput, AgentSession> = try Fixtures.load(
      "activity/local-events"
    )
    for testCase in file.cases {
      let actual = applyLocalEvents(testCase.input.session, testCase.input.raw)
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  /// Swift reads "\r\n" as one character, so a naive split on "\n" would
  /// leave a Windows-style log as one unparseable line.
  @Test("a log with CRLF line endings is still read line by line")
  func crlf() {
    let session = AgentSession(
      id: "codex.t", providerId: .codex, name: "T", detail: "", state: .idle,
      waitingFor: nil, since: "2026-09-06T12:00:00.000Z", confirmed: false
    )
    let raw =
      #"{"timestamp":"2026-09-06T12:00:01Z","type":"event_msg","payload":{"type":"task_started"}}"#
      + "\r\n"
      + #"{"timestamp":"2026-09-06T12:00:02Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"t1"}}"#
    let result = applyLocalEvents(session, raw)
    #expect(result.state == .idle)
    #expect(result.completion?.id == "t1")
  }
}

enum TrackerStep: Decodable {
  case update(activity: [ProviderId: [AgentSession]], now: String?)
  case markRead(indexes: [Int])
  case dismiss(index: Int)

  private enum Keys: String, CodingKey { case op, activity, now, indexes, index }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    switch try c.decode(String.self, forKey: .op) {
    case "update":
      self = .update(
        activity: try c.decode([ProviderId: [AgentSession]].self, forKey: .activity),
        now: try c.decodeIfPresent(String.self, forKey: .now)
      )
    case "markRead": self = .markRead(indexes: try c.decode([Int].self, forKey: .indexes))
    case "dismiss": self = .dismiss(index: try c.decode(Int.self, forKey: .index))
    case let op:
      throw DecodingError.dataCorruptedError(
        forKey: .op, in: c, debugDescription: "unknown tracker step \(op)"
      )
    }
  }
}

struct TrackerInput: Decodable {
  let startedAt: String
  let steps: [TrackerStep]
}

@Suite("The notice tracker, against the shared corpus")
struct NoticeTrackerTests {
  @Test("replayed over each case's steps")
  func replay() throws {
    let file: FixtureFile<TrackerInput, [[ActivityNotice]]> = try Fixtures.load(
      "activity/notice-tracker"
    )
    for testCase in file.cases {
      let tracker = NoticeTracker(startedAt: try #require(looseDate(testCase.input.startedAt)))
      func idAt(_ index: Int) -> String {
        index < tracker.notices.count ? tracker.notices[index].id : ""
      }
      let after: [[ActivityNotice]] = testCase.input.steps.map { step in
        switch step {
        case .update(let activity, let now):
          return tracker.update(activity, now: now.flatMap(looseDate))
        case .markRead(let indexes):
          return tracker.markRead(indexes.map(idAt))
        case .dismiss(let index):
          return tracker.dismiss(idAt(index))
        }
      }
      #expect(after == testCase.expected, "\(testCase.name)")
    }
  }

  /// The corpus cannot hold a thousand-session case, so eviction is pinned
  /// here: once `maxSeen` ids are remembered, the oldest is forgotten first.
  @Test("the oldest remembered id is the one forgotten")
  func forgetsOldestFirst() throws {
    let now = try #require(looseDate("2026-09-06T12:00:00Z"))
    let tracker = NoticeTracker(startedAt: now)
    func done(_ id: String) -> AgentSession {
      AgentSession(
        id: "codex.\(id)", providerId: .codex, name: id, detail: "", state: .idle,
        waitingFor: nil, since: "2026-09-06T12:00:00.000Z",
        completion: AgentCompletion(id: id, at: "2026-09-06T12:00:00.000Z"), confirmed: true
      )
    }
    tracker.update([.codex: [done("first")]], now: now)
    let fillers = (0..<NoticeTuning.maxSeen).map { done("filler-\($0)") }
    tracker.update([.codex: fillers], now: now)

    // "first" was the oldest of maxSeen + 1 remembered ids, so it is gone and
    // shows again. The newest filler is still remembered and does not.
    let again = tracker.update([.codex: [done("first"), fillers[fillers.count - 1]]], now: now)
    #expect(again.last?.id == "codex.first:first")
    #expect(again.filter { $0.id == "codex.filler-\(NoticeTuning.maxSeen - 1):filler-\(NoticeTuning.maxSeen - 1)" }.count == 1,
            "the newest filler appears once, from when it was first shown")
  }
}

struct HistogramInput: Decodable {
  let now: String
  let days: DayHistogram
}

struct PruneInput: Decodable {
  let cache: [String: TokenFileEntry]
  let keep: [String]
}

@Suite("Token counting, against the shared corpus")
struct TokenTests {
  @Test("claudeRowTokens")
  func claudeRows() throws {
    let file: FixtureFile<JSONValue, TokenExpected?> = try Fixtures.load(
      "activity/claude-row-tokens"
    )
    for testCase in file.cases {
      #expect(recorded(claudeRowTokens(testCase.input)) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("codexRowTokens over one file's rows")
  func codexRows() throws {
    let file: FixtureFile<[JSONValue], [TokenExpected?]> = try Fixtures.load(
      "activity/codex-row-tokens"
    )
    for testCase in file.cases {
      var previous = 0.0
      let actual = testCase.input.map { recorded(codexRowTokens($0, previous: &previous)) }
      #expect(actual == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("histogramTotals")
  func histogram() throws {
    let file: FixtureFile<HistogramInput, TokenTotals> = try Fixtures.load(
      "activity/histogram-totals"
    )
    let zone = try file.zone()
    for testCase in file.cases {
      let now = try #require(looseDate(testCase.input.now))
      #expect(histogramTotals(testCase.input.days, now: now, timeZone: zone) == testCase.expected, "\(testCase.name)")
    }
  }

  @Test("pruneTokenCache")
  func prune() throws {
    let file: FixtureFile<PruneInput, [JSONValue]> = try Fixtures.load(
      "activity/prune-token-cache"
    )
    for testCase in file.cases {
      let actual = pruneTokenCache(testCase.input.cache, keep: Set(testCase.input.keep))
      let expected = try testCase.expected.map { pair -> (String, TokenFileEntry) in
        let items = try #require(pair.asArray)
        let path = try #require(items.first?.asString)
        let entry = try JSONDecoder().decode(
          TokenFileEntry.self, from: JSONEncoder().encode(try #require(items.last))
        )
        return (path, entry)
      }
      #expect(actual.map(\.path) == expected.map(\.0), "\(testCase.name): order")
      #expect(actual.map(\.entry) == expected.map(\.1), "\(testCase.name): entries")
    }
  }
}

@Suite("Machine output kept out of notices")
struct MachineOutputTests {
  func finished(saying message: String) -> AgentSession {
    let line: [String: Any] = [
      "timestamp": "2026-09-06T12:00:01.000Z", "type": "event_msg",
      "payload": ["type": "task_complete", "turn_id": "turn-1", "last_agent_message": message],
    ]
    let raw = String(decoding: try! JSONSerialization.data(withJSONObject: line), as: UTF8.self)
    let session = AgentSession(
      id: "s", providerId: .codex, name: "Task", detail: "", state: .busy, waitingFor: nil,
      since: "2026-09-06T12:00:00.000Z")
    return applyLocalEvents(session, raw)
  }

  @Test func aJSONVerdictIsNotASummary() {
    let verdict = #"{"risk_level":"low","user_authorization":"high","outcome":"allow","rationale":"Reads only."}"#
    #expect(finished(saying: verdict).completion != nil)
    #expect(finished(saying: verdict).completion?.summary == nil)
    #expect(finished(saying: "[1, 2, 3]").completion?.summary == nil)
  }

  @Test func ordinaryWordsStillAre() {
    #expect(finished(saying: "Done: the poller backs off now.").completion?.summary == "Done: the poller backs off now.")
    // Braces in prose are not JSON.
    #expect(finished(saying: "{not json} but words").completion?.summary == "{not json} but words")
  }
}
