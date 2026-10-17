import Foundation
import Security

/// A generic-password item from the login keychain, trimmed, or nil. The
/// same item `security find-generic-password -s <service> -w` prints. macOS
/// may ask the user to allow access the first time, as it does for that.
public func keychainPassword(service: String) -> String? {
  let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecReturnData as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne,
  ]
  var result: CFTypeRef?
  guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
    let data = result as? Data, let text = String(data: data, encoding: .utf8)
  else { return nil }
  let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty ? nil : trimmed
}
