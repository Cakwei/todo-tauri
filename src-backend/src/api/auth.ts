/** biome-ignore-all lint/suspicious/useIterableCallbackReturn: <explanation> */
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import { auth } from "../lib/auth";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.route({
		method: ["GET", "POST"],
		url: "/api/auth/*",
		async handler(request, reply) {
			try {
				const url = new URL(request.url, `http://${request.headers.host}`);
				const headers = fromNodeHeaders(request.headers);
				const req = new Request(url.toString(), {
					method: request.method,
					headers,
					...(request.body ? { body: JSON.stringify(request.body) } : {}),
				});

				const response = await auth.handler(req);

				reply.status(response.status);
				response.headers.forEach((value, key) => reply.header(key, value));
				return reply.send(response.body ? await response.text() : null);
			} catch (error) {
				console.error(error);
				console.error(error);
				fastify.log.error("Authentication Error");
				return reply.status(500).send({
					error: "Internal authentication error",
					code: "AUTH_FAILURE",
				});
			}
		},
	});
};
