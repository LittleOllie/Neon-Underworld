import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: [],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    const localSrc = path.resolve(__dirname, './src');
    const parentSrc = path.resolve(__dirname, '../src');
    const localModules = path.resolve(__dirname, './node_modules');
    const parentModules = path.resolve(__dirname, '../node_modules');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@core': parentSrc,
      '@local': localSrc,
      '@': [localSrc, parentSrc],
      '@prisma/client': path.join(parentModules, '@prisma/client'),
      '.prisma/client': path.join(parentModules, '.prisma/client'),
    };
    config.resolve.modules = [
      localModules,
      parentModules,
      ...(config.resolve.modules ?? []),
    ];
    return config;
  },
  outputFileTracingRoot: path.join(__dirname, '../'),
  async headers() {
    return [
      {
        source: '/images/game-backgrounds/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
