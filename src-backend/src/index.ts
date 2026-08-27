import cors from "@fastify/cors";
import Fastify from "fastify";
import { authRoutes } from "./routes/todos/auth";

const PORT = 3001;
const server = Fastify(/*{ logger: true }*/);
process.loadEnvFile();

if (!process.env.BETTER_AUTH_URL) throw Error("BETTER_AUTH_URL is not set");

// CORS Settings
await server.register(cors, {
	origin: process.env.BETTER_AUTH_URL,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	credentials: true,
	maxAge: 86400,
});

server.register(authRoutes);

server.get("/", async (request, reply) => {
	return { hello: "world" };
});

try {
	await server.listen({ port: PORT });
} catch (err) {
	server.log.error(err);
	process.exit(1);
}
