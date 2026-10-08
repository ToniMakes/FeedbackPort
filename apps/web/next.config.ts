import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// standalone output is enabled only in the Docker build (the Dockerfile sets NEXT_OUTPUT=standalone):
// tracing files creates symlinks, which fail with EPERM on Windows without admin rights/developer mode,
// and neither Vercel nor a regular local build needs it.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  ...(standalone && {
    output: "standalone",
    // monorepo: start file tracing at the repo root so workspace dependencies such as @feedbackport/core are bundled
    outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  }),
};

export default nextConfig;
