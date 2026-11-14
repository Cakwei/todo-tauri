import { existsSync } from "node:fs";
import pino from "pino";

export const logger = pino({ level: "debug" });

if (existsSync(".env")) {
	process.loadEnvFile();
}
export const CORSList = [
	process.env.BETTER_AUTH_URL,
	"http://localhost:3000",
	"tauri://localhost",
	"http://tauri.localhost",
	"https://tauri.localhost",
].filter((origin): origin is string => Boolean(origin));

export const MESSAGE = {
	SUCCESSFUL_FETCH: "Successfully fetched data",
};
