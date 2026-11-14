import type { AxiosInstance } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TodoRow = Record<string, unknown>;
type OutboxRow = {
	id: number;
	client_mutation_id: string;
	entity_type: string;
	entity_id: string;
	operation: string;
	updated_at: string;
	payload_json: string;
	retry_count: number;
	last_error: string | null;
	created_at: string;
};

function createMockDatabase() {
	const todos = new Map<string, TodoRow>();
	const projects = new Map<string, Record<string, unknown>>();
	const tags = new Map<string, Record<string, unknown>>();
	const outbox: OutboxRow[] = [];
	let outboxSeq = 1;

	return {
		execute: vi.fn(async (sql: string, params: unknown[] = []) => {
			const normalized = sql.trim().replace(/\s+/g, " ");
			if (normalized.startsWith("CREATE TABLE")) return { rowsAffected: 0 };

			if (normalized.startsWith("INSERT INTO todos")) {
				const row: TodoRow = {
					id: params[0],
					title: params[1],
					description: params[2],
					status: params[3],
					priority: params[4],
					is_pinned: params[5],
					due_date: params[6],
					reminder_at: params[7],
					recurrence: params[8],
					estimated_minutes: params[9],
					actual_minutes: params[10],
					reorder_index: params[11],
					project_id: params[12],
					parent_id: params[13],
					project_json: params[14],
					tags_json: params[15],
					children_json: params[16],
					attachments_json: params[17],
					updated_at: params[18],
					deleted_at: params[19],
				};
				todos.set(String(params[0]), row);
				return { rowsAffected: 1 };
			}

			if (normalized.startsWith("UPDATE todos SET deleted_at")) {
				const row = todos.get(String(params[1]));
				if (row) {
					row.deleted_at = params[0];
					row.updated_at = params[0];
				}
				return { rowsAffected: row ? 1 : 0 };
			}

			if (normalized.startsWith("UPDATE todos SET reorder_index")) {
				const row = todos.get(String(params[2]));
				if (row) {
					row.reorder_index = params[0];
					row.updated_at = params[1];
				}
				return { rowsAffected: row ? 1 : 0 };
			}

			if (normalized.startsWith("DELETE FROM projects WHERE")) {
				projects.delete(String(params[0]));
				return { rowsAffected: 1 };
			}
			if (normalized.startsWith("DELETE FROM projects")) {
				projects.clear();
				return { rowsAffected: 1 };
			}
			if (normalized.startsWith("INSERT INTO projects")) {
				projects.set(String(params[0]), {
					id: params[0],
					name: params[1],
					description: params[2],
					color: params[3],
				});
				return { rowsAffected: 1 };
			}

			if (normalized.startsWith("DELETE FROM tags WHERE")) {
				tags.delete(String(params[0]));
				return { rowsAffected: 1 };
			}
			if (normalized.startsWith("DELETE FROM tags")) {
				tags.clear();
				return { rowsAffected: 1 };
			}
			if (normalized.startsWith("INSERT INTO tags")) {
				tags.set(String(params[0]), {
					id: params[0],
					name: params[1],
					color: params[2],
				});
				return { rowsAffected: 1 };
			}

			if (normalized.startsWith("INSERT INTO sync_outbox")) {
				outbox.push({
					id: outboxSeq++,
					client_mutation_id: String(params[0]),
					entity_type: String(params[1]),
					entity_id: String(params[2]),
					operation: String(params[3]),
					updated_at: String(params[4]),
					payload_json: String(params[5]),
					retry_count: 0,
					last_error: null,
					created_at: String(params[6]),
				});
				return { rowsAffected: 1 };
			}

			if (normalized.startsWith("DELETE FROM sync_outbox WHERE client_mutation_id")) {
				const idx = outbox.findIndex(
					(o) => o.client_mutation_id === String(params[0]),
				);
				if (idx >= 0) outbox.splice(idx, 1);
				return { rowsAffected: idx >= 0 ? 1 : 0 };
			}

			if (normalized.startsWith("UPDATE sync_outbox SET retry_count")) {
				const item = outbox.find(
					(o) => o.client_mutation_id === String(params[1]),
				);
				if (item) {
					item.retry_count += 1;
					item.last_error = String(params[0]);
				}
				return { rowsAffected: item ? 1 : 0 };
			}

			return { rowsAffected: 0 };
		}),
		select: vi.fn(async (sql: string) => {
			const normalized = sql.trim().replace(/\s+/g, " ");
			if (normalized.includes("FROM todos WHERE deleted_at IS NULL AND parent_id IS NULL")) {
				return Array.from(todos.values())
					.filter((r) => r.deleted_at === null && r.parent_id === null)
					.sort(
						(a, b) =>
							Number(b.is_pinned) - Number(a.is_pinned) ||
							Number(a.reorder_index) - Number(b.reorder_index),
					);
			}
			if (normalized.includes("SELECT status, estimated_minutes FROM todos")) {
				return Array.from(todos.values()).filter((r) => r.deleted_at === null);
			}
			if (normalized.includes("FROM projects")) {
				return Array.from(projects.values());
			}
			if (normalized.includes("FROM tags")) {
				return Array.from(tags.values());
			}
			if (normalized.includes("SELECT COUNT(*) as cnt FROM sync_outbox")) {
				return [{ cnt: outbox.length }];
			}
			if (normalized.includes("FROM sync_outbox ORDER BY id ASC")) {
				return [...outbox];
			}
			return [];
		}),
	};
}

