import CapsuleCore
import CapsuleFixtures
import CapsuleHUD
import Foundation

/// A dock to draw, as the corpus names one: its edge, style, meter count and
/// the meter that is open. Some fixtures add a field or two of their own.
struct DockInput: Decodable {
  let scale: Double
  let growth: CardGrowth
  let style: DockStyleId
  let meters: Int
  let open: Int
  let buckets: Int
  let reserveBuckets: Int?
  let railBias: Double?
  // Per-fixture extras.
  let notch: Bool?
  let state: String?
  let joined: HardwareNotch?
  let openness: Double?
}

/// The metrics, style and layout for a described dock, derived exactly as the
/// TypeScript golden suite derives them.
func draw(_ dock: DockInput) -> (m: HudMetrics, style: DockStyle, layout: BlobLayout) {
  let m = hudMetrics(dock.scale)
  let style = DockStyle.of(dock.style)
  let layout = blobLayout(
    m,
    BlobLayoutInput(
      cardGrowth: dock.growth,
      railLength: railLengthForCount(m, dock.meters),
      joinOffset: joinOffsetForIndex(m, dock.open),
      cardHeight: cardHeightForBuckets(m, dock.buckets),
      cardReserve: dock.reserveBuckets.map { cardHeightForBuckets(m, $0) },
      style: style,
      railBias: dock.railBias
    )
  )
  return (m, style, layout)
}

/// The corpus's path format: `{ op, x, y }`, `{ op: "A", r, sweep, x, y }`,
/// `{ op: "C", c1: [x, y], c2: [x, y], x, y }`, `{ op: "Z" }`.
struct RecordedCommand: Decodable {
  let command: PathCommand

  private enum Keys: String, CodingKey { case op, x, y, r, sweep, c1, c2 }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    let op = try c.decode(String.self, forKey: .op)
    func end() throws -> PathPoint {
      PathPoint(x: try c.decode(Double.self, forKey: .x), y: try c.decode(Double.self, forKey: .y))
    }
    func pair(_ key: Keys) throws -> PathPoint {
      let xy = try c.decode([Double].self, forKey: key)
      guard xy.count == 2 else {
        throw DecodingError.dataCorruptedError(
          forKey: key, in: c, debugDescription: "a control point is two numbers"
        )
      }
      return PathPoint(x: xy[0], y: xy[1])
    }
    switch op {
    case "M": command = .move(try end())
    case "L": command = .line(try end())
    case "A":
      command = .arc(
        radius: try c.decode(Double.self, forKey: .r),
        sweep: try c.decode(Int.self, forKey: .sweep), to: try end()
      )
    case "C": command = .curve(control1: try pair(.c1), control2: try pair(.c2), to: try end())
    case "Z": command = .close
    default:
      throw DecodingError.dataCorruptedError(
        forKey: .op, in: c, debugDescription: "unknown path command \(op)"
      )
    }
  }
}

func commands(_ recorded: [RecordedCommand]) -> [PathCommand] {
  recorded.map(\.command)
}

/// Re-reads a heterogeneous expectation as the type one case needs.
func reread<T: Decodable>(_ value: JSONValue, as type: T.Type = T.self) throws -> T {
  try JSONDecoder().decode(T.self, from: JSONEncoder().encode(value))
}
