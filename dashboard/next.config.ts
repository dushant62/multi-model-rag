import path from "node:path";
import type { NextConfig } from "next";

// Proxy /api/dashboard/* and /health to the co-located FastAPI backend.
// In production, the backend runs at 127.0.0.1:${BACKEND_PORT} inside the
// same container; Railway exposes only one public port, so the dashboard
// must forward API calls server-side.
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  `http://127.0.0.1:${process.env.BACKEND_PORT ?? "8000"}`;

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.156"],
  async rewrites() {
    return [
      { source: "/api/dashboard/:path*", destination: `${BACKEND_URL}/api/dashboard/:path*` },
      { source: "/health", destination: `${BACKEND_URL}/health` },
    ];
  },
};

export default nextConfig;
