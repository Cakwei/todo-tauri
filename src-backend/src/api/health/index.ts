import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get("/", async () => {
		return { success: "True", data: {}, message: "Server up" };
	});
};
