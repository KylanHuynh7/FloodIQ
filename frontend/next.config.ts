import type { NextConfig } from "next";

const BACKEND_ORIGIN =
  process.env.FLOODIQ_BACKEND_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      {
        source: "/report/:token.pdf",
        destination: `${BACKEND_ORIGIN}/report/:token.pdf`,
      },
    ];
  },
};

export default nextConfig;
