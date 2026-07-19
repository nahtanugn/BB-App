import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareImage = `${protocol}://${host}/app-photo.jpeg`;
  const description = "An open-source, cross-platform award tracker for Boys' Brigade Junior and Senior Sections.";

  return {
    title: "11KCHBB App · BB Section Tracker",
    description,
    applicationName: "11KCHBB App",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/app-photo.jpeg",
      shortcut: "/app-photo.jpeg",
      apple: "/app-photo.jpeg",
    },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "11KCHBB App" },
    formatDetection: { telephone: false },
    openGraph: {
      title: "11KCHBB App",
      description: "Junior and Senior Section tracking, made steady.",
      type: "website",
      images: [{ url: shareImage, width: 1152, height: 1152, alt: "11KCHBB App preview" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "11KCHBB App",
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
