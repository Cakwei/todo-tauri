/** biome-ignore-all lint/suspicious/useIterableCallbackReturn: <explanation> */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth } from "../../lib/utils";

function assertBodyUserIdMatchesSession(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const body = request.body as Record<string, unknown> | undefined;
	if (body && typeof body.userId === "string" && body.userId.length > 0) {
		if (body.userId !== request.user?.id) {
			return reply.status(403).send({
				success: false,
				message: "userId does not match authenticated session",
			});
		}
	}
}

// Zod schemas
const getTodosQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
	search: z.string().trim().max(200).optional(),
	status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
	projectId: z.string().min(1).optional(),
});

const todoIdParamSchema = z.object({
	id: z.string().min(1, "Todo ID is required"),
});

// userId is accepted here ONLY so it can be compared against the session
// (see assertBodyUserIdMatchesSession). It is never read for authorization —
// the actual owner written to the DB is always request.user.id.
const createTodoSchema = z.object({
	title: z.string().trim().min(1, "Title is required").max(255),
	description: z.string().trim().max(5000).optional(),
	status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).default("TODO"),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
	dueDate: z.coerce.date().optional(),
	reminderAt: z.coerce.date().optional(),
	estimatedMinutes: z.number().int().nonnegative().max(100000).optional(),
	projectId: z.string().optional(),
	parentId: z.string().optional(),
	userId: z.string().optional(), // consistency check only — see above
});

const updateTodoSchema = createTodoSchema.partial().extend({
	completedAt: z.coerce.date().nullable().optional(),
	isPinned: z.boolean().optional(),
});

