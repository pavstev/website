import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: "dist",
  images: { unoptimized: true },
  output: "export",
  poweredByHeader: false,
  trailingSlash: false,
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
