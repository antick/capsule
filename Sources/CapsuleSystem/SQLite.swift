import Foundation
import SQLite3

/// Rows from a read-only query, every column as text, or none if the store
/// cannot be opened or the query fails. Opened read-only and briefly, so a
/// tool writing its own store at the same moment is never disturbed.
public func sqliteRows(_ path: String, _ sql: String) -> [[String]] {
  var db: OpaquePointer?
  guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, nil) == SQLITE_OK else {
    sqlite3_close(db)
    return []
  }
  defer { sqlite3_close(db) }
  // The tool may be mid-write; wait a moment rather than fail at once.
  sqlite3_busy_timeout(db, 250)
  var statement: OpaquePointer?
  guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
  defer { sqlite3_finalize(statement) }
  // A query that would write is refused, whatever the open flags let through.
  guard sqlite3_stmt_readonly(statement) != 0 else { return [] }

  var rows: [[String]] = []
  while true {
    let step = sqlite3_step(statement)
    if step == SQLITE_DONE { break }
    guard step == SQLITE_ROW else { return [] }
    rows.append(
      (0..<sqlite3_column_count(statement)).map { column in
        // NULL reads as empty text, as the sqlite3 command prints it.
        sqlite3_column_text(statement, column).map { String(cString: $0) } ?? ""
      }
    )
  }
  return rows
}
