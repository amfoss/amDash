import type { NextConfig } from "next";

const FLASK_URL = process.env.FLASK_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${FLASK_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
