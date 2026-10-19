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
public func keychainPassword(service: String, account: String? = nil) async -> String? {
  var arguments = ["find-generic-password", "-s", service]
  if let account { arguments += ["-a", account] }
  guard let text = await runTool(KeychainTool.path, arguments + ["-w"]) else { return nil }
  let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty ? nil : trimmed
}
