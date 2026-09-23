import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/chamado';

const nextConfig: NextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  async redirects() {
    if (basePath && basePath !== '/') {
      return [
        {
          source: '/',
          destination: basePath,
          basePath: false,
          permanent: false,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