let mockDb = createMockDatabase();

vi.mock("@tauri-apps/plugin-sql", () => ({
	default: {
		load: vi.fn(async () => mockDb),
	},
}));

describe("offline-db", () => {
	beforeEach(() => {
		vi.resetModules();
		mockDb = createMockDatabase();
		(globalThis as Record<string, unknown>).window = {
			__TAURI_INTERNALS__: {},
		};
	});

	afterEach(() => {
		delete (globalThis as Record<string, unknown>).window;
	});

	it("stores, filters, paginates, reorders, and soft-deletes todos offline", async () => {
		const {
			upsertOfflineTodo,
			getOfflineTodos,
			reorderOfflineTodos,
			softDeleteOfflineTodo,
		} = await import("#/lib/offline-db");

		await upsertOfflineTodo({
			id: "t1",
			title: "Buy milk",
			status: "IN_PROGRESS",
			priority: "MEDIUM",
			reorderIndex: 0,
			projectId: "p1",
		});
		await upsertOfflineTodo({
			id: "t2",
			title: "Write tests",
			status: "COMPLETED",
			priority: "HIGH",
			reorderIndex: 1,
			projectId: "p2",
			tags: [{ tagId: "tag-1", tag: { id: "tag-1", name: "dev" } }],
		});

		const all = await getOfflineTodos({ page: 1, limit: 10 });
		expect(all.totalCount).toBe(2);
		expect(all.data.map((t) => t.id)).toEqual(["t1", "t2"]);

		const byTag = await getOfflineTodos({ tagId: "tag-1" });
		expect(byTag.data.map((t) => t.id)).toEqual(["t2"]);

		await reorderOfflineTodos(["t2", "t1"]);
		const reordered = await getOfflineTodos({});
		expect(reordered.data.map((t) => t.id)).toEqual(["t2", "t1"]);

		await softDeleteOfflineTodo("t1");
		const afterDelete = await getOfflineTodos({});
		expect(afterDelete.totalCount).toBe(1);
		expect(afterDelete.data[0].id).toBe("t2");
	});

	it("calculates offline stats accurately", async () => {
		const { upsertOfflineTodo, getOfflineStats } = await import(
			"#/lib/offline-db"
		);

		expect(await getOfflineStats()).toEqual({
			total: 0,
			completed: 0,
			completionRate: 0,
			remainingMinutes: 0,
		});

		await upsertOfflineTodo({
			id: "t1",
			title: "Task 1",
			status: "COMPLETED",
			priority: "LOW",
			reorderIndex: 0,
			estimatedMinutes: 30,
		});
		await upsertOfflineTodo({
			id: "t2",
			title: "Task 2",
			status: "IN_PROGRESS",
			priority: "HIGH",
			reorderIndex: 1,
			estimatedMinutes: 45,
		});

		expect(await getOfflineStats()).toEqual({
			total: 2,
			completed: 1,
			completionRate: 50,
			remainingMinutes: 45,
		});
	});

	it("enqueues mutations and flushes applied/stale items while keeping errored items", async () => {
		const { enqueueMutation, getPendingOutboxCount, flushSyncOutbox } =
			await import("#/lib/offline-db");

		await enqueueMutation({
			entityType: "todo",
			entityId: "t1",
			operation: "CREATE",
			payload: { title: "Offline task" },
		});
		await enqueueMutation({
			entityType: "todo",
			entityId: "t2",
			operation: "UPDATE",
			payload: { title: "Failing task" },
		});

		expect(await getPendingOutboxCount()).toBe(2);

		const fakeAxios = {
			post: vi.fn(async (_url: string, body: { operations: Array<{ clientMutationId: string }> }) => ({
				data: {
					success: true,
					results: [
						{
							clientMutationId: body.operations[0].clientMutationId,
							status: "applied",
						},
						{
							clientMutationId: body.operations[1].clientMutationId,
							status: "error",
							error: "Validation failed",
						},
					],
				},
			})),
		} as unknown as AxiosInstance;

		const summary = await flushSyncOutbox(fakeAxios);
		expect(summary).toEqual({ synced: 1, remaining: 1 });
		expect(await getPendingOutboxCount()).toBe(1);
	});
});
