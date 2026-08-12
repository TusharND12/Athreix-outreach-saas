import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem("athreix-theme") || "light";
      const dark = saved === "dark" || (saved === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.dataset.themePreference = saved;
    } catch (_) {}
  })();
`;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Athreix — Prospect Intelligence",
    template: "%s · Athreix",
  },
  description:
    "Live B2B prospect research, evidence-backed qualification, complete lead records, and responsible next actions.",
  applicationName: "Athreix Lead Intelligence",
  manifest: "/manifest.webmanifest",
  category: "business",
  keywords: [
    "prospect intelligence",
    "B2B lead research",
    "B2B company intelligence",
    "AI prospecting",
    "sales outreach",
  ],
  authors: [{ name: "Athreix" }],
  creator: "Athreix",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Athreix Prospect AI",
    title: "Athreix — Prospect intelligence with proof",
    description:
      "Know exactly who to reach—and why. Live B2B research with ranked, complete, evidence-backed lead records.",
    images: [
      {
        url: "/og.png",
        width: 1733,
        height: 909,
        alt: "Athreix prospect intelligence with proof",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Athreix — Prospect intelligence with proof",
    description: "Know exactly who to reach—and why.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2e8" },
    { media: "(prefers-color-scheme: dark)", color: "#111326" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
