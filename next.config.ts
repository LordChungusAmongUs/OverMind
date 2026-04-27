import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["img.youtube.com", "i.ytimg.com"],
  },
  serverExternalPackages: ["ffmpeg-static"],
  experimental: {
    outputFileTracingIncludes: {
      "/api/youtube/encode-upload": ["./node_modules/ffmpeg-static/ffmpeg"],
    },
  },
};

export default nextConfig;
