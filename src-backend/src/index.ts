import cors from "@fastify/cors";
import Fastify from "fastify";

const PORT = 3001;
const server = Fastify(/*{ logger: true }*/);

// CORS Settings
await server.register(cors, {
	credentials: true,
	origin: ["http://localhost:3000"],
});

server.get("/", async (request, reply) => {
	return { hello: "world" };
});

try {
	await server.listen({ port: PORT });
} catch (err) {
	server.log.error(err);
	process.exit(1);
}
