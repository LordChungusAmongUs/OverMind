import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["img.youtube.com", "i.ytimg.com"],
  },
  serverExternalPackages: ["@ffmpeg/ffmpeg", "@ffmpeg/core", "@ffmpeg/util"],
};

export default nextConfig;
