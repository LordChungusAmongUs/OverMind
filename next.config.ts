import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["img.youtube.com", "i.ytimg.com"],
  },
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  experimental: {
    outputFileTracingIncludes: {
      "/api/youtube/encode-upload": ["./node_modules/@ffmpeg-installer/**/*"],
    },
  },
};

export default nextConfig;
