#!/usr/bin/env swift
// Build the Junior Service badge using the handbook's One-Year Service artwork.
// Preserve the handbook badge and BB logo pixels exactly; strengthen only the
// navy outline so the official emblem itself is not distorted.

import AppKit
import ImageIO

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  fputs("Usage: process-junior-service-badge.swift <one-year-service.webp> <output.png>\n", stderr)
  exit(2)
}

let sourceURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
guard let data = try? Data(contentsOf: sourceURL),
      let sourceRep = NSBitmapImageRep(data: data),
      let source = sourceRep.cgImage else {
  fatalError("Could not load handbook One-Year Service badge artwork")
}

let scale: CGFloat = 3
let width = source.width
let height = source.height
let logoSource = sourceRep
let sourceWidth = logoSource.pixelsWide
let sourceHeight = logoSource.pixelsHigh
let centerX = Double(sourceWidth) / 2
let centerY = Double(sourceHeight) / 2
let logoScale = 0.68
let silver = 0.70
let composed = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: sourceWidth, pixelsHigh: sourceHeight,
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                               isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
func gray(_ value: Double) -> NSColor {
  NSColor(calibratedRed: value, green: value, blue: value, alpha: 1)
}

// Clear the old emblem inside the silver medallion, then redraw the complete
// BB-and-anchor mark from the handbook artwork at a uniform smaller scale.
for y in 0..<sourceHeight {
  for x in 0..<sourceWidth {
    let dx = Double(x) - centerX
    let dy = Double(y) - centerY
    if dx * dx + dy * dy < 54 * 54 {
      composed.setColor(gray(silver), atX: x, y: y)
    } else if let color = logoSource.colorAt(x: x, y: y) {
      composed.setColor(color, atX: x, y: y)
    }
  }
}

for y in 0..<sourceHeight {
  for x in 0..<sourceWidth {
    let dx = Double(x) - centerX
    let dy = Double(y) - centerY
    guard dx * dx + dy * dy < 48 * 48 else { continue }
    let sourceX = Int((centerX + dx / logoScale).rounded())
    let sourceY = Int((centerY + dy / logoScale).rounded())
    guard sourceX >= 30, sourceX <= 128, sourceY >= 72, sourceY <= 190,
          let mark = logoSource.colorAt(x: sourceX, y: sourceY)?.usingColorSpace(.deviceRGB) else { continue }
    let luminance = 0.299 * mark.redComponent + 0.587 * mark.greenComponent + 0.114 * mark.blueComponent
    let mask = min(1, max(0, (luminance - 0.70) / 0.23)) * mark.alphaComponent
    guard mask > 0.03 else { continue }
    let value = silver * (1 - mask) + 0.96 * mask
    composed.setColor(gray(value), atX: x, y: y)
  }
}

let context = CGContext(data: nil, width: width * 3, height: height * 3,
                        bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
context.interpolationQuality = .high
context.setAllowsAntialiasing(true)
context.setShouldAntialias(true)
context.scaleBy(x: scale, y: scale)
context.draw(composed.cgImage!, in: CGRect(x: 0, y: 0, width: width, height: height))

// A bold navy outline surrounds the original centered logo; no blue fill or
// retouching is applied to the silver artwork.
let center = CGPoint(x: CGFloat(width) / 2, y: CGFloat(height) / 2)
let diameter: CGFloat = 110
context.setStrokeColor(NSColor(calibratedRed: 0.02, green: 0.16, blue: 0.37, alpha: 1).cgColor)
context.setLineWidth(3)
context.strokeEllipse(in: CGRect(x: center.x - diameter / 2, y: center.y - diameter / 2,
                                 width: diameter, height: diameter))

if FileManager.default.fileExists(atPath: outputURL.path) {
  try FileManager.default.removeItem(at: outputURL)
}
guard let image = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, "public.png" as CFString, 1, nil) else {
  fatalError("Could not encode Junior Service badge")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Could not write Junior Service badge") }
