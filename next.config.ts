import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.MODEL_CENTER_NEXT_DIST_DIR || '.next',
  output: 'standalone',
  // ws 外部化：instrumentation 走 bundled 层，不外部化会把它打进 chunk；
  // 外部化后 require("ws") 会被输出裁剪追踪进 standalone，和 better-sqlite3 同一条路。
  serverExternalPackages: ['better-sqlite3', 'ws'],
  typescript: {
    tsconfigPath: process.env.MODEL_CENTER_NEXT_TSCONFIG || 'tsconfig.json',
  },
  async rewrites() {
    // 网关对外契约是 /v1/*（文档 §7.1），实现放在 app/api/v1/*
    return [{ source: '/v1/:path*', destination: '/api/v1/:path*' }];
  },
};

export default nextConfig;
