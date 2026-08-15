import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Post-op care",
    short_name: "Care",
    description: "Daily vitals and medicine tracker for recovery at home.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0d9488",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
