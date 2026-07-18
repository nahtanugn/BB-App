import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anchor Awards · Senior Section Tracker",
    short_name: "Anchor Awards",
    description: "Track Boys' Brigade Senior Section awards across every member and device.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#0b2f55",
    orientation: "any",
  };
}
