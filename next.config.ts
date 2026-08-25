import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.MODEL_CENTER_NEXT_DIST_DIR || '.next',
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  typescript: {
    tsconfigPath: process.env.MODEL_CENTER_NEXT_TSCONFIG || 'tsconfig.json',
  },
  async rewrites() {
    // 网关对外契约是 /v1/*（文档 §7.1），实现放在 app/api/v1/*
    return [{ source: '/v1/:path*', destination: '/api/v1/:path*' }];
  },
};

export default nextConfig;
