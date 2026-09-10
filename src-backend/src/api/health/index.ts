import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get("/", async (request, reply) => {
		return { success: "True", data: {}, message: "Server up" };
	});
};
