import Database from "@tauri-apps/plugin-sql";
import type { AxiosInstance } from "axios";

export type SyncEntityType = "todo" | "project" | "tag";
export type SyncOperation = "CREATE" | "UPDATE" | "DELETE" | "REORDER";

export type OfflineOutboxItem = {
	id?: number;
	clientMutationId: string;
	entityType: SyncEntityType;
	entityId: string;
	operation: SyncOperation;
	updatedAt: string;
	payload: Record<string, unknown>;
	retryCount?: number;
};

export type OfflineTodo = {
	id: string;
	title: string;
	description?: string | null;
	status: "IN_PROGRESS" | "LATE" | "COMPLETED";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	isPinned?: boolean;
	dueDate?: string | null;
	reminderAt?: string | null;
	recurrence?: string | null;
	estimatedMinutes?: number | null;
	actualMinutes?: number | null;
	reorderIndex: number;
	projectId?: string | null;
	parentId?: string | null;
	project?: { id?: string; name: string; color?: string | null } | null;
	tags?: Array<{
		tagId: string;
		tag?: { id: string; name: string; color?: string | null };
	}>;
	children?: OfflineTodo[];
	attachments?: Array<{
		id: string;
		name: string;
		url: string;
		fileType?: string | null;
		fileSize?: number | null;
	}>;
	updatedAt?: string;
	deletedAt?: string | null;
};

export type OfflineProject = {
	id: string;
	name: string;
	description?: string | null;
	color?: string | null;
};

export type OfflineTag = {
	id: string;
	name: string;
	color?: string | null;
};

function isTauriEnv(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database | null> {
	if (!isTauriEnv()) return null;
	if (!dbPromise) {
		dbPromise = (async () => {
			const db = await Database.load("sqlite:todo_offline.db");
			await db.execute(`
				CREATE TABLE IF NOT EXISTS todos (
					id TEXT PRIMARY KEY,
					title TEXT NOT NULL,
					description TEXT,
					status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
					priority TEXT NOT NULL DEFAULT 'MEDIUM',
					is_pinned INTEGER NOT NULL DEFAULT 0,
					due_date TEXT,
					reminder_at TEXT,
					recurrence TEXT,
					estimated_minutes INTEGER,
					actual_minutes INTEGER,
					reorder_index REAL NOT NULL DEFAULT 0,
					project_id TEXT,
					parent_id TEXT,
					project_json TEXT,
					tags_json TEXT,
					children_json TEXT,
					attachments_json TEXT,
					updated_at TEXT NOT NULL,
					deleted_at TEXT
				);
			`);
			await db.execute(`
				CREATE TABLE IF NOT EXISTS projects (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					description TEXT,
					color TEXT
				);
			`);
			await db.execute(`
				CREATE TABLE IF NOT EXISTS tags (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					color TEXT
				);
			`);
			await db.execute(`
				CREATE TABLE IF NOT EXISTS sync_outbox (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					client_mutation_id TEXT NOT NULL UNIQUE,
					entity_type TEXT NOT NULL,
					entity_id TEXT NOT NULL,
					operation TEXT NOT NULL,
					updated_at TEXT NOT NULL,
					payload_json TEXT NOT NULL,
					retry_count INTEGER NOT NULL DEFAULT 0,
					last_error TEXT,
					created_at TEXT NOT NULL
				);
			`);
			return db;
		})();
	}
	return dbPromise;
}

type SqlTodoRow = {
	id: string;
	title: string;
	description: string | null;
	status: "IN_PROGRESS" | "LATE" | "COMPLETED";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	is_pinned: number;
	due_date: string | null;
	reminder_at: string | null;
	recurrence: string | null;
	estimated_minutes: number | null;
	actual_minutes: number | null;
	reorder_index: number;
	project_id: string | null;
	parent_id: string | null;
	project_json: string | null;
	tags_json: string | null;
	children_json: string | null;
	attachments_json: string | null;
	updated_at: string;
	deleted_at: string | null;
};

function rowToTodo(row: SqlTodoRow): OfflineTodo {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		status: row.status,
		priority: row.priority,
		isPinned: Boolean(row.is_pinned),
		dueDate: row.due_date,
		reminderAt: row.reminder_at,
		recurrence: row.recurrence,
		estimatedMinutes: row.estimated_minutes,
		actualMinutes: row.actual_minutes,
		reorderIndex: row.reorder_index ?? 0,
		projectId: row.project_id,
		parentId: row.parent_id,
		project: row.project_json ? JSON.parse(row.project_json) : null,
		tags: row.tags_json ? JSON.parse(row.tags_json) : [],
		children: row.children_json ? JSON.parse(row.children_json) : [],
		attachments: row.attachments_json ? JSON.parse(row.attachments_json) : [],
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at,
	};
}

