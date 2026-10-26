import type { MetadataRoute } from "next";

// Lets Tangent be added to a phone's home screen as an app, with a "Capture"
// shortcut (long-press the icon on Android) that opens the capture home already
// listening on ?capture=1 (components/capture/CaptureHome.tsx). iOS ignores manifest shortcuts; on an
// iPhone the same URL can be bound to the Action button or Back Tap through
// the Shortcuts app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tangent",
    short_name: "Tangent",
    description: "Say it. Capture it. Build it.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4f9",
    theme_color: "#f5f4f9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      {
        name: "Capture",
        short_name: "Capture",
        description: "Open Tangent listening",
        url: "/?capture=1",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
