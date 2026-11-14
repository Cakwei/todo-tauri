import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
	todo: {
		findMany: vi.fn(),
		count: vi.fn(),
		findFirst: vi.fn(),
		findUnique: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		updateMany: vi.fn(),
	},
	project: {
		findFirst: vi.fn(),
		upsert: vi.fn(),
		deleteMany: vi.fn(),
	},
	tag: {
		findMany: vi.fn(),
		upsert: vi.fn(),
		deleteMany: vi.fn(),
	},
	todoTag: {
		deleteMany: vi.fn(),
		createMany: vi.fn(),
	},
	attachment: {
		create: vi.fn(),
		deleteMany: vi.fn(),
	},
	activityLog: {
		create: vi.fn(),
		findMany: vi.fn(),
	},
	$transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

vi.mock("../../db", () => ({
	prisma: prismaMock,
}));

vi.mock("../../lib/utils", () => ({
	requireAuth: vi.fn(async (request: { user?: { id: string } }) => {
		request.user = { id: "user-1" };
	}),
}));

async function buildApp() {
	const { todoRoutes } = await import("../todos/index");
	const app = Fastify();
	await app.register(todoRoutes, { prefix: "/api/todos" });
	return app;
}

describe("todoRoutes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("GET /api/todos bulk-marks overdue IN_PROGRESS tasks as LATE and returns paginated data", async () => {
		prismaMock.todo.updateMany.mockResolvedValueOnce({ count: 1 });
		prismaMock.todo.findMany.mockResolvedValueOnce([
			{ id: "todo-1", title: "Overdue", status: "LATE" },
		]);
		prismaMock.todo.count.mockResolvedValueOnce(1);

		const app = await buildApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/todos?page=1&limit=10",
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.success).toBe(true);
		expect(body.totalCount).toBe(1);
		expect(prismaMock.todo.updateMany).toHaveBeenCalledTimes(1);
	});

	it("GET /api/todos returns 400 on invalid status query parameter", async () => {
		const app = await buildApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/todos?status=INVALID_STATUS",
		});

		expect(res.statusCode).toBe(400);
	});

	it("POST /api/todos creates todo with client id and records ActivityLog", async () => {
		prismaMock.todo.create.mockResolvedValueOnce({
			id: "client-uuid-1",
			title: "Offline created",
			status: "IN_PROGRESS",
		});
		prismaMock.activityLog.create.mockResolvedValueOnce({});

		const app = await buildApp();
		const res = await app.inject({
			method: "POST",
			url: "/api/todos",
			payload: {
				id: "client-uuid-1",
				title: "Offline created",
			},
		});

		expect(res.statusCode).toBe(201);
		expect(prismaMock.todo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					id: "client-uuid-1",
					title: "Offline created",
					userId: "user-1",
				}),
			}),
		);
		expect(prismaMock.activityLog.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					action: "TASK_CREATED",
					todoId: "client-uuid-1",
				}),
			}),
		);
	});

	it("PATCH /api/todos/:id preserves COMPLETED status when status is omitted", async () => {
		const completedAt = new Date("2026-01-01T00:00:00Z");
		prismaMock.todo.findFirst.mockResolvedValueOnce({
			id: "todo-1",
			userId: "user-1",
			title: "Old title",
			description: null,
			status: "COMPLETED",
			priority: "MEDIUM",
			reorderIndex: 0,
			isPinned: false,
			projectId: null,
			parentId: null,
			dueDate: null,
			reminderAt: null,
			recurrence: null,
			estimatedMinutes: null,
			actualMinutes: null,
			completedAt,
		});
		prismaMock.todo.update.mockResolvedValueOnce({
			id: "todo-1",
			title: "Renamed title",
			status: "COMPLETED",
			completedAt,
		});
		prismaMock.activityLog.create.mockResolvedValueOnce({});

		const app = await buildApp();
		const res = await app.inject({
			method: "PATCH",
			url: "/api/todos/todo-1",
			payload: { title: "Renamed title" },
		});

		expect(res.statusCode).toBe(200);
		expect(prismaMock.todo.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "COMPLETED",
					completedAt,
				}),
			}),
		);
	});

	it("PATCH /api/todos/:id rejects self-parenting with 400", async () => {
		prismaMock.todo.findFirst.mockResolvedValueOnce({
			id: "todo-1",
			userId: "user-1",
		});

		const app = await buildApp();
		const res = await app.inject({
			method: "PATCH",
			url: "/api/todos/todo-1",
			payload: { parentId: "todo-1" },
		});

		expect(res.statusCode).toBe(400);
	});

	it("POST /api/todos/sync applies valid ops and skips stale updates (Last-Write-Wins)", async () => {
		prismaMock.todo.findFirst.mockResolvedValueOnce({
			id: "todo-1",
			userId: "user-1",
			updatedAt: new Date("2026-11-13T12:00:00Z"),
		});
		prismaMock.todo.findUnique.mockResolvedValueOnce(null);
		prismaMock.todo.create.mockResolvedValueOnce({ id: "todo-2" });

		const app = await buildApp();
		const res = await app.inject({
			method: "POST",
			url: "/api/todos/sync",
			payload: {
				operations: [
					{
						clientMutationId: "mut-stale",
						entityType: "todo",
						entityId: "todo-1",
						operation: "UPDATE",
						updatedAt: "2026-11-13T10:00:00.000Z", // older than server
						payload: { title: "Stale offline edit" },
					},
					{
						clientMutationId: "mut-new",
						entityType: "todo",
						entityId: "todo-2",
						operation: "CREATE",
						updatedAt: "2026-11-13T13:00:00.000Z",
						payload: { title: "Fresh offline task" },
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().results).toEqual([
			{ clientMutationId: "mut-stale", status: "skipped_stale" },
			{ clientMutationId: "mut-new", status: "applied" },
		]);
		expect(prismaMock.todo.update).not.toHaveBeenCalled();
		expect(prismaMock.todo.create).toHaveBeenCalledTimes(1);
	});
});
