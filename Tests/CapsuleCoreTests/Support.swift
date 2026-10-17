import CapsuleFixtures
import Foundation

/// A case whose input is an instant, given as an ISO-8601 string.
struct AtInput: Decodable { let resetsAt: String }

/// A case whose input is a distance back from the fixture's frozen `now`.
struct SpanInput: Decodable { let msBeforeNow: Double }

/// A case whose input is a day, and how many whole days to walk back.
struct DayInput: Decodable {
  let now: String
  let daysBack: Int
}

extension FixtureFile {
  /// The fixture's locale as Foundation spells it. The corpus uses BCP-47
  /// (`en-US`) because that is what the JavaScript side passes to `Intl`.
  var foundationLocale: Locale {
    Locale(identifier: (locale ?? "en-US").replacingOccurrences(of: "-", with: "_"))
  }
}
