import Foundation
import CoreGraphics

/// Shared proportions and colors for Capsule's amber-and-cream identity.
public enum Branding {
  public static let artboard = 1024.0
  public static let tile = CGRect(x: 80, y: 80, width: 864, height: 864)
  public static let tileRadius = 190.0
  public static let capsule = CGRect(x: 160, y: 400, width: 704, height: 224)
  public static let inset = 36.0
  public static let progress = 0.60
  public static let charcoal = (red: 29.0, green: 29.0, blue: 29.0)
  public static let cream = (red: 255.0, green: 242.0, blue: 211.0)
  public static let amber = (red: 255.0, green: 184.0, blue: 15.0)
  public static let menuSize = CGSize(width: 22, height: 18)
  public static let menuCapsule = CGRect(x: 1, y: 5, width: 20, height: 8)
  public static let menuInset = 1.5
}
