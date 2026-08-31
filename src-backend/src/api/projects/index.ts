import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../db";
import { requireAuth } from "../../lib/utils";

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("preHandler", requireAuth);

	// GET /api/projects - Get all active projects for authenticated user with Redis caching & custom rate-limiting
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

						//console.log("ddd", clientIp);
						// Request name/identifier path combo combined with userId and user's IP

						const routeName = "get-projects";

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

			const cacheKey = `projects:user:${userId}`;

			try {
				// 1. Attempt to fetch from Redis cache using optional chaining
				const cachedProjects = await fastify.redis?.get(cacheKey);
				if (cachedProjects) {
					return reply.send(JSON.parse(cachedProjects));
				}

				// 2. Fallback to database query if cache misses
				const projects = await prisma.project.findMany({
					where: {
						userId,
						isArchived: false,
					},
					orderBy: { createdAt: "desc" },
				});

				// 3. Store result in Redis cache with an expiration time if redis is available
				if (fastify.redis) {
					await fastify.redis.set(cacheKey, JSON.stringify(projects), "EX", 60);
				}

				return reply.send(projects);
			} catch (error) {
				request.log.error(error, "Failed to fetch projects");
				return reply
					.status(500)
					.send({ success: false, message: "Failed to fetch projects" });
			}
		},
	);
};
