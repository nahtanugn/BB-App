#!/usr/bin/env swift
// Preserve the user-supplied Citizenship badge pixels, remove the white page
// background, and crop to the portrait badge proportions used in the app.

import AppKit
import CoreImage

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  fputs("Usage: process-citizenship-badge.swift <source-image> <output.png>\n", stderr)
  exit(2)
}

let inputURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
guard let source = CIImage(contentsOf: inputURL),
      let keyWhite = CIColorKernel(source: "kernel vec4 keyWhite(__sample pixel) { float l=max(pixel.r,max(pixel.g,pixel.b)); float alpha=1.0-smoothstep(0.90,0.98,l); return vec4(pixel.rgb,pixel.a*alpha); }") else {
  fatalError("Could not load source image or create background-removal filter")
}

// The attached source is 182×230. This retains the complete badge and a small
// transparent margin, removing the wide white page margins that made it look
// undersized in the armlet layout.
let crop = CGRect(x: 14, y: 0, width: 151, height: 230)
guard let keyed = keyWhite.apply(extent: source.extent, arguments: [source])?.cropped(to: crop),
      let png = CIContext().pngRepresentation(of: keyed, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB()) else {
  fatalError("Could not make the source background transparent")
}
try png.write(to: outputURL)
