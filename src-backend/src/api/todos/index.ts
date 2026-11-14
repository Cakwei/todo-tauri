/** biome-ignore-all lint/suspicious/useIterableCallbackReturn: <explanation> */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { TodoWhereInput } from "../../generated/prisma/models";
import { logger } from "../../lib/const";
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
	status: z.enum(["IN_PROGRESS", "LATE", "COMPLETED"]).optional(),
	projectId: z.string().min(1).optional(),
	tagId: z.string().min(1).optional(),
	includeSubtasks: z.coerce.boolean().optional().default(false),
});

const todoIdParamSchema = z.object({
	id: z.string().min(1, "Todo ID is required"),
});

const createTodoSchema = z.object({
	id: z.string().min(1).max(191).optional(),
	title: z.string().trim().min(1, "Title is required").max(255),
	description: z.string().trim().max(5000).optional(),
	status: z.enum(["IN_PROGRESS", "LATE", "COMPLETED"]).default("IN_PROGRESS"),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
	dueDate: z.coerce.date().optional(),
	reminderAt: z.coerce.date().optional(),
	recurrence: z.string().trim().max(191).optional(),
	estimatedMinutes: z.number().int().nonnegative().max(100000).optional(),
	actualMinutes: z.number().int().nonnegative().max(100000).optional(),
	isPinned: z.boolean().optional(),
	projectId: z.string().optional(),
	parentId: z.string().optional(),
	tagIds: z.array(z.string().min(1)).max(50).optional(),
	reorderIndex: z.number().default(0),
	userId: z.string().optional(),
});

// Schema strictly for updating an existing todo (NO defaults that override omitted fields)
const updateTodoSchema = z.object({
	title: z.string().trim().min(1).max(255).optional(),
	description: z.string().trim().max(5000).nullable().optional(),
	status: z.enum(["IN_PROGRESS", "LATE", "COMPLETED"]).optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
	dueDate: z.coerce.date().nullable().optional(),
	reminderAt: z.coerce.date().nullable().optional(),
	recurrence: z.string().trim().max(191).nullable().optional(),
	estimatedMinutes: z
		.number()
		.int()
		.nonnegative()
		.max(100000)
		.nullable()
		.optional(),
	actualMinutes: z
		.number()
		.int()
		.nonnegative()
		.max(100000)
		.nullable()
		.optional(),
	projectId: z.string().nullable().optional(),
	parentId: z.string().nullable().optional(),
	reorderIndex: z.number().optional(),
	userId: z.string().optional(),
	completedAt: z.coerce.date().nullable().optional(),
	isPinned: z.boolean().optional(),
});

const syncOperationSchema = z.object({
	clientMutationId: z.string().min(1),
	entityType: z.enum(["todo", "project", "tag"]),
	entityId: z.string().min(1),
	operation: z.enum(["CREATE", "UPDATE", "DELETE", "REORDER"]),
	updatedAt: z.string().datetime(),
	payload: z.record(z.string(), z.unknown()).default({}),
});

const syncBatchSchema = z.object({
	operations: z.array(syncOperationSchema).min(1).max(200),
});

const todoInclude = {
	project: true,
	tags: { include: { tag: true } },
	children: {
		where: { deletedAt: null },
		orderBy: { reorderIndex: "asc" as const },
	},
	attachments: true,
};

