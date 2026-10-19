import Foundation

extension CapsuleSettings {
  /// The settings as a schema v7 document: every key present, absent values
  /// written as `null`, exactly the shape ``read(_:)`` accepts and the
  /// Electron app writes.
  public var document: [String: Any] {
    func position(_ value: DockPosition?) -> Any {
      value.map { ["x": $0.x, "y": $0.y] as [String: Any] } ?? NSNull()
    }
    return [
      "placementPreset": placementPreset.rawValue,
      "enabledProviderIds": enabledProviderIds.map(\.rawValue),
      "pollIntervalMs": pollIntervalMs,
      "launchAtLogin": launchAtLogin,
      "hudScale": hudScale,
      "hudTheme": hudTheme.rawValue,
      "dockStyle": dockStyle.rawValue,
      "cornerArc": cornerArc,
      "autoHide": autoHide,
      "notificationPopups": notificationPopups,
      "autoUpdateCheck": autoUpdateCheck,
      "autoUpdateDownload": autoUpdateDownload,
      "hideDelay": hideDelay.rawValue,
      "customCorner": customCorner?.rawValue ?? NSNull(),
      "topEdgeNotch": topEdgeNotch,
      "usageDisplay": usageDisplay.rawValue,
      "customPosition": position(customPosition),
      "meterNames": meterNames,
      "presence": presence.rawValue,
      "menuBarStyle": menuBarStyle.rawValue,
      "menuBarMeter": menuBarMeter ?? NSNull(),
      "pinnedMetrics": pinnedMetrics.map(\.rawValue),
      "pinStyle": pinStyle.rawValue,
      "hiddenMetrics": hiddenMetrics.map(\.rawValue),
      "starredMetrics": starredMetrics.map(\.rawValue),
      "metricOrder": metricOrder.map(\.rawValue),
      "flipResetStyle": flipResetStyle,
      "showPace": showPace,
      "accounts": accounts.map {
        ["id": $0.id, "provider": $0.provider.rawValue, "path": $0.path, "label": $0.label, "enabled": $0.enabled]
          as [String: Any]
      },
      "schemaVersion": SettingsDefaults.schemaVersion,
    ]
  }

  /// The document as pretty, key-sorted JSON.
  public var documentData: Data? {
    try? JSONSerialization.data(withJSONObject: document, options: [.prettyPrinted, .sortedKeys])
  }

  /// Settings from a document's bytes, or nil for anything that is not a
  /// readable schema v7 file.
  public static func read(data: Data) -> CapsuleSettings? {
    guard let text = String(data: data, encoding: .utf8), let raw = JSONValue.parse(text) else {
      return nil
    }
    return read(raw)
  }
}
