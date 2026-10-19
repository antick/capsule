import CapsuleCore
import Foundation

/// A generic-password item from the login keychain, trimmed, or nil: what
/// `security find-generic-password -s <service> -w` prints.
///
/// Read through `/usr/bin/security` rather than the Security framework, on
/// purpose. Claude Code writes its item with that same tool, and every token
/// refresh rewrites it, resetting the item's access list to the tool alone.
/// A framework read would then make macOS ask for the login password again
/// after each refresh, "Always Allow" or not. The tool is always on the list,
/// so this never prompts.
public func keychainPassword(service: String) async -> String? {
  await withCheckedContinuation { continuation in
    DispatchQueue.global(qos: .utility).async {
      continuation.resume(returning: runKeychainTool(service: service))
    }
  }
}

private func runKeychainTool(service: String) -> String? {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: KeychainTool.path)
  process.arguments = ["find-generic-password", "-s", service, "-w"]
  let output = Pipe()
  process.standardOutput = output
  process.standardError = FileHandle.nullDevice
  process.standardInput = FileHandle.nullDevice
  let done = DispatchSemaphore(value: 0)
  process.terminationHandler = { _ in done.signal() }
  do { try process.run() } catch { return nil }
  // A tool that hangs must not hold up a read for good.
  let deadline = DispatchTime.now() + KeychainTool.timeoutSeconds
  // The item is far smaller than the pipe's buffer, so the tool never
  // blocks writing it and waiting before reading cannot deadlock.
  if done.wait(timeout: deadline) == .timedOut {
    process.terminate()
    return nil
  }
  let data = output.fileHandleForReading.readDataToEndOfFile()
  guard process.terminationStatus == 0, let text = String(data: data, encoding: .utf8) else { return nil }
  let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty ? nil : trimmed
}
