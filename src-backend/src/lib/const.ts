import { existsSync } from "node:fs";

if (existsSync(".env")) {
	process.loadEnvFile();
}
export const CORSList = [
	process.env.BETTER_AUTH_URL || "",
	"tauri://localhost",
	"http://tauri.localhost",
	"https://tauri.localhost",
];

export const MESSAGE = {
	SUCCESSFUL_FETCH: "Successfully fetched data",
};
