import CoreServices
import Foundation

/// Calls back when anything in a directory changes, file contents included.
///
/// FSEvents rather than a vnode source on the directory: Claude Code may
/// rewrite a session file in place, which changes no directory entry and so
/// would never wake a vnode watcher. Events are coalesced over `latency`.
public final class DirectoryWatcher: @unchecked Sendable {
  private var stream: FSEventStreamRef?
  private let onChange: @Sendable () -> Void

  /// Nil when the directory cannot be watched; the poll still covers it.
  public init?(_ dir: String, latency: TimeInterval = 0.12, onChange: @escaping @Sendable () -> Void) {
    self.onChange = onChange
    var context = FSEventStreamContext(
      version: 0, info: Unmanaged.passUnretained(self).toOpaque(), retain: nil, release: nil, copyDescription: nil
    )
    let callback: FSEventStreamCallback = { _, info, _, _, _, _ in
      guard let info else { return }
      Unmanaged<DirectoryWatcher>.fromOpaque(info).takeUnretainedValue().onChange()
    }
    guard
      let created = FSEventStreamCreate(
        nil, callback, &context, [dir] as CFArray, FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
        latency, FSEventStreamCreateFlags(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer)
      )
    else { return nil }
    stream = created
    FSEventStreamSetDispatchQueue(created, DispatchQueue.global(qos: .utility))
    guard FSEventStreamStart(created) else {
      FSEventStreamInvalidate(created)
      FSEventStreamRelease(created)
      stream = nil
      return nil
    }
  }

  public func stop() {
    guard let stream else { return }
    FSEventStreamStop(stream)
    FSEventStreamInvalidate(stream)
    FSEventStreamRelease(stream)
    self.stream = nil
  }

  deinit { stop() }
}
