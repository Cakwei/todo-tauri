import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../db";
import { requireAuth } from "../../lib/utils";

export const tagRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("preHandler", requireAuth);

	// GET /api/tags - Get all tags for authenticated user with rate-limiting
	fastify.get(
		"/",
		{
			config: {
				rateLimit: {
					max: 15,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						const routeName = "get-tags";

						return `${routeName}:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
			const userId = request.user?.id;

			if (!userId) {
				return reply
					.status(401)
					.send({ success: false, message: "Unauthorized" });
			}

			try {
				const tags = await prisma.tag.findMany({
					where: {
						userId,
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
		},
	);
};
