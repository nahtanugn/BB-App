import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "11KCHBB App · Section Tracker",
    short_name: "11KCHBB App",
    description: "Track Boys' Brigade Junior and Senior Section records across every device.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#0b2f55",
    orientation: "any",
    icons: [
      {
        src: "/app-photo.jpeg",
        sizes: "1152x1152",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
