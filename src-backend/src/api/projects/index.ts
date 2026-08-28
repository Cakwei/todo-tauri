import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../db";
import { requireAuth } from "../../lib/utils";

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("preHandler", requireAuth);

	// GET /api/projects - Get all active projects for authenticated user
	fastify.get("/", async (request, reply) => {
		try {
			const projects = await prisma.project.findMany({
				where: {
					userId: request.user!.id,
					isArchived: false,
				},
				orderBy: { createdAt: "desc" },
			});

			return reply.send(projects);
		} catch (error) {
			request.log.error(error, "Failed to fetch projects");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to fetch projects" });
		}
	});
};