export const todoRoutes: FastifyPluginAsync = async (fastify) => {
	// Require auth for every route in this plugin.
	fastify.addHook("preHandler", requireAuth);

	// Add near your other schemas
	const reorderTodosSchema = z.object({
		orderedIds: z.array(z.string().min(1)).min(1).max(500),
	});

	// Handles reordering by DnD in client
	fastify.post(
		"/reorder",
		{
			config: {
				rateLimit: {
					max: 30,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						return `reorder-todos:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
			const bodyResult = reorderTodosSchema.safeParse(request.body);
			if (!bodyResult.success) {
				return reply.status(400).send({
					success: false,
					error: "Invalid request payload",
					details: bodyResult.error.flatten().fieldErrors,
				});
			}

			const { orderedIds } = bodyResult.data;
			const userId = request.user!.id;

			try {
				const owned = await prisma.todo.findMany({
					where: { id: { in: orderedIds }, userId, deletedAt: null },
					select: { id: true },
				});

				if (owned.length !== orderedIds.length) {
					return reply.status(403).send({
						success: false,
						message: "One or more todos were not found or are not yours",
					});
				}

				// Single atomic transaction — either the whole new order lands, or none of it does.
				await prisma.$transaction(
					orderedIds.map((id, index) =>
						prisma.todo.update({
							where: { id },
							data: { reorderIndex: index },
						}),
					),
				);

				return reply.send({ success: true });
			} catch (error) {
				request.log.error(error, "Failed to reorder todos");
				return reply
					.status(500)
					.send({ success: false, message: "Failed to reorder todos" });
			}
		},
	);

	// GET /api/todos - Paginated & Searchable List (own todos only)
	fastify.get(
		"/",
		{
			config: {
				rateLimit: {
					max: 30,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						return `get-todos:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
			const queryResult = getTodosQuerySchema.safeParse(request.query);
			if (!queryResult.success) {
				return reply.status(400).send({
					success: false,
					error: "Invalid query parameters",
					details: z.flattenError(queryResult.error),
				});
			}

			const { page, limit, search, status, projectId, tagId, includeSubtasks } =
				queryResult.data;

			const skip = (page - 1) * limit;

			const whereCondition: TodoWhereInput = {
				deletedAt: null,
				userId: request.user?.id,
			};

			if (!includeSubtasks) {
				whereCondition.parentId = null;
			}
			if (search) {
				whereCondition.OR = [
					{ title: { contains: search } },
					{ description: { contains: search } },
				];
			}
			if (status) whereCondition.status = status;
			if (projectId) whereCondition.projectId = projectId;
			if (tagId) {
				whereCondition.tags = { some: { tagId } };
			}

			try {
				const now = new Date();
				await prisma.todo.updateMany({
					where: {
						userId: request.user?.id,
						deletedAt: null,
						status: "IN_PROGRESS",
						dueDate: { lt: now },
					},
					data: { status: "LATE" },
				});

				const [todos, totalCount] = await Promise.all([
					prisma.todo.findMany({
						where: whereCondition,
						skip,
						take: limit,
						orderBy: [
							{ isPinned: "desc" },
							{ reorderIndex: "asc" },
							{ createdAt: "desc" },
						],
						include: todoInclude,
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
		},
	);

	// GET /api/todos/stats - Metrics (own todos only)
	fastify.get(
		"/stats",
		{
			config: {
				rateLimit: {
					max: 30,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						return `get-todo-stats:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
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
						completionRate:
							total > 0 ? Math.round((completed / total) * 100) : 0,
						remainingMinutes: aggregateTime._sum.estimatedMinutes || 0,
					},
				});
			} catch (error) {
				request.log.error(error, "Failed to compute todo stats");
				return reply.status(500).send({ success: false, data: null });
			}
		},
	);

	// GET /api/todos/:id - Single Item (must belong to requester)
	fastify.get(
		"/:id",
		{
			config: {
				rateLimit: {
					max: 30,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						return `get-todo-by-id:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
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
				include: todoInclude,
			});
			if (!todo) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}
			return reply.send({ success: true, data: todo });
		},
	);

	// POST /api/todos - Create (owner is always the authenticated user)
	fastify.post(
		"/",
		{
			config: {
				rateLimit: {
					max: 20,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						return `create-todo:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
			const bodyResult = createTodoSchema.safeParse(request.body);

			if (!bodyResult.success) {
				logger.error(bodyResult.error);
				return reply.status(400).send({
					success: false,
					error: "Invalid request payload",
					details: z.flattenError(bodyResult.error),
				});
			}

			const mismatch = assertBodyUserIdMatchesSession(request, reply);
			if (mismatch) return mismatch;

			const userId = request.user?.id || "";
			const {
				projectId,
				parentId,
				tagIds,
				id: clientId,
				...rest
			} = bodyResult.data;

			try {
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

				if (tagIds && tagIds.length > 0) {
					const ownedTags = await prisma.tag.findMany({
						where: { id: { in: tagIds }, userId },
						select: { id: true },
					});
					if (ownedTags.length !== tagIds.length) {
						return reply
							.status(403)
							.send({ success: false, message: "Invalid tag(s)" });
					}
				}

				const newTodo = await prisma.todo.create({
					data: {
						...(clientId ? { id: clientId } : {}),
						...rest,
						projectId,
						parentId,
						userId,
						...(tagIds && tagIds.length > 0
							? {
									tags: {
										create: tagIds.map((tagId) => ({ tagId })),
									},
								}
							: {}),
					},
					include: todoInclude,
				});

				await prisma.activityLog.create({
					data: {
						action: "TASK_CREATED",
						details: JSON.stringify({ title: newTodo.title }),
						todoId: newTodo.id,
						userId,
					},
				});

				return reply.status(201).send({ success: true, data: newTodo });
			} catch (error) {
				request.log.error(error, "Failed to create todo");
				return reply
					.status(500)
					.send({ success: false, message: "Failed to create todo" });
			}
		},
	);

	// PATCH /api/todos/:id - Partial Update (must belong to requester)
	fastify.patch(
		"/:id",
		{
			config: {
				rateLimit: {
					max: 30,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						return `update-todo:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
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
				const existingTodo = await prisma.todo.findFirst({
					where: { id, userId, deletedAt: null },
				});

				if (!existingTodo) {
					return reply
						.status(404)
						.send({ success: false, message: "Not found" });
				}

				if (bodyData.projectId) {
					const project = await prisma.project.findFirst({
						where: { id: bodyData.projectId, userId },
					});
					if (!project) {
						return reply
							.status(403)
							.send({ success: false, message: "Invalid project" });
					}
				}

				if (bodyData.parentId) {
					if (bodyData.parentId === id) {
						return reply.status(400).send({
							success: false,
							message: "Todo cannot be its own parent",
						});
					}
					const parent = await prisma.todo.findFirst({
						where: { id: bodyData.parentId, userId, deletedAt: null },
					});
					if (!parent) {
						return reply
							.status(403)
							.send({ success: false, message: "Invalid parent todo" });
					}
				}

				let completedAt = existingTodo.completedAt;
				if (bodyData.completedAt !== undefined) {
					completedAt = bodyData.completedAt;
				} else if (bodyData.status !== undefined) {
					if (
						bodyData.status === "COMPLETED" &&
						existingTodo.status !== "COMPLETED"
					) {
						completedAt = new Date();
					} else if (bodyData.status !== "COMPLETED") {
						completedAt = null;
					}
				}

				const updated = await prisma.todo.update({
					where: { id },
					data: {
						title: bodyData.title ?? existingTodo.title,
						description:
							bodyData.description !== undefined
								? bodyData.description
								: existingTodo.description,
						status: bodyData.status ?? existingTodo.status,
						priority: bodyData.priority ?? existingTodo.priority,
						reorderIndex: bodyData.reorderIndex ?? existingTodo.reorderIndex,
						isPinned: bodyData.isPinned ?? existingTodo.isPinned,
						projectId:
							bodyData.projectId !== undefined
								? bodyData.projectId
								: existingTodo.projectId,
						parentId:
							bodyData.parentId !== undefined
								? bodyData.parentId
								: existingTodo.parentId,
						dueDate:
							bodyData.dueDate !== undefined
								? bodyData.dueDate
								: existingTodo.dueDate,
						reminderAt:
							bodyData.reminderAt !== undefined
								? bodyData.reminderAt
								: existingTodo.reminderAt,
						recurrence:
							bodyData.recurrence !== undefined
								? bodyData.recurrence
								: existingTodo.recurrence,
						estimatedMinutes:
							bodyData.estimatedMinutes !== undefined
								? bodyData.estimatedMinutes
								: existingTodo.estimatedMinutes,
						actualMinutes:
							bodyData.actualMinutes !== undefined
								? bodyData.actualMinutes
								: existingTodo.actualMinutes,
						completedAt,
					},
					include: todoInclude,
				});

				await prisma.activityLog.create({
					data: {
						action:
							bodyData.status && bodyData.status !== existingTodo.status
								? "STATUS_CHANGED"
								: "TASK_UPDATED",
						details: JSON.stringify(bodyData),
						todoId: updated.id,
						userId,
					},
				});

				return reply.send({ success: true, data: updated });
			} catch (error) {
				request.log.error(error, "Failed to update todo");
				return reply
					.status(500)
					.send({ success: false, message: "Failed to update todo" });
			}
		},
	);

	// DELETE /api/todos/:id - Soft Delete (must belong to requester)
	fastify.delete(
		"/:id",
		{
			config: {
				rateLimit: {
					max: 20,
					timeWindow: "1 minute",
					keyGenerator: (request) => {
						const userId = request.user?.id ?? "anonymous";
						const clientIp = request.ip;
						return `delete-todo:${userId}:${clientIp}`;
					},
				},
			},
		},
		async (request, reply) => {
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
					return reply
						.status(404)
						.send({ success: false, message: "Not found" });
				}

				await prisma.activityLog.create({
					data: {
						action: "TASK_DELETED",
						todoId: id,
						userId,
					},
				});

				return reply.send({ success: true, message: "Todo soft-deleted" });
			} catch (error) {
				request.log.error(error, "Failed to delete todo");
				return reply
					.status(500)
					.send({ success: false, message: "Failed to delete todo" });
			}
		},
	);

	// PUT /api/todos/:id/tags - Replace tags assigned to a todo
	fastify.put("/:id/tags", async (request, reply) => {
		const paramResult = todoIdParamSchema.safeParse(request.params);
		const bodyResult = z
			.object({ tagIds: z.array(z.string().min(1)).max(50) })
			.safeParse(request.body);

		if (!paramResult.success || !bodyResult.success) {
			return reply
				.status(400)
				.send({ success: false, message: "Invalid request" });
		}

		const { id } = paramResult.data;
		const { tagIds } = bodyResult.data;
		const userId = request.user!.id;

		try {
			const todo = await prisma.todo.findFirst({
				where: { id, userId, deletedAt: null },
			});
			if (!todo) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			if (tagIds.length > 0) {
				const ownedTags = await prisma.tag.findMany({
					where: { id: { in: tagIds }, userId },
					select: { id: true },
				});
				if (ownedTags.length !== tagIds.length) {
					return reply
						.status(403)
						.send({ success: false, message: "Invalid tag(s)" });
				}
			}

			await prisma.$transaction([
				prisma.todoTag.deleteMany({ where: { todoId: id } }),
				...(tagIds.length > 0
					? [
							prisma.todoTag.createMany({
								data: tagIds.map((tagId) => ({ todoId: id, tagId })),
							}),
						]
					: []),
			]);

			const updated = await prisma.todo.findUnique({
				where: { id },
				include: todoInclude,
			});

			return reply.send({ success: true, data: updated });
		} catch (error) {
			request.log.error(error, "Failed to update todo tags");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to update todo tags" });
		}
	});

	// POST /api/todos/:id/attachments - Add attachment link/metadata
	fastify.post("/:id/attachments", async (request, reply) => {
		const paramResult = todoIdParamSchema.safeParse(request.params);
		const bodyResult = z
			.object({
				name: z.string().trim().min(1).max(255),
				url: z.string().trim().min(1).max(2000),
				fileType: z.string().trim().max(50).optional(),
				fileSize: z.number().int().nonnegative().optional(),
			})
			.safeParse(request.body);

		if (!paramResult.success || !bodyResult.success) {
			return reply
				.status(400)
				.send({ success: false, message: "Invalid request" });
		}

		const { id } = paramResult.data;
		const userId = request.user!.id;

		try {
			const todo = await prisma.todo.findFirst({
				where: { id, userId, deletedAt: null },
			});
			if (!todo) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			const attachment = await prisma.attachment.create({
				data: {
					...bodyResult.data,
					todoId: id,
				},
			});

			return reply.status(201).send({ success: true, data: attachment });
		} catch (error) {
			request.log.error(error, "Failed to add attachment");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to add attachment" });
		}
	});

	// DELETE /api/todos/:id/attachments/:attachmentId
	fastify.delete("/:id/attachments/:attachmentId", async (request, reply) => {
		const paramResult = z
			.object({ id: z.string().min(1), attachmentId: z.string().min(1) })
			.safeParse(request.params);
		if (!paramResult.success) {
			return reply.status(400).send({ success: false, message: "Invalid ID" });
		}

		const { id, attachmentId } = paramResult.data;
		const userId = request.user!.id;

		try {
			const todo = await prisma.todo.findFirst({
				where: { id, userId, deletedAt: null },
			});
			if (!todo) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			const result = await prisma.attachment.deleteMany({
				where: { id: attachmentId, todoId: id },
			});
			if (result.count === 0) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			return reply.send({ success: true, message: "Attachment removed" });
		} catch (error) {
			request.log.error(error, "Failed to remove attachment");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to remove attachment" });
		}
	});

	// GET /api/todos/:id/activity - Fetch activity log for a todo
	fastify.get("/:id/activity", async (request, reply) => {
		const paramResult = todoIdParamSchema.safeParse(request.params);
		if (!paramResult.success) {
			return reply.status(400).send({ success: false, message: "Invalid ID" });
		}

		const { id } = paramResult.data;
		const userId = request.user!.id;

		try {
			const todo = await prisma.todo.findFirst({
				where: { id, userId },
			});
			if (!todo) {
				return reply.status(404).send({ success: false, message: "Not found" });
			}

			const logs = await prisma.activityLog.findMany({
				where: { todoId: id, userId },
				orderBy: { createdAt: "desc" },
				take: 50,
			});

			return reply.send({ success: true, data: logs });
		} catch (error) {
			request.log.error(error, "Failed to fetch activity logs");
			return reply
				.status(500)
				.send({ success: false, message: "Failed to fetch activity logs" });
		}
	});

	// POST /api/todos/sync - Offline-to-online batch sync (Last-Write-Wins via updatedAt)
	fastify.post("/sync", async (request, reply) => {
		const bodyResult = syncBatchSchema.safeParse(request.body);
		if (!bodyResult.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid sync payload",
				details: z.flattenError(bodyResult.error),
			});
		}

		const userId = request.user!.id;
		const results: Array<{
			clientMutationId: string;
			status: "applied" | "skipped_stale" | "error";
			error?: string;
		}> = [];

		for (const op of bodyResult.data.operations) {
			const opTime = new Date(op.updatedAt);
			try {
				if (op.entityType === "todo") {
					if (op.operation === "CREATE") {
						const parsed = createTodoSchema.safeParse(op.payload);
						if (!parsed.success) {
							results.push({
								clientMutationId: op.clientMutationId,
								status: "error",
								error: "Invalid todo create payload",
							});
							continue;
						}
						const existing = await prisma.todo.findUnique({
							where: { id: op.entityId },
						});
						if (existing) {
							if (existing.userId !== userId || existing.updatedAt > opTime) {
								results.push({
									clientMutationId: op.clientMutationId,
									status: "skipped_stale",
								});
								continue;
							}
						} else {
							const { tagIds, id: _ignored, ...rest } = parsed.data;
							await prisma.todo.create({
								data: {
									id: op.entityId,
									...rest,
									userId,
									...(tagIds?.length
										? { tags: { create: tagIds.map((tagId) => ({ tagId })) } }
										: {}),
								},
							});
						}
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					} else if (op.operation === "UPDATE") {
						const parsed = updateTodoSchema.safeParse(op.payload);
						if (!parsed.success) {
							results.push({
								clientMutationId: op.clientMutationId,
								status: "error",
								error: "Invalid todo update payload",
							});
							continue;
						}
						const existing = await prisma.todo.findFirst({
							where: { id: op.entityId, userId },
						});
						if (!existing || existing.updatedAt > opTime) {
							results.push({
								clientMutationId: op.clientMutationId,
								status: "skipped_stale",
							});
							continue;
						}
						await prisma.todo.update({
							where: { id: op.entityId },
							data: parsed.data,
						});
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					} else if (op.operation === "DELETE") {
						const existing = await prisma.todo.findFirst({
							where: { id: op.entityId, userId },
						});
						if (!existing || existing.updatedAt > opTime) {
							results.push({
								clientMutationId: op.clientMutationId,
								status: "skipped_stale",
							});
							continue;
						}
						await prisma.todo.update({
							where: { id: op.entityId },
							data: { deletedAt: opTime },
						});
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					} else if (op.operation === "REORDER") {
						const parsed = reorderTodosSchema.safeParse(op.payload);
						if (!parsed.success) {
							results.push({
								clientMutationId: op.clientMutationId,
								status: "error",
								error: "Invalid reorder payload",
							});
							continue;
						}
						const owned = await prisma.todo.findMany({
							where: {
								id: { in: parsed.data.orderedIds },
								userId,
								deletedAt: null,
							},
							select: { id: true },
						});
						const ownedSet = new Set(owned.map((t) => t.id));
						await prisma.$transaction(
							parsed.data.orderedIds
								.filter((tid) => ownedSet.has(tid))
								.map((tid, index) =>
									prisma.todo.update({
										where: { id: tid },
										data: { reorderIndex: index },
									}),
								),
						);
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					}
				} else if (op.entityType === "project") {
					if (op.operation === "CREATE") {
						const name = String(op.payload.name ?? "").trim();
						if (!name) {
							results.push({
								clientMutationId: op.clientMutationId,
								status: "error",
								error: "Project name required",
							});
							continue;
						}
						await prisma.project.upsert({
							where: { id: op.entityId },
							update: {},
							create: {
								id: op.entityId,
								name,
								color:
									typeof op.payload.color === "string"
										? op.payload.color
										: undefined,
								userId,
							},
						});
						await fastify.redis?.del(`projects:user:${userId}`);
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					} else if (op.operation === "DELETE") {
						await prisma.project.deleteMany({
							where: { id: op.entityId, userId },
						});
						await fastify.redis?.del(`projects:user:${userId}`);
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					}
				} else if (op.entityType === "tag") {
					if (op.operation === "CREATE") {
						const name = String(op.payload.name ?? "").trim();
						if (!name) {
							results.push({
								clientMutationId: op.clientMutationId,
								status: "error",
								error: "Tag name required",
							});
							continue;
						}
						await prisma.tag.upsert({
							where: { id: op.entityId },
							update: {},
							create: {
								id: op.entityId,
								name,
								color:
									typeof op.payload.color === "string"
										? op.payload.color
										: undefined,
								userId,
							},
						});
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					} else if (op.operation === "DELETE") {
						await prisma.tag.deleteMany({
							where: { id: op.entityId, userId },
						});
						results.push({
							clientMutationId: op.clientMutationId,
							status: "applied",
						});
					}
				}
			} catch (err) {
				request.log.error(err, "Sync operation failed");
				results.push({
					clientMutationId: op.clientMutationId,
					status: "error",
					error: err instanceof Error ? err.message : "Sync failed",
				});
			}
		}

		return reply.send({ success: true, results });
	});
};
