import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth } from "../../lib/utils";

const createTagSchema = z.object({
	id: z.string().min(1).max(191).optional(),
	name: z.string().trim().min(1, "Name is required").max(50),
	color: z.string().trim().max(30).optional().nullable(),
});

const updateTagSchema = z.object({
	name: z.string().trim().min(1).max(50).optional(),
	color: z.string().trim().max(30).nullable().optional(),
});

const tagIdParamSchema = z.object({
	id: z.string().min(1),
});

export const tagRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("preHandler", requireAuth);

	// GET /api/tags - Get all tags for authenticated user
	fastify.get(
		"/",
		{
			config: {
				rateLimit: {
					max: 30,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						return `get-tags:${userId}:${request.ip}`;
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
					where: { userId },
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

	// POST /api/tags - Create tag
	fastify.post("/", async (request, reply) => {
		const userId = request.user?.id;
		if (!userId) {
			return reply
				.status(401)
				.send({ success: false, message: "Unauthorized" });
		}

		const parsed = createTagSchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid request payload",
				details: z.flattenError(parsed.error),
			});
		}

		try {
			const existing = await prisma.tag.findUnique({
				where: { userId_name: { userId, name: parsed.data.name } },
			});
			if (existing) {
				return reply
					.status(409)
					.send({ success: false, message: "Tag name already exists" });
			}

			const tag = await prisma.tag.create({
				data: {
					...parsed.data,
					userId,
				},
			});
			return reply.status(201).send({ success: true, data: tag });
		} catch (error) {
			request.log.error(error, "Failed to create tag");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to create tag" });
		}
	});

	// PATCH /api/tags/:id - Update tag
	fastify.patch("/:id", async (request, reply) => {
		const userId = request.user?.id;
		if (!userId) {
			return reply
				.status(401)
				.send({ success: false, message: "Unauthorized" });
		}

		const paramParsed = tagIdParamSchema.safeParse(request.params);
		const bodyParsed = updateTagSchema.safeParse(request.body);
		if (!paramParsed.success || !bodyParsed.success) {
			return reply
				.status(400)
				.send({ success: false, message: "Invalid request" });
		}

		try {
			const existing = await prisma.tag.findFirst({
				where: { id: paramParsed.data.id, userId },
			});
			if (!existing) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			const updated = await prisma.tag.update({
				where: { id: existing.id },
				data: bodyParsed.data,
			});
			return reply.send({ success: true, data: updated });
		} catch (error) {
			request.log.error(error, "Failed to update tag");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to update tag" });
		}
	});

	// DELETE /api/tags/:id - Delete tag
	fastify.delete("/:id", async (request, reply) => {
		const userId = request.user?.id;
		if (!userId) {
			return reply
				.status(401)
				.send({ success: false, message: "Unauthorized" });
		}

		const paramParsed = tagIdParamSchema.safeParse(request.params);
		if (!paramParsed.success) {
			return reply.status(400).send({ success: false, message: "Invalid ID" });
		}

		try {
			const result = await prisma.tag.deleteMany({
				where: { id: paramParsed.data.id, userId },
			});
			if (result.count === 0) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}
			return reply.send({ success: true, message: "Tag deleted" });
		} catch (error) {
			request.log.error(error, "Failed to delete tag");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to delete tag" });
		}
	});
};
