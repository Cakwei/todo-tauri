import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth } from "../../lib/utils";

const createProjectSchema = z.object({
	id: z.string().min(1).max(191).optional(),
	name: z.string().trim().min(1, "Name is required").max(191),
	description: z.string().trim().max(2000).optional().nullable(),
	color: z.string().trim().max(30).optional().nullable(),
});

const updateProjectSchema = z.object({
	name: z.string().trim().min(1).max(191).optional(),
	description: z.string().trim().max(2000).nullable().optional(),
	color: z.string().trim().max(30).nullable().optional(),
	isArchived: z.boolean().optional(),
});

const projectIdParamSchema = z.object({
	id: z.string().min(1),
});

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("preHandler", requireAuth);

	const invalidateCache = async (userId: string) => {
		try {
			await fastify.redis?.del(`projects:user:${userId}`);
		} catch {
			// Ignore cache invalidation errors
		}
	};

	// GET /api/projects - Get all active projects for authenticated user
	fastify.get(
		"/",
		{
			config: {
				rateLimit: {
					max: 30,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						return `get-projects:${userId}:${request.ip}`;
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
				const cachedProjects = await fastify.redis?.get(cacheKey);
				if (cachedProjects) {
					return reply.send(JSON.parse(cachedProjects));
				}

				const projects = await prisma.project.findMany({
					where: {
						userId,
						isArchived: false,
					},
					orderBy: { createdAt: "desc" },
				});

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

	// POST /api/projects - Create project
	fastify.post("/", async (request, reply) => {
		const userId = request.user?.id;
		if (!userId) {
			return reply
				.status(401)
				.send({ success: false, message: "Unauthorized" });
		}

		const parsed = createProjectSchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid request payload",
				details: z.flattenError(parsed.error),
			});
		}

		try {
			const project = await prisma.project.create({
				data: {
					...parsed.data,
					userId,
				},
			});
			await invalidateCache(userId);
			return reply.status(201).send({ success: true, data: project });
		} catch (error) {
			request.log.error(error, "Failed to create project");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to create project" });
		}
	});

	// PATCH /api/projects/:id - Update project
	fastify.patch("/:id", async (request, reply) => {
		const userId = request.user?.id;
		if (!userId) {
			return reply
				.status(401)
				.send({ success: false, message: "Unauthorized" });
		}

		const paramParsed = projectIdParamSchema.safeParse(request.params);
		const bodyParsed = updateProjectSchema.safeParse(request.body);
		if (!paramParsed.success || !bodyParsed.success) {
			return reply.status(400).send({
				success: false,
				message: "Invalid request",
			});
		}

		try {
			const existing = await prisma.project.findFirst({
				where: { id: paramParsed.data.id, userId },
			});
			if (!existing) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			const updated = await prisma.project.update({
				where: { id: existing.id },
				data: bodyParsed.data,
			});
			await invalidateCache(userId);
			return reply.send({ success: true, data: updated });
		} catch (error) {
			request.log.error(error, "Failed to update project");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to update project" });
		}
	});

	// DELETE /api/projects/:id - Delete project (todos have projectId set to null)
	fastify.delete("/:id", async (request, reply) => {
		const userId = request.user?.id;
		if (!userId) {
			return reply
				.status(401)
				.send({ success: false, message: "Unauthorized" });
		}

		const paramParsed = projectIdParamSchema.safeParse(request.params);
		if (!paramParsed.success) {
			return reply.status(400).send({ success: false, message: "Invalid ID" });
		}

		try {
			const result = await prisma.project.deleteMany({
				where: { id: paramParsed.data.id, userId },
			});
			if (result.count === 0) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}
			await invalidateCache(userId);
			return reply.send({ success: true, message: "Project deleted" });
		} catch (error) {
			request.log.error(error, "Failed to delete project");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to delete project" });
		}
	});
};
