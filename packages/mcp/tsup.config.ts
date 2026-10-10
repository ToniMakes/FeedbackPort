import { defineConfig } from "tsup";

// @feedbackport/core is shipped as TypeScript source, so bundle it into the server instead of
// leaving a runtime import that Node cannot resolve.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  noExternal: ["@feedbackport/core"],
});
