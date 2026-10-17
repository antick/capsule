# native-appkit-migration

Rebuild Capsule as a native Swift/AppKit menu-bar app: the same dock, placement, provider readings, and update flow, on `NSPanel` + `CGPath` + SwiftUI instead of Electron + React. Staged in four phases behind extracted golden fixtures, with the Electron app remaining the shipping build until the final cutover.
