import CapsuleCore
import Foundation

/// PATH for the tools Capsule runs: the inherited one, then the places
/// Homebrew and the CLIs' installers use, without repeats.
public func commandPath(environment: [String: String] = ProcessInfo.processInfo.environment) -> String {
  let home = FileManager.default.homeDirectoryForCurrentUser.path
  let current = (environment["PATH"] ?? "").split(separator: ":").map(String.init).filter { !$0.isEmpty }
  let extra = CommandTuning.extraPathDirectories.map { $0.hasPrefix("~/") ? home + $0.dropFirst() : $0 }
  var seen: Set<String> = []
  return (current + extra).filter { seen.insert($0).inserted }.joined(separator: ":")
}

/// Where a command lives: itself if it names a path, else the first match on
/// `commandPath()`.
public func resolveExecutable(_ file: String, path: String = commandPath()) -> String? {
  let manager = FileManager.default
  if file.contains("/") { return manager.isExecutableFile(atPath: file) ? file : nil }
  return path.split(separator: ":").map { "\($0)/\(file)" }.first { manager.isExecutableFile(atPath: $0) }
}

private final class Captured: @unchecked Sendable {
  private let lock = NSLock()
  private var data = Data()
  private var resumed = false
  func set(_ value: Data) { lock.withLock { data = value } }
  var output: Data { lock.withLock { data } }
  /// Runs `body` only the first time.
  func once(_ body: () -> Void) {
    let first = lock.withLock { () -> Bool in
      defer { resumed = true }
      return !resumed
    }
    if first { body() }
  }
}

/// What a local command printed, or nil if it is not installed, failed, or
/// took longer than the timeout.
public func runCommand(
  _ file: String, _ arguments: [String], timeout: TimeInterval = CommandTuning.timeoutSeconds
) async -> String? {
  guard let executable = resolveExecutable(file) else { return nil }
  return await withCheckedContinuation { continuation in
    let process = Process()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    var environment = ProcessInfo.processInfo.environment
    environment["PATH"] = commandPath(environment: environment)
    process.environment = environment
    let output = Pipe()
    process.standardOutput = output
    process.standardError = FileHandle.nullDevice
    process.standardInput = FileHandle.nullDevice

    let captured = Captured()
    let drained = DispatchGroup()
    drained.enter()
    // Read on its own thread, so a chatty tool cannot fill the pipe and stall.
    DispatchQueue.global(qos: .utility).async {
      captured.set(output.fileHandleForReading.readDataToEndOfFile())
      drained.leave()
    }
    process.terminationHandler = { finished in
      drained.notify(queue: .global(qos: .utility)) {
        let succeeded = finished.terminationReason == .exit && finished.terminationStatus == 0
        captured.once {
          continuation.resume(returning: succeeded ? String(decoding: captured.output, as: UTF8.self) : nil)
        }
      }
    }
    do {
      try process.run()
    } catch {
      try? output.fileHandleForWriting.close()
      captured.once { continuation.resume(returning: nil) }
      return
    }
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + timeout) {
      if process.isRunning { process.terminate() }
    }
  }
}
