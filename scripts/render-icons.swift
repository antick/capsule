
// Appended to the shared renderer by generate-icons.sh.
let development = CommandLine.arguments.contains("--development")
let destination = URL(fileURLWithPath: CommandLine.arguments[1])
let iconset = destination.appendingPathComponent("AppIcon.iconset")
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

@MainActor
func save(_ image: NSImage, pixels: Int, to url: URL) throws {
  let ratio = image.size.height / image.size.width
  let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels,
    pixelsHigh: Int(CGFloat(pixels) * ratio), bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  image.draw(in: CGRect(x: 0, y: 0, width: pixels, height: bitmap.pixelsHigh))
  NSGraphicsContext.restoreGraphicsState()
  try bitmap.representation(using: .png, properties: [:])!.write(to: url)
}
for size in [16, 32, 128, 256, 512] {
  for scale in [1, 2] {
    let suffix = scale == 2 ? "@2x" : ""
    try save(BrandIcon.image(development: development), pixels: size * scale,
      to: iconset.appendingPathComponent("icon_\(size)x\(size)\(suffix).png"))
  }
}
try save(BrandIcon.image(development: development), pixels: 1024, to: destination.appendingPathComponent("AppIcon.png"))
for scale in [1, 2] {
  let suffix = scale == 2 ? "@2x" : ""
  try save(BrandIcon.image(template: true), pixels: Int(Branding.menuSize.width) * scale,
    to: destination.appendingPathComponent("trayTemplate\(suffix).png"))
}
