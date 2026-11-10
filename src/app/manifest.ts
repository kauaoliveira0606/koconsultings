import type { MetadataRoute } from "next";

/** PWA manifest for the Berlin dashboard app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Berlin",
    short_name: "Berlin",
    description: "One view of your marketing funnels, performance, and pacing.",
    start_url: "/bronson/overview",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/brand/berlin-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/berlin-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/berlin-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
