import CapsuleCore
import Testing

struct AppChannelTests {
  @Test func unknownAndUnbundledAppsAreDevelopment() {
    for identifier in [nil, "", "com.antick.capsule.dev", "org.example.Capsule"] {
      let channel = AppChannel(bundleIdentifier: identifier)
      #expect(channel == .development)
      #expect(!channel.allowsUpdates)
      #expect(channel.supportDirectory != AppChannel.production.supportDirectory)
      #expect(channel.bundleIdentifier != AppChannel.production.bundleIdentifier)
    }
    #expect(AppChannel(bundleIdentifier: "com.antick.capsule").allowsUpdates)
  }
}
