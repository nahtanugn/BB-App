import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getBranding } from "../lib/branding";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const branding = await getBranding();
  const shareImage = `${protocol}://${host}${branding.logoUrl}`;
  const description = "An open-source, cross-platform award tracker for Boys' Brigade Junior and Senior Sections.";

  return {
    title: `${branding.appName} · ${branding.subtitle}`,
    description,
    applicationName: branding.appName,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: branding.logoUrl,
      shortcut: branding.logoUrl,
      apple: branding.logoUrl,
    },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: branding.shortName },
    formatDetection: { telephone: false },
    openGraph: {
      title: branding.appName,
      description: "Junior and Senior Section tracking, made steady.",
      type: "website",
      images: [{ url: shareImage, width: 1152, height: 1152, alt: `${branding.appName} preview` }],
    },
    twitter: {
      card: "summary_large_image",
      title: branding.appName,
      description: "Junior and Senior Section tracking, made steady.",
      images: [shareImage],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b2f55",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
