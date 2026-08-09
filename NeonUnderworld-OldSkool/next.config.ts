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
    const parentModules = path.resolve(__dirname, '../node_modules');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@core': parentSrc,
      '@local': localSrc,
      '@': [localSrc, parentSrc],
      '@prisma/client': path.join(parentModules, '@prisma/client'),
      '.prisma/client': path.join(parentModules, '.prisma/client'),
    };
    return config;
  },
  outputFileTracingRoot: path.join(__dirname, '../'),
};

export default nextConfig;
