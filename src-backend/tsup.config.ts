import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"], // Output as modern ECMAScript Modules
  target: "esnext",
  dts: false,       // Generate declaration (.d.ts) files
  clean: true,     // Clean output directory before every build
  splitting: false,
  sourcemap: true,
  tsconfig: "tsconfig.json", // Automatically respects your path aliases from tsconfig
});