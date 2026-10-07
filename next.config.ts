import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "dist",
  images: { unoptimized: true },
  output: "export",
  poweredByHeader: false,
  trailingSlash: false,
};

export default nextConfig;
