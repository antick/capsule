import CapsuleCore
import Foundation

/// Runs one of the Mac's own tools and returns what it printed, or nil if it
/// failed or ran past its time. Output is read while the tool runs, so a
/// long listing cannot fill the pipe and stall it.
func runTool(_ path: String, _ arguments: [String], timeout: Double = KeychainTool.timeoutSeconds) async -> String? {
  await withCheckedContinuation { continuation in
    DispatchQueue.global(qos: .utility).async {
      continuation.resume(returning: runToolNow(path, arguments, timeout: timeout))
    }
  }
}

private func runToolNow(_ path: String, _ arguments: [String], timeout: Double) -> String? {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: path)
  process.arguments = arguments
  let output = Pipe()
  process.standardOutput = output
  process.standardError = FileHandle.nullDevice
  process.standardInput = FileHandle.nullDevice
  let done = DispatchSemaphore(value: 0)
  process.terminationHandler = { _ in done.signal() }
  do { try process.run() } catch { return nil }
  var data = Data()
  let read = DispatchSemaphore(value: 0)
  DispatchQueue.global(qos: .utility).async {
    data = output.fileHandleForReading.readDataToEndOfFile()
    read.signal()
  }
  if done.wait(timeout: .now() + timeout) == .timedOut {
    process.terminate()
    _ = read.wait(timeout: .now() + 1)
    return nil
  }
  _ = read.wait(timeout: .now() + timeout)
  guard process.terminationStatus == 0 else { return nil }
  return String(data: data, encoding: .utf8)
}

/// Every process with its command line, from `ps`.
func runningProcesses() async -> [(pid: Int, command: String)] {
  guard let text = await runTool(SystemTools.ps, ["-ax", "-o", "pid=,command="]) else { return [] }
  return text.split(separator: "\n").compactMap { line in
    let trimmed = line.drop { $0 == " " }
    guard let space = trimmed.firstIndex(of: " "), let pid = Int(trimmed[..<space]) else { return nil }
    return (pid, String(trimmed[trimmed.index(after: space)...]))
  }
}

/// The loopback TCP ports a process listens on, from `lsof`.
func listeningPorts(of pid: Int) async -> [Int] {
  guard
    let text = await runTool(SystemTools.lsof, ["-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", String(pid)])
  else { return [] }
  var ports: [Int] = []
  for line in text.split(separator: "\n") {
    guard let range = line.range(of: #"(127\.0\.0\.1|\[::1\]|localhost|\*):(\d+) \(LISTEN\)"#, options: .regularExpression)
    else { continue }
    let match = line[range]
    if let colon = match.lastIndex(of: ":"), let port = Int(match[match.index(after: colon)...].prefix { $0.isNumber }),
      !ports.contains(port)
    {
      ports.append(port)
    }
  }
  return ports
}

public enum SystemTools {
  public static let ps = "/bin/ps"
  public static let lsof = "/usr/sbin/lsof"
}
