import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
	project: {
		findMany: vi.fn(),
		findFirst: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		deleteMany: vi.fn(),
	},
	tag: {
		findMany: vi.fn(),
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		deleteMany: vi.fn(),
	},
};

vi.mock("../../db", () => ({
	prisma: prismaMock,
}));

vi.mock("../../lib/utils", () => ({
	requireAuth: vi.fn(async (request: { user?: { id: string } }) => {
		request.user = { id: "user-1" };
	}),
}));

describe("projectRoutes & tagRoutes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("POST /api/projects creates a project and GET /api/projects lists them", async () => {
		const { projectRoutes } = await import("../projects/index");
		const app = Fastify();
		await app.register(projectRoutes, { prefix: "/api/projects" });

		prismaMock.project.create.mockResolvedValueOnce({
			id: "proj-1",
			name: "Work",
			color: "#3b82f6",
		});
		const createRes = await app.inject({
			method: "POST",
			url: "/api/projects",
			payload: { name: "Work", color: "#3b82f6" },
		});
		expect(createRes.statusCode).toBe(201);
		expect(createRes.json().data.name).toBe("Work");

		prismaMock.project.findMany.mockResolvedValueOnce([
			{ id: "proj-1", name: "Work" },
		]);
		const listRes = await app.inject({ method: "GET", url: "/api/projects" });
		expect(listRes.statusCode).toBe(200);
		expect(listRes.json()).toHaveLength(1);
	});

	it("POST /api/tags returns 409 on duplicate tag name for user", async () => {
		const { tagRoutes } = await import("../tags/index");
		const app = Fastify();
		await app.register(tagRoutes, { prefix: "/api/tags" });

		prismaMock.tag.findUnique.mockResolvedValueOnce({
			id: "tag-1",
			name: "Urgent",
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/tags",
			payload: { name: "Urgent" },
		});
		expect(res.statusCode).toBe(409);
	});

	it("DELETE /api/tags/:id returns 404 when tag does not belong to user", async () => {
		const { tagRoutes } = await import("../tags/index");
		const app = Fastify();
		await app.register(tagRoutes, { prefix: "/api/tags" });

		prismaMock.tag.deleteMany.mockResolvedValueOnce({ count: 0 });
		const res = await app.inject({
			method: "DELETE",
			url: "/api/tags/missing-tag",
		});
		expect(res.statusCode).toBe(404);
	});
});
