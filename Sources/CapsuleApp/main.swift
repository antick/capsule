import AppKit

// An accessory app: no Dock tile, no menu bar of its own, no window at launch.
// The bundle's Info.plist says so with `LSUIElement`; setting the policy here
// as well keeps a bare `swift run` from showing a Dock tile.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