// -----------------------------------------------------------------------
// FASTIFY ROUTE PLUGIN
// -----------------------------------------------------------------------
export const todoRoutes: FastifyPluginAsync = async (fastify) => {
	// Require auth for every route in this plugin.
	fastify.addHook("preHandler", requireAuth);

	// GET /api/todos - Paginated & Searchable List (own todos only)
	fastify.get("/", async (request, reply) => {
		const queryResult = getTodosQuerySchema.safeParse(request.query);
		// console.log("hello");
		if (!queryResult.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid query parameters",
				details: queryResult.error.flatten().fieldErrors,
			});
		}

		const { page, limit, search, status, projectId } = queryResult.data;
		const skip = (page - 1) * limit;

		console.log(queryResult.data);

		// Always scope to the authenticated user — this is the fix for the
		// IDOR that let anyone list/read every user's todos.
		const whereCondition: any = {
			deletedAt: null,
			userId: request.user?.id,
		};

		if (search) {
			whereCondition.OR = [
				{ title: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
			];
		}
		if (status) whereCondition.status = status;
		if (projectId) whereCondition.projectId = projectId;

		try {
			const [todos, totalCount] = await Promise.all([
				prisma.todo.findMany({
					where: whereCondition,
					skip,
					take: limit,
					orderBy: { createdAt: "desc" },
					include: { project: true, tags: { include: { tag: true } } },
				}),
				prisma.todo.count({ where: whereCondition }),
			]);

			return reply.send({
				success: true,
				data: todos,
				message: "Fetched todos",
				currentPage: page,
				totalCount,
				totalPages: Math.ceil(totalCount / limit) || 1,
			});
		} catch (error) {
			request.log.error(error, "Failed to list todos");
			return reply.status(500).send({ success: false, data: [] });
		}
	});

	// GET /api/todos/stats - Metrics (own todos only)
	fastify.get("/stats", async (request, reply) => {
		const userId = request.user?.id;
		try {
			const [total, completed, aggregateTime] = await Promise.all([
				prisma.todo.count({ where: { deletedAt: null, userId } }),
				prisma.todo.count({
					where: { deletedAt: null, userId, status: "COMPLETED" },
				}),
				prisma.todo.aggregate({
					where: { deletedAt: null, userId, status: { not: "COMPLETED" } },
					_sum: { estimatedMinutes: true },
				}),
			]);

			return reply.send({
				success: true,
				data: {
					total,
					completed,
					completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
					remainingMinutes: aggregateTime._sum.estimatedMinutes || 0,
				},
			});
		} catch (error) {
			request.log.error(error, "Failed to compute todo stats");
			return reply.status(500).send({ success: false, data: null });
		}
	});

	// GET /api/todos/:id - Single Item (must belong to requester)
	fastify.get("/:id", async (request, reply) => {
		const paramResult = todoIdParamSchema.safeParse(request.params);
		if (!paramResult.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid route parameter",
				details: paramResult.error.flatten().fieldErrors,
			});
		}

		const { id } = paramResult.data;
		const todo = await prisma.todo.findFirst({
			where: { id, userId: request.user?.id, deletedAt: null },
		});
		if (!todo) {
			// Same 404 whether the id doesn't exist or belongs to someone else —
			// don't leak which one it is.
			return reply.status(404).send({ success: false, message: "Not found" });
		}
		return reply.send({ success: true, data: todo });
	});

	// POST /api/todos - Create (owner is always the authenticated user)
	fastify.post("/", async (request, reply) => {
		const bodyResult = createTodoSchema.safeParse(request.body);
		if (!bodyResult.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid request payload",
				details: bodyResult.error.flatten().fieldErrors,
			});
		}

		const mismatch = assertBodyUserIdMatchesSession(request, reply);
		if (mismatch) return mismatch;

		const userId = request.user?.id || "";
		const { projectId, parentId, ...rest } = bodyResult.data;

		try {
			// If a projectId was supplied, verify ownership
			if (projectId) {
				const project = await prisma.project.findFirst({
					where: { id: projectId, userId },
				});
				if (!project) {
					return reply
						.status(403)
						.send({ success: false, message: "Invalid project" });
				}
			}

			// If a parentId was supplied, verify ownership
			if (parentId) {
				const parent = await prisma.todo.findFirst({
					where: { id: parentId, userId, deletedAt: null },
				});

				if (!parent) {
					return reply
						.status(403)
						.send({ success: false, message: "Invalid parent todo" });
				}
			}

			const newTodo = await prisma.todo.create({
				data: { ...rest, projectId, parentId, userId },
			});

			return reply.status(201).send({ success: true, data: newTodo });
		} catch (error) {
			request.log.error(error, "Failed to create todo");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to create todo" });
		}
	});

	// PATCH /api/todos/:id - Partial Update (must belong to requester)
	fastify.patch("/:id", async (request, reply) => {
		const paramResult = todoIdParamSchema.safeParse(request.params);
		if (!paramResult.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid route parameter",
				details: z.flattenError(paramResult.error),
			});
		}

		const bodyResult = updateTodoSchema.safeParse(request.body);
		if (!bodyResult.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid request payload",
				details: bodyResult.error.flatten().fieldErrors,
			});
		}

		const { id } = paramResult.data;
		const userId = request.user!.id;
		const bodyData = bodyResult.data;

		const mismatch = assertBodyUserIdMatchesSession(request, reply);
		if (mismatch) return mismatch;

		try {
			// updateMany + ownership filter so this silently no-ops instead of
			// updating a row that isn't yours, then we check the count.
			const result = await prisma.todo.updateMany({
				where: { id, userId, deletedAt: null },
				data: {
					...bodyData,
					userId: undefined, // never write a client-supplied userId to the row
					completedAt:
						bodyData.status === "COMPLETED"
							? new Date()
							: bodyData.status
								? null
								: undefined,
				},
			});

			if (result.count === 0) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			const updated = await prisma.todo.findFirst({ where: { id, userId } });
			return reply.send({ success: true, data: updated });
		} catch (error) {
			request.log.error(error, "Failed to update todo");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to update todo" });
		}
	});

	// DELETE /api/todos/:id - Soft Delete (must belong to requester)
	fastify.delete("/:id", async (request, reply) => {
		const paramResult = todoIdParamSchema.safeParse(request.params);
		if (!paramResult.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid route parameter",
				details: paramResult.error.flatten().fieldErrors,
			});
		}

		const { id } = paramResult.data;
		const userId = request.user!.id;
		try {
			const result = await prisma.todo.updateMany({
				where: { id, userId, deletedAt: null },
				data: { deletedAt: new Date() },
			});

			if (result.count === 0) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			return reply.send({ success: true, message: "Todo soft-deleted" });
		} catch (error) {
			request.log.error(error, "Failed to delete todo");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to delete todo" });
		}
	});
};
