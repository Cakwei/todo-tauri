import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import redis from "@fastify/redis";
import Fastify from "fastify";
import { authRoutes } from "./api/auth";
import { projectRoutes } from "./api/projects/index";
import { tagRoutes } from "./api/tags/index";
import { todoRoutes } from "./api/todos/index";
import { CORSList } from "./lib/const";

const PORT = 3001;
const server = Fastify(/*{ logger: true }*/);
process.loadEnvFile();

if (!process.env.BETTER_AUTH_URL)
	throw Error("BETTER_AUTH_URL is not set as environment variable");
if (!process.env.REDIS_URL)
	throw Error("REDIS_URL is not set as environment variable");

// Redis
await server.register(redis, {
	url: process.env.REDIS_URL,
});

// Rate-limit
await server.register(rateLimit, {
	max: 15,
	timeWindow: "1 minute",
	redis: server.redis,
});

// CORS Settings
await server.register(cors, {
	origin: CORSList,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	credentials: true,
	maxAge: 86400,
});

// Cookies
await server.register(cookie);

// Imported routes
await server.register(authRoutes);
await server.register(todoRoutes, { prefix: "/api/todos" });
await server.register(projectRoutes, { prefix: "/api/projects" });
await server.register(tagRoutes, { prefix: "/api/tags" });

// Init
try {
	await server.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
	server.log.error(err);
	process.exit(1);
}
