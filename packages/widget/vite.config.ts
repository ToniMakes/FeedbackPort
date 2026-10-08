import { resolve } from "node:path";
import { defineConfig } from "vite";

// Bundle into a single IIFE so any host page can use it with one <script> tag; see docs/INTEGRATION.md
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "FeedbackPortWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    outDir: "dist",
  },
});
