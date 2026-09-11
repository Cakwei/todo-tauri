import { existsSync } from "node:fs";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { authRoutes } from "./api/auth/auth";
import { healthRoutes } from "./api/health";
import { projectRoutes } from "./api/projects/index";
import { tagRoutes } from "./api/tags/index";
import { todoRoutes } from "./api/todos/index";
import { CORSList } from "./lib/const";
import { redis } from "./lib/redis";

const PORT = 3001;
const server = Fastify({
	/*logger: true*/
});

if (existsSync(".env")) {
	process.loadEnvFile();
}

if (!process.env.BETTER_AUTH_URL)
	throw Error("BETTER_AUTH_URL is not set as environment variable");

// Rate-limit
// if (process.env.NODE_ENV === "production") {
await server.register(rateLimit, {
	max: 30,
	timeWindow: "1 minute",
	redis: redis,
	skipOnError: true,
});
// }

// CORS Settings
await server.register(cors, {
	origin: CORSList,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	credentials: true,
	exposedHeaders: ["set-auth-token"],
	maxAge: 86400,
});

// Cookies
await server.register(cookie);

// Imported routes
await server.register(authRoutes);
await server.register(todoRoutes, { prefix: "/api/todos" });
await server.register(projectRoutes, { prefix: "/api/projects" });
await server.register(tagRoutes, { prefix: "/api/tags" });
await server.register(healthRoutes, { prefix: "/api/health" });

// Init
try {
	await server.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
	server.log.error(err);
	process.exit(1);
}
