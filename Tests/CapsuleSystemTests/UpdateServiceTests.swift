import CapsuleCore
@testable import CapsuleSystem
import Foundation
import Testing

@Suite("Native update safety", .serialized)
@MainActor
struct UpdateServiceTests {
  @Test func developmentNeverStartsAnUpdater() {
    let service = UpdateService(version: "0.2.0", channel: .development)
    service.check()
    service.download()
    service.install()
    #expect(service.state.phase == .unsupported)
    #expect(!service.state.canInstall)
    #expect(!service.state.canCheck)
  }

  @Test func installRequiresAnExplicitReadyAction() {
    let service = UpdateService(version: "0.2.0", channel: .development)
    var responses = 0
    service.showReady(toInstallAndRelaunch: { _ in responses += 1 })
    #expect(service.state.phase == .ready)
    #expect(responses == 0)
    service.install()
    service.install()
    #expect(responses == 1)
  }

  @Test func downloadFailureClearsProgressAndPendingInstall() {
    let service = UpdateService(version: "0.2.0", channel: .development)
    service.showDownloadInitiated(cancellation: {})
    service.showDownloadDidReceiveExpectedContentLength(100)
    service.showDownloadDidReceiveData(ofLength: 150)
    #expect(service.state.progress?.fraction == 1)
    var acknowledged = false
    service.showUpdaterError(NSError(domain: "test", code: 1), acknowledgement: { acknowledged = true })
    #expect(acknowledged)
    #expect(service.state.phase == .error)
    #expect(service.state.progress == nil)
    #expect(service.state.checkedAt != nil)
  }
}
