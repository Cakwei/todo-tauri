import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../db";
import { requireAuth } from "../../lib/utils";

export const tagRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("preHandler", requireAuth);

	// GET /api/tags - Get all tags for authenticated user
	fastify.get("/", async (request, reply) => {
		try {
			const tags = await prisma.tag.findMany({
				where: {
					userId: request.user!.id,
				},
				orderBy: { name: "asc" },
			});

			return reply.send(tags);
		} catch (error) {
			request.log.error(error, "Failed to fetch tags");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to fetch tags" });
		}
	});
};
