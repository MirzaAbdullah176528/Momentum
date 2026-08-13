import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@momentum/shared-types",
    "@momentum/rating-engine"
  ],
  typedRoutes: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  async rewrites() {
    const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8787";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`
      }
    ];
  }
};

export default config;
