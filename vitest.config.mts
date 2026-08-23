import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Tests must never reach the network or a real Cloudflare binding.
    // Anything that needs storage uses the in-memory D1 fake in tests/support.
    globals: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/demo*.ts", "src/lib/previewModel.ts"],
    },
  },
});
