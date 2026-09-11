import { existsSync } from "node:fs";
import { type CommonRedisOptions, Redis } from "ioredis";
import { logger } from "./const";

if (existsSync(".env")) {
	process.loadEnvFile();
}

if (!process.env.REDIS_URL)
	throw Error("REDIS_URL is not set as environment variable");

// Redis
export const redis = new Redis(process.env.REDIS_URL, {
	enableOfflineQueue: false,
} as CommonRedisOptions);

redis.on("error", (e) => {
	logger.error(e);
});
