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
  }
};

export default config;
