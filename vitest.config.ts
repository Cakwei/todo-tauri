import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"#": resolve(import.meta.dirname, "src"),
			"@": resolve(import.meta.dirname, "src"),
		},
	},
	test: {
		environment: "node",
		globals: true,
		include: [
			"src/**/*.test.ts",
			"src-backend/src/**/*.test.ts",
		],
	},
});
