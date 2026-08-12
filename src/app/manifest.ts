import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Athreix Prospect AI",
    short_name: "Athreix",
    description:
      "AI-native prospect intelligence for responsible B2B company research.",
    start_url: "/search",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#11110f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
