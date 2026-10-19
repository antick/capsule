import CapsuleCore
import Foundation

/// The folders under home that may hold another account, each with the
/// names inside it. Only names are read, never the files themselves.
public func accountFolderEntries(home: String = userHome) -> [String: Set<String>] {
  let manager = FileManager.default
  let prefixes = AccountRules.supported.compactMap(AccountRules.folderPrefix)
  guard let names = try? manager.contentsOfDirectory(atPath: home) else { return [:] }
  var entries: [String: Set<String>] = [:]
  for name in names where prefixes.contains(where: name.hasPrefix) {
    var isFolder: ObjCBool = false
    let path = joinPath(home, [name])
    guard manager.fileExists(atPath: path, isDirectory: &isFolder), isFolder.boolValue else { continue }
    entries[name] = Set((try? manager.contentsOfDirectory(atPath: path)) ?? [])
  }
  return entries
}

/// Whether a folder the user typed or picked can be added as an account.
public func checkAccountFolder(
  _ provider: ProviderId, path: String, existing: [UsageAccount], home: String = userHome
) -> AccountCheck {
  let absolute = AccountPaths.resolve(path, home: home)
  var isFolder: ObjCBool = false
  let exists = FileManager.default.fileExists(atPath: absolute, isDirectory: &isFolder) && isFolder.boolValue
  let contents = exists ? Set((try? FileManager.default.contentsOfDirectory(atPath: absolute)) ?? []) : []
  return checkAccount(provider, path: path, home: home, exists: exists, contents: contents, existing: existing)
}
