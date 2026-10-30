import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // Declarations come from tsc (tsup 8 dts is incompatible with TypeScript 7); the shebang is harmless in the library entry.
  banner: { js: "#!/usr/bin/env node" },
});
