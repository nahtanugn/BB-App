import type { MetadataRoute } from "next";
import { getBranding } from "../lib/branding";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getBranding();
  return {
    name: `${branding.appName} · ${branding.subtitle}`,
    short_name: branding.shortName,
    description: "Track Boys' Brigade Junior and Senior Section records across every device.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#0b2f55",
    orientation: "any",
    icons: [
      {
        src: branding.logoUrl,
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