export async function upsertOfflineTodo(todo: OfflineTodo): Promise<void> {
	const db = await getDb();
	if (!db) return;

	await db.execute(
		`INSERT INTO todos (
			id, title, description, status, priority, is_pinned, due_date, reminder_at,
			recurrence, estimated_minutes, actual_minutes, reorder_index, project_id,
			parent_id, project_json, tags_json, children_json, attachments_json, updated_at, deleted_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			description = excluded.description,
			status = excluded.status,
			priority = excluded.priority,
			is_pinned = excluded.is_pinned,
			due_date = excluded.due_date,
			reminder_at = excluded.reminder_at,
			recurrence = excluded.recurrence,
			estimated_minutes = excluded.estimated_minutes,
			actual_minutes = excluded.actual_minutes,
			reorder_index = excluded.reorder_index,
			project_id = excluded.project_id,
			parent_id = excluded.parent_id,
			project_json = excluded.project_json,
			tags_json = excluded.tags_json,
			children_json = excluded.children_json,
			attachments_json = excluded.attachments_json,
			updated_at = excluded.updated_at,
			deleted_at = excluded.deleted_at`,
		[
			todo.id,
			todo.title,
			todo.description ?? null,
			todo.status,
			todo.priority,
			todo.isPinned ? 1 : 0,
			todo.dueDate ?? null,
			todo.reminderAt ?? null,
			todo.recurrence ?? null,
			todo.estimatedMinutes ?? null,
			todo.actualMinutes ?? null,
			todo.reorderIndex ?? 0,
			todo.projectId ?? null,
			todo.parentId ?? null,
			todo.project ? JSON.stringify(todo.project) : null,
			JSON.stringify(todo.tags ?? []),
			JSON.stringify(todo.children ?? []),
			JSON.stringify(todo.attachments ?? []),
			todo.updatedAt ?? new Date().toISOString(),
			todo.deletedAt ?? null,
		],
	);
}

export async function cacheTodosFromServer(
	todos: OfflineTodo[],
): Promise<void> {
	const db = await getDb();
	if (!db) return;

	for (const todo of todos) {
		await upsertOfflineTodo(todo);
	}
}

export async function softDeleteOfflineTodo(id: string): Promise<void> {
	const db = await getDb();
	if (!db) return;
	const now = new Date().toISOString();
	await db.execute(
		`UPDATE todos SET deleted_at = $1, updated_at = $1 WHERE id = $2`,
		[now, id],
	);
}

export async function reorderOfflineTodos(orderedIds: string[]): Promise<void> {
	const db = await getDb();
	if (!db) return;
	const now = new Date().toISOString();
	for (let i = 0; i < orderedIds.length; i++) {
		await db.execute(
			`UPDATE todos SET reorder_index = $1, updated_at = $2 WHERE id = $3`,
			[i, now, orderedIds[i]],
		);
	}
}

export async function getOfflineTodos(params: {
	page?: number;
	limit?: number;
	search?: string;
	status?: string;
	projectId?: string;
	tagId?: string;
}): Promise<{
	data: OfflineTodo[];
	totalCount: number;
	totalPages: number;
}> {
	const db = await getDb();
	if (!db) return { data: [], totalCount: 0, totalPages: 1 };

	const rows = await db.select<SqlTodoRow[]>(
		`SELECT * FROM todos WHERE deleted_at IS NULL AND parent_id IS NULL ORDER BY is_pinned DESC, reorder_index ASC, updated_at DESC`,
	);

	let filtered = rows.map(rowToTodo);

	if (params.search) {
		const q = params.search.toLowerCase();
		filtered = filtered.filter(
			(t) =>
				t.title.toLowerCase().includes(q) ||
				(t.description ?? "").toLowerCase().includes(q),
		);
	}
	if (params.status) {
		filtered = filtered.filter((t) => t.status === params.status);
	}
	if (params.projectId) {
		filtered = filtered.filter((t) => t.projectId === params.projectId);
	}
	if (params.tagId) {
		filtered = filtered.filter((t) =>
			t.tags?.some((tg) => tg.tagId === params.tagId),
		);
	}

	const page = params.page ?? 1;
	const limit = params.limit ?? 10;
	const totalCount = filtered.length;
	const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
	const start = (page - 1) * limit;

	return {
		data: filtered.slice(start, start + limit),
		totalCount,
		totalPages,
	};
}

export async function getOfflineStats(): Promise<{
	total: number;
	completed: number;
	completionRate: number;
	remainingMinutes: number;
}> {
	const db = await getDb();
	if (!db) {
		return { total: 0, completed: 0, completionRate: 0, remainingMinutes: 0 };
	}

	const rows = await db.select<SqlTodoRow[]>(
		`SELECT status, estimated_minutes FROM todos WHERE deleted_at IS NULL`,
	);
	const total = rows.length;
	const completed = rows.filter((r) => r.status === "COMPLETED").length;
	const remainingMinutes = rows
		.filter((r) => r.status !== "COMPLETED")
		.reduce((sum, r) => sum + (r.estimated_minutes ?? 0), 0);

	return {
		total,
		completed,
		completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
		remainingMinutes,
	};
}

