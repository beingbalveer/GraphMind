import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@graphmind/shared"],
  reactStrictMode: true,
};

export default nextConfig;
