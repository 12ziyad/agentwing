import { defineConfig } from "tsup";

export default defineConfig([
  {
    // The library: consumable from both module systems.
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "es2022",
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  },
  {
    // The CLI: ESM only. It uses top-level await, which CJS cannot express,
    // and a bin has no reason to be require()d.
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    target: "es2022",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