export async function cacheProjectsFromServer(
	projects: OfflineProject[],
): Promise<void> {
	const db = await getDb();
	if (!db) return;
	await db.execute(`DELETE FROM projects`);
	for (const p of projects) {
		await db.execute(
			`INSERT INTO projects (id, name, description, color) VALUES ($1, $2, $3, $4)`,
			[p.id, p.name, p.description ?? null, p.color ?? null],
		);
	}
}

export async function upsertOfflineProject(p: OfflineProject): Promise<void> {
	const db = await getDb();
	if (!db) return;
	await db.execute(
		`INSERT INTO projects (id, name, description, color) VALUES ($1, $2, $3, $4)
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, color = excluded.color`,
		[p.id, p.name, p.description ?? null, p.color ?? null],
	);
}

export async function deleteOfflineProject(id: string): Promise<void> {
	const db = await getDb();
	if (!db) return;
	await db.execute(`DELETE FROM projects WHERE id = $1`, [id]);
}

export async function getOfflineProjects(): Promise<OfflineProject[]> {
	const db = await getDb();
	if (!db) return [];
	return db.select<OfflineProject[]>(
		`SELECT * FROM projects ORDER BY name ASC`,
	);
}

export async function cacheTagsFromServer(tags: OfflineTag[]): Promise<void> {
	const db = await getDb();
	if (!db) return;
	await db.execute(`DELETE FROM tags`);
	for (const t of tags) {
		await db.execute(`INSERT INTO tags (id, name, color) VALUES ($1, $2, $3)`, [
			t.id,
			t.name,
			t.color ?? null,
		]);
	}
}

export async function upsertOfflineTag(t: OfflineTag): Promise<void> {
	const db = await getDb();
	if (!db) return;
	await db.execute(
		`INSERT INTO tags (id, name, color) VALUES ($1, $2, $3)
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
		[t.id, t.name, t.color ?? null],
	);
}

export async function deleteOfflineTag(id: string): Promise<void> {
	const db = await getDb();
	if (!db) return;
	await db.execute(`DELETE FROM tags WHERE id = $1`, [id]);
}

export async function getOfflineTags(): Promise<OfflineTag[]> {
	const db = await getDb();
	if (!db) return [];
	return db.select<OfflineTag[]>(`SELECT * FROM tags ORDER BY name ASC`);
}

export async function enqueueMutation(
	op: Omit<OfflineOutboxItem, "id" | "clientMutationId" | "updatedAt"> & {
		updatedAt?: string;
	},
): Promise<void> {
	const db = await getDb();
	if (!db) return;
	const now = op.updatedAt ?? new Date().toISOString();
	await db.execute(
		`INSERT INTO sync_outbox (
			client_mutation_id, entity_type, entity_id, operation, updated_at, payload_json, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		[
			crypto.randomUUID(),
			op.entityType,
			op.entityId,
			op.operation,
			now,
			JSON.stringify(op.payload),
			now,
		],
	);
}

export async function getPendingOutboxCount(): Promise<number> {
	const db = await getDb();
	if (!db) return 0;
	const rows = await db.select<Array<{ cnt: number }>>(
		`SELECT COUNT(*) as cnt FROM sync_outbox`,
	);
	return rows[0]?.cnt ?? 0;
}

type OutboxSqlRow = {
	id: number;
	client_mutation_id: string;
	entity_type: SyncEntityType;
	entity_id: string;
	operation: SyncOperation;
	updated_at: string;
	payload_json: string;
};

export async function flushSyncOutbox(
	axiosClient: AxiosInstance,
): Promise<{ synced: number; remaining: number }> {
	const db = await getDb();
	if (!db) return { synced: 0, remaining: 0 };

	const rows = await db.select<OutboxSqlRow[]>(
		`SELECT id, client_mutation_id, entity_type, entity_id, operation, updated_at, payload_json
		 FROM sync_outbox ORDER BY id ASC LIMIT 200`,
	);

	if (rows.length === 0) {
		return { synced: 0, remaining: 0 };
	}

	const operations = rows.map((r) => ({
		clientMutationId: r.client_mutation_id,
		entityType: r.entity_type,
		entityId: r.entity_id,
		operation: r.operation,
		updatedAt: r.updated_at,
		payload: JSON.parse(r.payload_json) as Record<string, unknown>,
	}));

	const response = await axiosClient.post<{
		success: boolean;
		results: Array<{
			clientMutationId: string;
			status: "applied" | "skipped_stale" | "error";
			error?: string;
		}>;
	}>("/todos/sync", { operations });

	let synced = 0;
	for (const res of response.data.results ?? []) {
		if (res.status === "applied" || res.status === "skipped_stale") {
			await db.execute(
				`DELETE FROM sync_outbox WHERE client_mutation_id = $1`,
				[res.clientMutationId],
			);
			synced++;
		} else {
			await db.execute(
				`UPDATE sync_outbox SET retry_count = retry_count + 1, last_error = $1 WHERE client_mutation_id = $2`,
				[res.error ?? "Unknown error", res.clientMutationId],
			);
		}
	}

	const remaining = await getPendingOutboxCount();
	return { synced, remaining };
}
