import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FloodIQ — flood-risk scoring for any U.S. address",
  description:
    "FloodIQ scores any U.S. residential address against FEMA flood maps and NOAA sea-level projections across three time horizons (10 / 30 / 100 years).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="bg-paper text-ink font-sans">{children}</body>
    </html>
  );
}
