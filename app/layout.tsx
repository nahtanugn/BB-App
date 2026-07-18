import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareImage = `${protocol}://${host}/og.png`;
  const description = "An open-source, cross-platform award tracker for Boys' Brigade Senior Section companies.";

  return {
    title: "Anchor Awards · BB Senior Award Tracker",
    description,
    applicationName: "Anchor Awards",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Anchor Awards" },
    formatDetection: { telephone: false },
    openGraph: {
      title: "Anchor Awards",
      description: "Senior Section award tracking, made steady.",
      type: "website",
      images: [{ url: shareImage, width: 1733, height: 910, alt: "Anchor Awards app preview" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Anchor Awards",
      description: "Senior Section award tracking, made steady.",
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
