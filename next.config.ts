import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发模式下 Next 会校验 Origin；默认含 localhost，不含 127.0.0.1。
  // 用 http://127.0.0.1:3000 打开时，字体 / HMR WebSocket 等会带 Origin: 127.0.0.1，未放行则 403 / WS 失败。
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "118.24.143.172",
    "118.24.143.172:3000",
  ],
};

export default nextConfig;
