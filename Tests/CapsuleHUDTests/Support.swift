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
struct RecordedCommand: Codable {
  let command: PathCommand

  init(_ command: PathCommand) { self.command = command }

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

extension RecordedCommand {
  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: Keys.self)
    func end(_ point: PathPoint) throws {
      try c.encode(point.x, forKey: .x)
      try c.encode(point.y, forKey: .y)
    }
    switch command {
    case .move(let to):
      try c.encode("M", forKey: .op)
      try end(to)
    case .line(let to):
      try c.encode("L", forKey: .op)
      try end(to)
    case .arc(let radius, let sweep, let to):
      try c.encode("A", forKey: .op)
      try c.encode(radius, forKey: .r)
      try c.encode(sweep, forKey: .sweep)
      try end(to)
    case .curve(let c1, let c2, let to):
      try c.encode("C", forKey: .op)
      try c.encode([c1.x, c1.y], forKey: .c1)
      try c.encode([c2.x, c2.y], forKey: .c2)
      try end(to)
    case .close:
      try c.encode("Z", forKey: .op)
    }
  }
}

/// Path commands in the corpus's format, for writing back.
func recorded(_ commands: [PathCommand]) -> [RecordedCommand] {
  commands.map(RecordedCommand.init)
}

func commands(_ recorded: [RecordedCommand]) -> [PathCommand] {
  recorded.map(\.command)
}

/// Re-reads a heterogeneous expectation as the type one case needs.
func reread<T: Decodable>(_ value: JSONValue, as type: T.Type = T.self) throws -> T {
  try JSONDecoder().decode(T.self, from: JSONEncoder().encode(value))
}
