import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  // Allow HMR from both localhost and 127.0.0.1 when developing.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.156"],
  // Don't fail production builds over typecheck/lint — those run separately in CI.
  // Uncomment if you need to ship despite known issues:
  // typescript: { ignoreBuildErrors: false },
  // eslint:     { ignoreDuringBuilds: false },
};

export default nextConfig;
