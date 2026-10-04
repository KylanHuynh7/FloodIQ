import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Display: characterful grotesque with optical sizing, used for headlines
// and big numbers. Body: a warm, friendly sans. Mono only for coordinates.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "FloodIQ — flood-risk scoring for any U.S. address",
  description:
    "FloodIQ scores any U.S. residential address against FEMA flood maps and NOAA sea-level projections across three time horizons (10 / 30 / 100 years).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f2430",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${bricolage.variable} ${plexMono.variable} antialiased`}
    >
      <body className="bg-canvas text-ink font-sans">{children}</body>
    </html>
  );
}
