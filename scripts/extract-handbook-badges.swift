#!/usr/bin/env swift
// Extract specific badge artwork directly from the August 2024 Senior Member's Handbook.
// Page coordinates are based on a 1200 x 1700 pixel thumbnail and include a small margin.

import AppKit
import CoreImage
import PDFKit

struct Crop {
  let pageNumber: Int
  let x: CGFloat
  let y: CGFloat
  let width: CGFloat
  let height: CGFloat
}

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  fputs("Usage: extract-handbook-badges.swift <handbook.pdf> <output-directory>\n", stderr)
  exit(2)
}

let handbookURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)
guard let pdf = PDFDocument(url: handbookURL) else { fatalError("Could not open handbook PDF") }

let crops: [(String, Crop)] = [
  // Printed page 136: clean badge face without the advanced red cloth backing.
  ("athletics", Crop(pageNumber: 136, x: 900, y: 505, width: 190, height: 180)),
  // Printed page 123: Diploma for Gallant Conduct medal and ribbon.
  ("gallant_conduct", Crop(pageNumber: 123, x: 270, y: 435, width: 180, height: 285)),
  // Printed page 169: Martial Arts badge.
  ("martial_arts", Crop(pageNumber: 169, x: 905, y: 488, width: 190, height: 190)),
]

for (name, crop) in crops {
  guard let page = pdf.page(at: crop.pageNumber - 1) else { fatalError("Missing handbook page \(crop.pageNumber)") }
  let pageImage = page.thumbnail(of: NSSize(width: 1200, height: 1700), for: .mediaBox)
  guard let pageTIFF = pageImage.tiffRepresentation,
        let pageRep = NSBitmapImageRep(data: pageTIFF),
        let pagePNG = pageRep.representation(using: .png, properties: [:]) else { fatalError("Could not render handbook page \(crop.pageNumber)") }
  let tempPage = FileManager.default.temporaryDirectory.appendingPathComponent("handbook-page-\(crop.pageNumber)-\(UUID().uuidString).png")
  let tempCrop = FileManager.default.temporaryDirectory.appendingPathComponent("handbook-badge-\(name)-\(UUID().uuidString).png")
  try pagePNG.write(to: tempPage)
  let cropProcess = Process()
  cropProcess.executableURL = URL(fileURLWithPath: "/usr/bin/sips")
  cropProcess.arguments = ["-c", "\(Int(crop.height))", "\(Int(crop.width))", "--cropOffset", "\(Int(crop.y))", "\(Int(crop.x))", tempPage.path, "--out", tempCrop.path]
  try cropProcess.run()
  cropProcess.waitUntilExit()
  guard cropProcess.terminationStatus == 0,
        let image = CIImage(contentsOf: tempCrop),
        let keyWhite = CIColorKernel(source: "kernel vec4 keyWhite(__sample pixel) { float l=max(pixel.r,max(pixel.g,pixel.b)); float alpha=1.0-smoothstep(0.90,0.98,l); return vec4(pixel.rgb,pixel.a*alpha); }") else {
    fatalError("Could not crop handbook artwork for \(name)")
  }
  guard let keyed = keyWhite.apply(extent: image.extent, arguments: [image]),
        let png = CIContext().pngRepresentation(of: keyed, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB()) else {
    fatalError("Could not make handbook page background transparent for \(name)")
  }
  try? FileManager.default.removeItem(at: tempPage)
  try? FileManager.default.removeItem(at: tempCrop)
  try png.write(to: outputURL.appendingPathComponent("\(name).png"))
}
