import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// standalone 只在 Docker 构建里开启（Dockerfile 设 NEXT_OUTPUT=standalone）：
// 它追踪文件时要建符号链接，Windows 本地没有管理员权限/开发者模式会 EPERM，
// 而 Vercel 和普通本地构建也不需要它。
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  ...(standalone && {
    output: "standalone",
    // monorepo：让文件追踪从仓库根开始，@feedbackport/core 等 workspace 依赖才会被打进产物
    outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  }),
};

export default nextConfig;
