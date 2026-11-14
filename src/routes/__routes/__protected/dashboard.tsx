import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
	queryOptions,
	useIsMutating,
	useMutation,
	useQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isAxiosError } from "axios";
import {
	CalendarDays,
	Check,
	CheckCircle2,
	CheckSquare,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Circle,
	Clock,
	Cloud,
	CloudOff,
	Folder,
	GripVertical,
	Inbox,
	Menu,
	Moon,
	MoreHorizontal,
	Paperclip,
	Pencil,
	Pin,
	Plus,
	RefreshCw,
	Search,
	Sun,
	Tag as TagIcon,
	Trash2,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
	CreateProjectDialog,
	CreateTagDialog,
} from "#/components/todo/ManageProjectsTagsDialog";
import { TodoDetailsDialog } from "#/components/todo/TodoDetailsDialog";
import { TodoInspector } from "#/components/todo/TodoInspector";
import { Calendar } from "#/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	checkAndNotifyDueTodos,
	ensureNotificationPermission,
} from "#/lib/notifications";
import { useTheme } from "#/lib/theme";
import {
	cacheProjectsFromServer,
	cacheTagsFromServer,
	cacheTodosFromServer,
	deleteOfflineProject,
	deleteOfflineTag,
	enqueueMutation,
	flushSyncOutbox,
	getOfflineProjects,
	getOfflineStats,
	getOfflineTags,
	getOfflineTodos,
	getPendingOutboxCount,
	type OfflineTodo,
	reorderOfflineTodos,
	softDeleteOfflineTodo,
	upsertOfflineProject,
	upsertOfflineTag,
	upsertOfflineTodo,
} from "#/lib/offline-db";
import { deleteSecureToken } from "#/lib/secure-token";
import { registerQuickCaptureShortcut } from "#/lib/shortcuts";
import { API_URL, axios } from "#/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

type Project = {
	id: string;
	name: string;
	color?: string;
};

type Tag = {
	id: string;
	name: string;
};

type TodoTag = {
	tagId: string;
	tag?: Tag;
};

type Todo = {
	id: string;
	title: string;
	description?: string | null;
	status: "IN_PROGRESS" | "LATE" | "COMPLETED";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	isPinned?: boolean;
	dueDate?: string | null;
	reorderIndex: number;
	project?: {
		name: string;
	} | null;
	tags?: TodoTag[];
	children?: any[];
	attachments?: any[];
};

const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 5000;

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const todoStatusEnum = z.enum(["IN_PROGRESS", "LATE", "COMPLETED"]);

export const createTodoSchema = z.object({
	title: z
		.string()
		.min(1, "Title cannot be empty")
		.max(
			TITLE_MAX_LENGTH,
			`Title must be under ${TITLE_MAX_LENGTH} characters`,
		),
	description: z
		.string()
		.max(DESCRIPTION_MAX_LENGTH, "Description is too long")
		.optional()
		.nullable(),
	status: todoStatusEnum.optional().default("IN_PROGRESS"),
	priority: priorityEnum.optional().default("MEDIUM"),
	projectId: z.string().optional().nullable(),
	parentId: z.string().optional().nullable(),
	dueDate: z.date().optional().nullable(),
	estimatedMinutes: z.number().int().min(0).optional().nullable(),
});

type FormValues = z.infer<typeof createTodoSchema>;

type CreateTaskDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	error: string | null;
	pending: boolean;
	onSubmit: (values: FormValues) => void;
	onErrorClear: () => void;
	projects?: { id: string; name: string }[];
	defaultProjectId?: string;
	defaultParentId?: string;
};

export const updateTodoStatusSchema = z.object({
	id: z.string().min(1, "Todo ID is required"),
	status: todoStatusEnum,
});

const todoSearchSchema = z.object({
	page: z.number().catch(1),
	limit: z.number().catch(10),
	search: z.string().optional().catch(""),
	tab: z.string().catch("inbox"),
	projectId: z.string().optional(),
	tagId: z.string().optional(),
});

type TodoSearchParams = z.infer<typeof todoSearchSchema>;

export const Route = createFileRoute("/__routes/__protected/dashboard")({
	validateSearch: (search) => todoSearchSchema.parse(search),
	component: Dashboard,
});

const wifiConnectionQueryOptions = () =>
	queryOptions({
		queryKey: ["connection"],
		queryFn: async () => {
			if (typeof navigator !== "undefined" && !navigator.onLine) {
				return false;
			}
			try {
				const healthUrl = `${API_URL}/api/health`;
				return await invoke<boolean>("is_online", { url: healthUrl });
			} catch {
				return typeof navigator !== "undefined" ? navigator.onLine : true;
			}
		},
		refetchInterval: 15_000,
	});

const fetchTodoQueryOptions = ({
	page = 1,
	limit = 10,
	search,
	tab,
	projectId,
	tagId,
}: TodoSearchParams) =>
	queryOptions({
		queryKey: ["todos", page, limit, search, tab, projectId, tagId],
		queryFn: () =>
			fetchTodosApi({ page, limit, search, tab, projectId, tagId }),
		placeholderData: (previousData) => previousData,
		retry: (failureCount, error) => {
			console.error(error);
			return failureCount < 1;
		},
		refetchInterval: 30_000,
	});

async function fetchTodosApi({
	page = 1,
	limit = 10,
	search,
	tab,
	projectId,
	tagId,
}: TodoSearchParams) {
	const status =
		tab === "completed"
			? "COMPLETED"
			: tab === "today"
				? "IN_PROGRESS"
				: undefined;

	try {
		const response = await axios.get("/todos", {
			params: {
				page,
				limit,
				search: search || undefined,
				status,
				projectId: projectId || undefined,
				tagId: tagId || undefined,
			},
		});

		const rawData = response.data || { data: [], totalCount: 0, totalPages: 1 };

		if (rawData.data && Array.isArray(rawData.data)) {
			rawData.data.sort(
				(a: Todo, b: Todo) => (a.reorderIndex ?? 0) - (b.reorderIndex ?? 0),
			);
			await cacheTodosFromServer(rawData.data);
		}

		return rawData;
	} catch (e) {
		console.warn("fetchTodosApi offline fallback:", e);
		return await getOfflineTodos({
			page,
			limit,
			search,
			status,
			projectId,
			tagId,
		});
	}
}

async function fetchProjectsApi() {
	try {
		const response = await axios.get("/projects");
		const data = response.data || [];
		await cacheProjectsFromServer(data);
		return data;
	} catch (e) {
		console.warn("fetchProjectsApi offline fallback:", e);
		return await getOfflineProjects();
	}
}

async function fetchTagsApi() {
	try {
		const response = await axios.get("/tags");
		const data = response.data || [];
		await cacheTagsFromServer(data);
		return data;
	} catch (e) {
		console.warn("fetchTagsApi offline fallback:", e);
		return await getOfflineTags();
	}
}

async function fetchStatsApi() {
	try {
		const response = await axios.get("/todos/stats");
		return (
			response.data || {
				data: { total: 0, completionRate: 0, remainingMinutes: 0 },
			}
		);
	} catch (e) {
		console.warn("fetchStatsApi offline fallback:", e);
		const offline = await getOfflineStats();
		return { data: offline };
	}
}

function Dashboard() {
	const { queryClient } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	const { page, limit, search, tab, projectId, tagId } = Route.useSearch();

	const [mobileOpen, setMobileOpen] = useState(false);

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
	const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [searchTodoValue, setSearchTodoValue] = useState("");
	const [pendingSyncCount, setPendingSyncCount] = useState(0);
	const [isSyncing, setIsSyncing] = useState(false);

	const searchTodoDebounceFn = useDebouncedCallback(
		async (query: string) => {
			updateSearchParams({ search: query });
		},
		{
			wait: 400,
		},
	);

	const { session } = Route.useRouteContext();
	const currentUser = session?.user;

	const updateSearchParams = async (params: Partial<TodoSearchParams>) => {
		navigate({
			search: (prev) => ({
				...prev,
				...params,
			}),
		});
		await queryClient.invalidateQueries({ queryKey: ["todos"] });
	};

	const isReordering = useIsMutating({ mutationKey: ["reorder-todos"] }) > 0;

	const { data: isOnline = true } = useQuery(wifiConnectionQueryOptions());

	const refreshPendingCount = async () => {
		setPendingSyncCount(await getPendingOutboxCount());
	};

	const runSync = async () => {
		if (isSyncing) return;
		setIsSyncing(true);
		try {
			await flushSyncOutbox(axios);
			await refreshPendingCount();
			await queryClient.invalidateQueries({ queryKey: ["todos"] });
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["tags"] });
			await queryClient.invalidateQueries({ queryKey: ["todo-stats"] });
		} catch (e) {
			console.warn("Outbox sync failed (will retry when online):", e);
		} finally {
			setIsSyncing(false);
		}
	};

	const prevOnlineRef = useRef<boolean>(isOnline);
	useEffect(() => {
		void refreshPendingCount();
		if (isOnline && !prevOnlineRef.current) {
			void runSync();
		} else if (isOnline) {
			void getPendingOutboxCount().then((cnt) => {
				if (cnt > 0) void runSync();
			});
		}
		prevOnlineRef.current = isOnline;
	}, [isOnline]);

	useEffect(() => {
		const onOnline = () => {
			void queryClient.invalidateQueries({ queryKey: ["connection"] });
			void runSync();
		};
		window.addEventListener("online", onOnline);
		return () => window.removeEventListener("online", onOnline);
	}, []);

	useEffect(() => {
		let unlistenTray: (() => void) | undefined;
		let unregisterShortcut: (() => void) | undefined;

		void listen("quick-capture", () => {
			setIsCreateOpen(true);
		}).then((fn) => {
			unlistenTray = fn;
		});

		void registerQuickCaptureShortcut(() => {
			setIsCreateOpen(true);
		}).then((fn) => {
			unregisterShortcut = fn;
		});

		return () => {
			unlistenTray?.();
			unregisterShortcut?.();
		};
	}, []);

	const {
		data: todosRes,
		isPending,
		isPlaceholderData,
	} = useQuery({
		...fetchTodoQueryOptions({ page, limit, search, tab, projectId, tagId }),
		refetchInterval: isReordering ? false : 30_000,
	});

	useEffect(() => {
		const list = todosRes?.data;
		if (Array.isArray(list) && list.length > 0) {
			void checkAndNotifyDueTodos(list);
		}
	}, [todosRes?.data]);

	const { data: projectsRes } = useQuery({
		queryKey: ["projects"],
		queryFn: fetchProjectsApi,
		staleTime: 60_000,
	});

	const { data: tagsRes } = useQuery({
		queryKey: ["tags"],
		queryFn: fetchTagsApi,
		staleTime: 60_000,
	});

	const { data: statsRes } = useQuery({
		queryKey: ["todo-stats"],
		queryFn: fetchStatsApi,
		staleTime: 30_000,
	});

	const isNetworkFailure = (err: unknown) =>
		!isOnline || (isAxiosError(err) && !err.response);

	const updateTodoMutation = useMutation({
		mutationFn: async ({
			id,
			...payload
		}: {
			id: string;
			title?: string;
			description?: string | null;
			priority?: Todo["priority"];
			status?: Todo["status"];
			dueDate?: Date | null;
			reminderAt?: Date | null;
			recurrence?: string | null;
			estimatedMinutes?: number | null;
			actualMinutes?: number | null;
			isPinned?: boolean;
			projectId?: string | null;
		}) => {
			const serializedPayload = {
				...payload,
				dueDate:
					payload.dueDate !== undefined
						? payload.dueDate
							? payload.dueDate.toISOString()
							: null
						: undefined,
				reminderAt:
					payload.reminderAt !== undefined
						? payload.reminderAt
							? payload.reminderAt.toISOString()
							: null
						: undefined,
			};

			try {
				if (!isOnline) throw new Error("OFFLINE");
				const response = await axios.patch(`/todos/${id}`, payload);
				return response.data;
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					const existing = (todosRes?.data ?? []).find(
						(t: Todo) => t.id === id,
					);
					if (existing) {
						await upsertOfflineTodo({
							...(existing as unknown as OfflineTodo),
							...serializedPayload,
							updatedAt: new Date().toISOString(),
						});
					}
					await enqueueMutation({
						entityType: "todo",
						entityId: id,
						operation: "UPDATE",
						payload: serializedPayload,
					});
					await refreshPendingCount();
					return { success: true, offline: true };
				}
				throw err;
			}
		},
		onMutate: async ({ id, ...payload }) => {
			await queryClient.cancelQueries({ queryKey: ["todos"] });

			const previousQueries = queryClient.getQueriesData({
				queryKey: ["todos"],
			});

			queryClient.setQueriesData({ queryKey: ["todos"] }, (old: any) => {
				if (!old) return old;

				if (old.data && Array.isArray(old.data)) {
					return {
						...old,
						data: old.data.map((todo: Todo) =>
							todo.id === id ? { ...todo, ...payload } : todo,
						),
					};
				}

				if (Array.isArray(old)) {
					return old.map((todo: Todo) =>
						todo.id === id ? { ...todo, ...payload } : todo,
					);
				}

				return old;
			});

			return { previousQueries };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousQueries) {
				context.previousQueries.forEach(([queryKey, data]) => {
					queryClient.setQueryData(queryKey, data);
				});
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
			queryClient.invalidateQueries({ queryKey: ["todo-stats"] });
		},
	});

	const reorderTodosMutation = useMutation({
		mutationKey: ["reorder-todos"],
		mutationFn: async (orderedIds: string[]) => {
			try {
				if (!isOnline) throw new Error("OFFLINE");
				const response = await axios.post("/todos/reorder", { orderedIds });
				return response.data;
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					await reorderOfflineTodos(orderedIds);
					await enqueueMutation({
						entityType: "todo",
						entityId: orderedIds[0] ?? "batch",
						operation: "REORDER",
						payload: { orderedIds },
					});
					await refreshPendingCount();
					return { success: true, offline: true };
				}
				throw err;
			}
		},
		onMutate: async (orderedIds) => {
			await queryClient.cancelQueries({ queryKey: ["todos"] });
			const previousQueries = queryClient.getQueriesData({
				queryKey: ["todos"],
			});

			queryClient.setQueriesData({ queryKey: ["todos"] }, (old: any) => {
				if (!old) return old;
				const dataList = old.data || old;
				if (!Array.isArray(dataList)) return old;

				const map = new Map(dataList.map((t: Todo) => [t.id, t]));
				const reordered = orderedIds
					.map((id, index) => {
						const todo = map.get(id) as Todo | undefined;
						return todo ? { ...todo, reorderIndex: index } : undefined;
					})
					.filter(Boolean);

				return old.data ? { ...old, data: reordered } : reordered;
			});

			return { previousQueries };
		},
		onError: (_err, _vars, context) => {
			if (context?.previousQueries) {
				context.previousQueries.forEach(([queryKey, data]) => {
					queryClient.setQueryData(queryKey, data);
				});
			}
			queryClient.invalidateQueries({ queryKey: ["todos"] });
		},
	});

	const handleDragEnd = (result: any) => {
		if (!result.destination) return;
		if (result.destination.index === result.source.index) return;

		const items = Array.from(todos);
		const [reorderedItem] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, reorderedItem);

		const orderedIds = items.map((t) => t.id);
		reorderTodosMutation.mutate(orderedIds);
	};

	const createTodoMutation = useMutation({
		mutationFn: async (payload: FormValues) => {
			const validated = createTodoSchema.parse(payload);
			const id = crypto.randomUUID();
			const body = {
				id,
				title: validated.title,
				description: validated.description || undefined,
				priority: validated.priority,
				status: validated.status,
				projectId: validated.projectId ?? undefined,
				parentId: validated.parentId ?? undefined,
				dueDate: validated.dueDate
					? validated.dueDate.toISOString()
					: undefined,
				estimatedMinutes: validated.estimatedMinutes ?? undefined,
			};

			try {
				if (!isOnline) throw new Error("OFFLINE");
				const response = await axios.post("/todos", body);
				return response.data;
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					await upsertOfflineTodo({
						id,
						title: validated.title,
						description: validated.description ?? null,
						status: validated.status,
						priority: validated.priority,
						reorderIndex: 0,
						projectId: validated.projectId ?? null,
						parentId: validated.parentId ?? null,
						dueDate: validated.dueDate ? validated.dueDate.toISOString() : null,
						estimatedMinutes: validated.estimatedMinutes ?? null,
						updatedAt: new Date().toISOString(),
					});
					await enqueueMutation({
						entityType: "todo",
						entityId: id,
						operation: "CREATE",
						payload: body,
					});
					await refreshPendingCount();
					return { success: true, offline: true };
				}
				throw err;
			}
		},

		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
			queryClient.invalidateQueries({ queryKey: ["todo-stats"] });

			setIsCreateOpen(false);
			setFormError(null);
		},

		onError: (error: unknown) => {
			const message =
				error instanceof Error
					? error.message
					: (isAxiosError(error) &&
							(error.response?.data as { error?: string })?.error) ||
						"Couldn't create the task. Please try again.";

			setFormError(message);
		},
	});

	const toggleStatusMutation = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: string }) => {
			const nextStatus = status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
			const validated = updateTodoStatusSchema.parse({
				id,
				status: nextStatus,
			});

			try {
				if (!isOnline) throw new Error("OFFLINE");
				const response = await axios.patch(`/todos/${validated.id}`, {
					status: validated.status,
				});
				return response.data;
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					const existing = (todosRes?.data ?? []).find(
						(t: Todo) => t.id === id,
					);
					if (existing) {
						await upsertOfflineTodo({
							...(existing as unknown as OfflineTodo),
							status: validated.status,
							updatedAt: new Date().toISOString(),
						});
					}
					await enqueueMutation({
						entityType: "todo",
						entityId: validated.id,
						operation: "UPDATE",
						payload: { status: validated.status },
					});
					await refreshPendingCount();
					return { success: true, offline: true };
				}
				throw err;
			}
		},
		onMutate: async ({ id, status }) => {
			await queryClient.cancelQueries({ queryKey: ["todos"] });
			const previousQueries = queryClient.getQueriesData({
				queryKey: ["todos"],
			});
			const nextStatus = status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";

			queryClient.setQueriesData({ queryKey: ["todos"] }, (old: any) => {
				if (!old) return old;

				if (old.data && Array.isArray(old.data)) {
					return {
						...old,
						data: old.data.map((todo: Todo) =>
							todo.id === id ? { ...todo, status: nextStatus } : todo,
						),
					};
				}

				if (Array.isArray(old)) {
					return old.map((todo: Todo) =>
						todo.id === id ? { ...todo, status: nextStatus } : todo,
					);
				}

				return old;
			});

			return { previousQueries };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousQueries) {
				context.previousQueries.forEach(([queryKey, data]) => {
					queryClient.setQueryData(queryKey, data);
				});
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
			queryClient.invalidateQueries({ queryKey: ["todo-stats"] });
		},
	});

	const deleteTodoMutation = useMutation({
		mutationFn: async (id: string) => {
			try {
				if (!isOnline) throw new Error("OFFLINE");
				await axios.delete(`/todos/${id}`);
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					await softDeleteOfflineTodo(id);
					await enqueueMutation({
						entityType: "todo",
						entityId: id,
						operation: "DELETE",
						payload: {},
					});
					await refreshPendingCount();
					return;
				}
				throw err;
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
			queryClient.invalidateQueries({ queryKey: ["todo-stats"] });
		},
	});

	const createProjectMutation = useMutation({
		mutationFn: async (data: { name: string; color: string }) => {
			const id = crypto.randomUUID();
			try {
				if (!isOnline) throw new Error("OFFLINE");
				await axios.post("/projects", { id, ...data });
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					await upsertOfflineProject({ id, ...data });
					await enqueueMutation({
						entityType: "project",
						entityId: id,
						operation: "CREATE",
						payload: data,
					});
					await refreshPendingCount();
					return;
				}
				throw err;
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});

	const deleteProjectMutation = useMutation({
		mutationFn: async (id: string) => {
			try {
				if (!isOnline) throw new Error("OFFLINE");
				await axios.delete(`/projects/${id}`);
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					await deleteOfflineProject(id);
					await enqueueMutation({
						entityType: "project",
						entityId: id,
						operation: "DELETE",
						payload: {},
					});
					await refreshPendingCount();
					return;
				}
				throw err;
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			queryClient.invalidateQueries({ queryKey: ["todos"] });
		},
	});

	const createTagMutation = useMutation({
		mutationFn: async (data: { name: string; color: string }) => {
			const id = crypto.randomUUID();
			try {
				if (!isOnline) throw new Error("OFFLINE");
				await axios.post("/tags", { id, ...data });
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					await upsertOfflineTag({ id, ...data });
					await enqueueMutation({
						entityType: "tag",
						entityId: id,
						operation: "CREATE",
						payload: data,
					});
					await refreshPendingCount();
					return;
				}
				throw err;
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
		},
	});

	const deleteTagMutation = useMutation({
		mutationFn: async (id: string) => {
			try {
				if (!isOnline) throw new Error("OFFLINE");
				await axios.delete(`/tags/${id}`);
			} catch (err) {
				if (
					isNetworkFailure(err) ||
					(err instanceof Error && err.message === "OFFLINE")
				) {
					await deleteOfflineTag(id);
					await enqueueMutation({
						entityType: "tag",
						entityId: id,
						operation: "DELETE",
						payload: {},
					});
					await refreshPendingCount();
					return;
				}
				throw err;
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			queryClient.invalidateQueries({ queryKey: ["todos"] });
		},
	});

	const updateTodoTagsMutation = useMutation({
		mutationFn: async ({
			todoId,
			tagIds,
		}: {
			todoId: string;
			tagIds: string[];
		}) => {
			await axios.put(`/todos/${todoId}/tags`, { tagIds });
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
		},
	});

	const addAttachmentMutation = useMutation({
		mutationFn: async ({
			todoId,
			name,
			url,
		}: {
			todoId: string;
			name: string;
			url: string;
		}) => {
			await axios.post(`/todos/${todoId}/attachments`, { name, url });
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
		},
	});

	const deleteAttachmentMutation = useMutation({
		mutationFn: async ({
			todoId,
			attachmentId,
		}: {
			todoId: string;
			attachmentId: string;
		}) => {
			await axios.delete(`/todos/${todoId}/attachments/${attachmentId}`);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
		},
	});

	const debouncedToggle = useDebouncedCallback(
		(args: { id: string; status: string }) => {
			toggleStatusMutation.mutate(args);
		},
		{ wait: 150 },
	);

	const todos: Todo[] = todosRes?.data ?? [];
	const projects: Project[] = projectsRes ?? [];
	const tags: Tag[] = tagsRes ?? [];

	const totalPages = Math.max(todosRes?.totalPages ?? 1, 1);

	const { theme, toggleTheme } = useTheme();

	useEffect(() => {
		void ensureNotificationPermission();
	}, []);

	const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
	const [quickTitle, setQuickTitle] = useState("");
	const selectedTodo =
		todos.find((t) => t.id === selectedTodoId) ?? todos[0] ?? null;

	const stats = statsRes?.data ?? {
		total: 0,
		completionRate: 0,
		remainingMinutes: 0,
	};

	const activeProject = projects.find((project) => project.id === projectId);

	const pageTitle =
		tab === "completed"
			? "Completed"
			: tab === "today"
				? "Today"
				: activeProject?.name || "Inbox";

	const pageDescription =
		tab === "completed"
			? "Tasks you've finished"
			: tab === "today"
				? "Tasks that need your attention"
				: activeProject
					? `Tasks in ${activeProject.name}`
					: "Everything that needs your attention";

	return (
		<div
			className="flex h-dvh w-full overflow-hidden font-sans"
			style={{
				backgroundColor: "var(--bg)",
				color: "var(--text)",
			}}
		>
			<aside
				className="hidden lg:flex w-[68px] shrink-0 border-r"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
				}}
			>
				<IconRail
					searchParams={{ page, limit, search, tab, projectId, tagId }}
					updateSearchParams={updateSearchParams}
					projects={projects}
					tags={tags}
					currentUser={currentUser}
					onOpenCreateProject={() => setIsCreateProjectOpen(true)}
					onDeleteProject={(id) => deleteProjectMutation.mutate(id)}
					onOpenManageTags={() => setIsManageTagsOpen(true)}
					theme={theme}
					onToggleTheme={toggleTheme}
				/>
			</aside>

			<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
				<SheetContent
					side="left"
					className="w-[min(86vw,300px)] p-0 border-r"
					style={{
						backgroundColor: "var(--bg-secondary)",
						borderColor: "var(--border)",
					}}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Navigation</SheetTitle>
					</SheetHeader>

					<SidebarContent
						searchParams={{ page, limit, search, tab, projectId, tagId }}
						updateSearchParams={(params) => {
							updateSearchParams(params);
							setMobileOpen(false);
						}}
						projects={projects}
						tags={tags}
						currentUser={currentUser}
						onOpenCreateProject={() => setIsCreateProjectOpen(true)}
						onDeleteProject={(id) => deleteProjectMutation.mutate(id)}
						onOpenManageTags={() => setIsManageTagsOpen(true)}
					/>
				</SheetContent>

				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<header
						className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:h-16 sm:px-5 lg:px-6"
						style={{
							backgroundColor: "var(--bg-secondary)",
							borderColor: "var(--border)",
						}}
					>
						<SheetTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 shrink-0 lg:hidden"
							>
								<Menu
									className="h-5 w-5"
									style={{ color: "var(--text-secondary)" }}
								/>
							</Button>
						</SheetTrigger>

						<div className="min-w-0 flex-1">
							<div className="relative w-full max-w-xl">
								<Search
									className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
									style={{ color: "var(--text-secondary)" }}
								/>

								<Input
									value={searchTodoValue}
									onChange={(event) => {
										setSearchTodoValue(event.target.value);
										searchTodoDebounceFn(event.target.value);
									}}
									placeholder="Search tasks..."
									className="h-9 w-full border-transparent pl-9 pr-9 text-sm shadow-none focus-visible:ring-1"
									style={{
										backgroundColor: "var(--bg)",
										color: "var(--text)",
										borderColor: "var(--border)",
									}}
								/>

								{searchTodoValue && (
									<Button
										variant="ghost"
										size="icon"
										className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
										onClick={() => {
											setSearchTodoValue("");
											searchTodoDebounceFn("");
										}}
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								)}
							</div>
						</div>

						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								if (isOnline && pendingSyncCount > 0) void runSync();
							}}
							title={
								isOnline
									? pendingSyncCount > 0
										? "Click to sync pending changes"
										: "Connected & synced"
									: "Offline mode — changes saved locally"
							}
							className="h-8 shrink-0 gap-1.5 px-2.5 text-[11px]"
							style={{ color: isOnline ? "#10b981" : "#f59e0b" }}
						>
							{isSyncing ? (
								<RefreshCw className="h-3.5 w-3.5 animate-spin" />
							) : isOnline ? (
								<Cloud className="h-3.5 w-3.5" />
							) : (
								<CloudOff className="h-3.5 w-3.5" />
							)}
							<span className="hidden md:inline">
								{isSyncing
									? "Syncing..."
									: isOnline
										? pendingSyncCount > 0
											? `Sync (${pendingSyncCount})`
											: "Synced"
										: pendingSyncCount > 0
											? `Offline (${pendingSyncCount})`
											: "Offline"}
							</span>
						</Button>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={toggleTheme}
							title={
								theme === "dark"
									? "Switch to light mode"
									: "Switch to dark mode"
							}
							className="h-9 w-9 shrink-0 rounded-md lg:hidden"
						>
							{theme === "dark" ? (
								<Sun className="h-4 w-4 text-(--text-secondary)" />
							) : (
								<Moon className="h-4 w-4 text-(--text-secondary)" />
							)}
						</Button>

						<Button
							size="sm"
							className="h-9 shrink-0 gap-1.5 text-white"
							style={{ backgroundColor: "var(--link)" }}
							onClick={() => setIsCreateOpen(true)}
						>
							<Plus className="h-4 w-4" />
							<span className="hidden sm:inline">New task</span>
						</Button>
					</header>

					<main className="min-h-0 flex-1 overflow-y-auto">
						<div className="mx-auto w-full max-w-[920px] p-4 sm:p-6 lg:p-8">
							<div className="mb-6 flex items-center justify-between gap-4">
								<div className="min-w-0">
									<div className="flex items-center gap-2.5">
										<h1
											className="font-editorial truncate text-2xl font-semibold tracking-tight sm:text-3xl"
											style={{ color: "var(--text)" }}
										>
											{pageTitle}
										</h1>
									</div>

									<p
										className="mt-1 truncate text-xs sm:text-sm"
										style={{ color: "var(--text-secondary)" }}
									>
										{pageDescription}
									</p>
								</div>

								{/* Circular Progress Ring + Inline Summary */}
								<div className="flex shrink-0 items-center gap-3 rounded-2xl border border-(--border) bg-(--bg-secondary) px-3.5 py-2 shadow-2xs">
									<div className="relative flex h-10 w-10 items-center justify-center">
										<svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
											<circle
												cx="18"
												cy="18"
												r="15"
												fill="none"
												stroke="#EFECE6"
												strokeWidth="3.5"
											/>
											<circle
												cx="18"
												cy="18"
												r="15"
												fill="none"
												stroke="#52B788"
												strokeWidth="3.5"
												strokeLinecap="round"
												strokeDasharray={`${Math.round((stats.completionRate / 100) * 94.25)} 94.25`}
											/>
										</svg>
										<span className="absolute text-[10px] font-bold text-[#1B4332]">
											{stats.completionRate}%
										</span>
									</div>
									<div className="hidden sm:block text-left">
										<p className="text-xs font-semibold text-(--text)">
											{todosRes?.totalCount ?? 0} tasks
										</p>
										<p className="text-[11px] text-(--text-secondary)">
											{Math.floor(stats.remainingMinutes / 60)}h{" "}
											{stats.remainingMinutes % 60}m left
										</p>
									</div>
								</div>
							</div>

							{/* Inline Quick-Add Bar */}
							<form
								onSubmit={(e) => {
									e.preventDefault();
									const trimmed = quickTitle.trim();
									if (!trimmed) return;
									createTodoMutation.mutate({
										title: trimmed,
										status: tab === "completed" ? "COMPLETED" : "IN_PROGRESS",
										priority: "MEDIUM",
										projectId: projectId || null,
									});
									setQuickTitle("");
								}}
								className="mb-4 flex items-center gap-2 rounded-2xl border border-(--border) bg-(--bg-secondary) px-3.5 py-2 shadow-2xs focus-within:border-[#1B4332]/50"
							>
								<Plus className="h-4 w-4 shrink-0 text-[#1B4332]" />
								<Input
									value={quickTitle}
									onChange={(e) => setQuickTitle(e.target.value)}
									placeholder="Quick add task... Press Enter"
									className="h-8 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
								/>
								{quickTitle.trim() && (
									<Button
										type="submit"
										size="sm"
										className="h-7 rounded-lg bg-[#1B4332] px-3 text-[11px] font-semibold text-white hover:bg-[#2D6A4F]"
									>
										Add
									</Button>
								)}
							</form>

							<Card
								className="overflow-hidden gap-0 rounded-md shadow-none"
								style={{
									backgroundColor: "var(--bg-secondary)",
									borderColor: "var(--border)",
								}}
							>
								<CardHeader
									className="flex flex-row items-center justify-between border-b px-4 py-3 sm:px-5"
									style={{ borderColor: "var(--border)" }}
								>
									<div className="flex min-w-0 items-center gap-2">
										<CardTitle
											className="text-sm font-semibold"
											style={{ color: "var(--text)" }}
										>
											Your tasks
										</CardTitle>
										<Badge
											variant="secondary"
											className="rounded-full px-2 py-0 text-[10px]"
										>
											{todosRes?.totalCount ?? 0}
										</Badge>
									</div>

									<div
										className="text-[11px]"
										style={{ color: "var(--text-secondary)" }}
									>
										{isPlaceholderData ? "Loading..." : `${todos.length} shown`}
									</div>
								</CardHeader>

								<CardContent className="p-0 w-full">
									{isPending && !isPlaceholderData && todos.length === 0 ? (
										<Label className="w-full p-5 flex justify-center text-(--text)">
											Loading...
										</Label>
									) : (
										<DragDropContext onDragEnd={handleDragEnd}>
											<Droppable droppableId="todo-list">
												{(provided) => (
													<div
														{...provided.droppableProps}
														ref={provided.innerRef}
													>
														{todos.length <= 0 && (
															<EmptyState
																search={Boolean(search)}
																onCreate={() => setIsCreateOpen(true)}
															/>
														)}

														{todos.map((todo, index) => (
															<Draggable
																key={todo.id}
																draggableId={todo.id}
																index={index}
															>
																{(provided, snapshot) => (
																	<div
																		ref={provided.innerRef}
																		{...provided.draggableProps}
																		style={{
																			...provided.draggableProps.style,
																			backgroundColor: snapshot.isDragging
																				? "var(--bg)"
																				: "inherit",
																		}}
																	>
																		<TodoRow
																			todo={todo}
																			projects={projects}
																			allTags={tags}
																			isOnline={isOnline}
																			isSelected={selectedTodo?.id === todo.id}
																			onSelect={() => setSelectedTodoId(todo.id)}
																			dragHandleProps={provided.dragHandleProps}
																			onToggle={() =>
																				debouncedToggle({
																					id: todo.id,
																					status: todo.status,
																				})
																			}
																			onUpdateTodo={(payload) =>
																				updateTodoMutation.mutate({
																					id: todo.id,
																					...payload,
																				})
																			}
																			onDeleteTodo={(id) =>
																				deleteTodoMutation.mutate(id)
																			}
																			onUpdateTags={(todoId, tagIds) =>
																				updateTodoTagsMutation.mutate({
																					todoId,
																					tagIds,
																				})
																			}
																			onCreateSubtask={(parentId, title) =>
																				createTodoMutation.mutate({
																					title,
																					parentId,
																					status: "IN_PROGRESS",
																					priority: "MEDIUM",
																				})
																			}
																			onToggleSubtask={(sub) =>
																				toggleStatusMutation.mutate({
																					id: sub.id,
																					status: sub.status,
																				})
																			}
																			onAddAttachment={(todoId, name, url) =>
																				addAttachmentMutation.mutate({
																					todoId,
																					name,
																					url,
																				})
																			}
																			onDeleteAttachment={(
																				todoId,
																				attachmentId,
																			) =>
																				deleteAttachmentMutation.mutate({
																					todoId,
																					attachmentId,
																				})
																			}
																		/>
																	</div>
																)}
															</Draggable>
														))}
														{provided.placeholder}
													</div>
												)}
											</Droppable>
										</DragDropContext>
									)}
								</CardContent>

								<div
									className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
									style={{ borderColor: "var(--border)" }}
								>
									<p
										className="text-[11px]"
										style={{ color: "var(--text-secondary)" }}
									>
										Page {page} of {totalPages}
									</p>

									<div className="flex items-center gap-1.5">
										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8"
											disabled={page <= 1 || isPlaceholderData}
											onClick={() =>
												updateSearchParams({
													page: page - 1,
												})
											}
										>
											<ChevronLeft className="h-4 w-4" />
										</Button>

										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8"
											disabled={page >= totalPages || isPlaceholderData}
											onClick={() =>
												updateSearchParams({
													page: page + 1,
												})
											}
										>
											<ChevronRight className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</Card>
						</div>
						<div className="w-full flex justify-center py-4">
							<span
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Built using{" "}
								<span className="text-(--link)">Tanstack Start</span> &{" "}
								<span className="text-(--link)">Tauri</span>
								{". By "}
								<span className="text-(--link)">Charlee</span>.
							</span>
						</div>
					</main>
				</div>
			</Sheet>

			{/* Column 3: Persistent Right Live Task Inspector */}
			<aside
				className="hidden xl:flex w-[390px] 2xl:w-[430px] shrink-0 flex-col border-l"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
				}}
			>
				<TodoInspector
					todo={selectedTodo as OfflineTodo | null}
					allTags={tags}
					isOnline={isOnline}
					onSave={(id, payload) =>
						updateTodoMutation.mutate({
							id,
							...payload,
						})
					}
					onDelete={(id) => {
						deleteTodoMutation.mutate(id);
						if (selectedTodoId === id) {
							setSelectedTodoId(null);
						}
					}}
					onUpdateTags={(todoId, tagIds) =>
						updateTodoTagsMutation.mutate({
							todoId,
							tagIds,
						})
					}
					onCreateSubtask={(parentId, title) =>
						createTodoMutation.mutate({
							title,
							parentId,
							status: "IN_PROGRESS",
							priority: "MEDIUM",
						})
					}
					onToggleSubtask={(sub) =>
						toggleStatusMutation.mutate({
							id: sub.id,
							status: sub.status,
						})
					}
					onAddAttachment={(todoId, name, url) =>
						addAttachmentMutation.mutate({
							todoId,
							name,
							url,
						})
					}
					onDeleteAttachment={(todoId, attachmentId) =>
						deleteAttachmentMutation.mutate({
							todoId,
							attachmentId,
						})
					}
				/>
			</aside>

			<CreateTaskDialog
				open={isCreateOpen}
				error={formError}
				pending={createTodoMutation.isPending}
				onOpenChange={setIsCreateOpen}
				onSubmit={(values) => createTodoMutation.mutate(values)}
				onErrorClear={() => setFormError(null)}
				projects={projects}
				defaultProjectId={projectId}
			/>

			<CreateProjectDialog
				open={isCreateProjectOpen}
				onOpenChange={setIsCreateProjectOpen}
				onCreate={(data) => createProjectMutation.mutate(data)}
			/>

			<CreateTagDialog
				open={isManageTagsOpen}
				onOpenChange={setIsManageTagsOpen}
				tags={tags}
				onCreate={(data) => createTagMutation.mutate(data)}
				onDelete={(id) => deleteTagMutation.mutate(id)}
			/>
		</div>
	);
}

function IconRail({
	searchParams,
	updateSearchParams,
	projects,
	tags,
	currentUser,
	onOpenCreateProject,
	onDeleteProject,
	onOpenManageTags,
	theme,
	onToggleTheme,
}: {
	searchParams: TodoSearchParams;
	updateSearchParams: (params: Partial<TodoSearchParams>) => void;
	projects: Project[];
	tags: Tag[];
	currentUser?: {
		name?: string;
		email?: string;
	} | null;
	onOpenCreateProject: () => void;
	onDeleteProject: (id: string) => void;
	onOpenManageTags: () => void;
	theme: "light" | "dark";
	onToggleTheme: () => void;
}) {
	const railBtnClass = (active?: boolean) =>
		`flex h-10 w-10 items-center justify-center rounded-md transition-all ${
			active
				? "bg-[#1B4332] text-white shadow-sm"
				: "text-(--text-secondary) hover:bg-(--bg-subtle) hover:text-(--text)"
		}`;

	return (
		<div className="flex h-full w-full flex-col items-center justify-between py-4">
			<div className="flex flex-col items-center gap-3">
				{/* Brand Monogram */}
				<div
					className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#1B4332] font-editorial text-base font-bold text-white shadow-sm"
					title="Cakwei's TODO"
				>
					C
				</div>

				{/* Primary Views */}
				<button
					type="button"
					title="Inbox"
					onClick={() =>
						updateSearchParams({
							tab: "inbox",
							projectId: undefined,
							tagId: undefined,
							page: 1,
						})
					}
					className={railBtnClass(
						(searchParams.tab === "inbox" || !searchParams.tab) &&
							!searchParams.projectId &&
							!searchParams.tagId,
					)}
				>
					<Inbox className="h-4.5 w-4.5" />
				</button>

				<button
					type="button"
					title="Today"
					onClick={() =>
						updateSearchParams({
							tab: "today",
							projectId: undefined,
							tagId: undefined,
							page: 1,
						})
					}
					className={railBtnClass(
						searchParams.tab === "today" &&
							!searchParams.projectId &&
							!searchParams.tagId,
					)}
				>
					<CalendarDays className="h-4.5 w-4.5" />
				</button>

				<button
					type="button"
					title="Completed"
					onClick={() =>
						updateSearchParams({
							tab: "completed",
							projectId: undefined,
							tagId: undefined,
							page: 1,
						})
					}
					className={railBtnClass(
						searchParams.tab === "completed" &&
							!searchParams.projectId &&
							!searchParams.tagId,
					)}
				>
					<CheckCircle2 className="h-4.5 w-4.5" />
				</button>

				<div className="my-1 h-px w-6 bg-(--border)" />

				{/* Projects Popover */}
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							title="Projects"
							className={railBtnClass(Boolean(searchParams.projectId))}
						>
							<Folder className="h-4.5 w-4.5" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						side="right"
						align="start"
						className="w-60 rounded-2xl border-(--border) bg-(--bg-secondary) p-3 shadow-lg"
					>
						<div className="mb-2 flex items-center justify-between">
							<span className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
								Projects
							</span>
							<button
								type="button"
								onClick={onOpenCreateProject}
								className="rounded-lg p-1 text-[#1B4332] hover:bg-(--bg-subtle)"
								title="New project"
							>
								<Plus className="h-3.5 w-3.5" />
							</button>
						</div>
						{projects.length === 0 ? (
							<p className="py-2 text-xs text-(--text-secondary)">
								No projects yet
							</p>
						) : (
							<div className="space-y-1 max-h-60 overflow-y-auto">
								{projects.map((project) => {
									const active = searchParams.projectId === project.id;
									return (
										<div
											key={project.id}
											className="group flex items-center justify-between rounded-md hover:bg-(--bg-subtle)"
										>
											<button
												type="button"
												onClick={() =>
													updateSearchParams({
														projectId: active ? undefined : project.id,
														tagId: undefined,
														page: 1,
													})
												}
												className={`flex flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
													active
														? "font-semibold text-[#1B4332]"
														: "text-(--text)"
												}`}
											>
												<span
													className="h-2 w-2 rounded-full"
													style={{
														backgroundColor: project.color || "#52B788",
													}}
												/>
												<span className="truncate">{project.name}</span>
											</button>
											<button
												type="button"
												onClick={() => onDeleteProject(project.id)}
												className="hidden group-hover:flex p-1.5 text-[#D97757]"
												title="Delete project"
											>
												<Trash2 className="h-3 w-3" />
											</button>
										</div>
									);
								})}
							</div>
						)}
					</PopoverContent>
				</Popover>

				{/* Tags Popover */}
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							title="Tags"
							className={railBtnClass(Boolean(searchParams.tagId))}
						>
							<TagIcon className="h-4.5 w-4.5" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						side="right"
						align="start"
						className="w-60 rounded-2xl border-(--border) bg-(--bg-secondary) p-3 shadow-lg"
					>
						<div className="mb-2 flex items-center justify-between">
							<span className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
								Tags
							</span>
							<button
								type="button"
								onClick={onOpenManageTags}
								className="rounded-lg p-1 text-[#1B4332] hover:bg-(--bg-subtle)"
								title="Manage tags"
							>
								<Plus className="h-3.5 w-3.5" />
							</button>
						</div>
						{tags.length === 0 ? (
							<p className="py-2 text-xs text-(--text-secondary)">
								No tags yet
							</p>
						) : (
							<div className="flex flex-wrap gap-1.5">
								{tags.map((tag) => {
									const active = searchParams.tagId === tag.id;
									return (
										<button
											type="button"
											key={tag.id}
											onClick={() =>
												updateSearchParams({
													tagId: active ? undefined : tag.id,
													projectId: undefined,
													page: 1,
												})
											}
											className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
												active
													? "bg-[#1B4332] text-white border-[#1B4332]"
													: "bg-(--bg) border-(--border) text-(--text-secondary) hover:text-(--text)"
											}`}
										>
											#{tag.name}
										</button>
									);
								})}
							</div>
						)}
					</PopoverContent>
				</Popover>
			</div>

			{/* Bottom Theme Toggle + User Avatar & Logout */}
			<div className="flex flex-col items-center gap-3">
				<button
					type="button"
					onClick={onToggleTheme}
					title={
						theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
					}
					className={railBtnClass(false)}
				>
					{theme === "dark" ? (
						<Sun className="h-4.5 w-4.5" />
					) : (
						<Moon className="h-4.5 w-4.5" />
					)}
				</button>

				<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						title={currentUser?.name || "Account"}
						className="flex h-9 w-9 items-center justify-center rounded-full border border-(--border) bg-(--bg) text-xs font-semibold text-[#1B4332] hover:bg-(--bg-subtle)"
					>
						{currentUser?.name?.slice(0, 2).toUpperCase() || "US"}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="right"
					align="end"
					className="border-(--border) bg-(--bg-secondary) text-(--text)"
				>
					<div className="px-2.5 py-1.5 border-b border-(--border)">
						<p className="text-xs font-semibold">
							{currentUser?.name || "User Account"}
						</p>
						<p className="text-[10px] text-(--text-secondary)">
							{currentUser?.email || ""}
						</p>
					</div>
					<DropdownMenuItem
						className="text-[#D97757] focus:text-[#D97757]"
						onClick={() =>
							authClient.signOut({
								fetchOptions: {
									onSuccess: async () => {
										await deleteSecureToken();
										window.location.href = "/login";
									},
								},
							})
						}
					>
						Log out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			</div>
		</div>
	);
}

function SidebarContent({
	searchParams,
	updateSearchParams,
	projects,
	tags,
	currentUser,
	onOpenCreateProject,
	onDeleteProject,
	onOpenManageTags,
}: {
	searchParams: TodoSearchParams;
	updateSearchParams: (params: Partial<TodoSearchParams>) => void;
	projects: Project[];
	tags: Tag[];
	currentUser?: {
		name?: string;
		email?: string;
	} | null;
	onOpenCreateProject: () => void;
	onDeleteProject: (id: string) => void;
	onOpenManageTags: () => void;
}) {
	const { queryClient } = Route.useRouteContext();
	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto p-4">
				<div className="mb-7 flex items-center gap-3 px-1">
					<div
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
						style={{ backgroundColor: "var(--link)" }}
					>
						T
					</div>

					<div className="min-w-0">
						<p
							className="truncate text-sm font-semibold"
							style={{ color: "var(--text)" }}
						>
							Cakwei's TODO
						</p>
						<p
							className="truncate text-[11px]"
							style={{ color: "var(--text-secondary)" }}
						>
							Personal workspace
						</p>
					</div>
				</div>

				<div className="space-y-1">
					<SidebarItem
						icon={<Inbox className="h-4 w-4" />}
						label="Inbox"
						active={
							searchParams.tab === "inbox" &&
							!searchParams.projectId &&
							!searchParams.tagId
						}
						onClick={() =>
							updateSearchParams({
								tab: "inbox",
								projectId: undefined,
								tagId: undefined,
								page: 1,
							})
						}
					/>

					<SidebarItem
						icon={<CalendarDays className="h-4 w-4" />}
						iconClassName="text-emerald-500"
						label="Today"
						active={searchParams.tab === "today"}
						onClick={() => {
							updateSearchParams({
								tab: "today",
								projectId: undefined,
								tagId: undefined,
								page: 1,
							});
						}}
					/>

					<SidebarItem
						icon={<CheckSquare className="h-4 w-4" />}
						iconClassName="text-blue-500"
						label="Completed"
						active={searchParams.tab === "completed"}
						onClick={async () => {
							updateSearchParams({
								tab: "completed",
								projectId: undefined,
								tagId: undefined,
								page: 1,
							});
							await queryClient.invalidateQueries({ queryKey: ["todos"] });
						}}
					/>
				</div>

				<SidebarSection
					title="Projects"
					icon={<Folder className="h-3.5 w-3.5" />}
					action={
						<button
							type="button"
							onClick={onOpenCreateProject}
							title="Add project"
							className="rounded p-0.5 hover:bg-(--bg)"
						>
							<Plus className="h-3.5 w-3.5" />
						</button>
					}
				>
					{projects.length === 0 ? (
						<p
							className="px-2 text-[11px]"
							style={{ color: "var(--text-secondary)" }}
						>
							No projects yet
						</p>
					) : (
						<div className="space-y-0.5 rounded-sm">
							{projects.map((project) => {
								const active = searchParams.projectId === project.id;
								return (
									<div
										key={project.id}
										className="group flex items-center gap-1 rounded-sm"
										style={{
											backgroundColor: active ? "var(--link)" : "",
										}}
									>
										<button
											type="button"
											onClick={() =>
												updateSearchParams({
													projectId: project.id,
													tagId: undefined,
													tab: "inbox",
													page: 1,
												})
											}
											className="flex flex-1 min-w-0 items-center gap-2.5 p-2.5 h-[36px] text-left text-xs transition-colors"
											style={{ color: "var(--text)" }}
										>
											<ProjectDot color={project.color} />
											<span className="truncate">{project.name}</span>
										</button>
										<button
											type="button"
											onClick={() => onDeleteProject(project.id)}
											title="Delete project"
											className="hidden group-hover:flex p-1.5 mr-1 text-red-400 hover:text-red-500"
										>
											<Trash2 className="h-3 w-3" />
										</button>
									</div>
								);
							})}
						</div>
					)}
				</SidebarSection>

				<SidebarSection
					title="Tags"
					icon={<TagIcon className="h-3.5 w-3.5" />}
					action={
						<button
							type="button"
							onClick={onOpenManageTags}
							title="Manage tags"
							className="rounded p-0.5 hover:bg-(--bg)"
						>
							<Plus className="h-3.5 w-3.5" />
						</button>
					}
				>
					{tags.length === 0 ? (
						<p
							className="px-2 text-[11px]"
							style={{ color: "var(--text-secondary)" }}
						>
							No tags yet
						</p>
					) : (
						<div className="flex flex-wrap gap-1.5 px-1">
							{tags.map((tag) => {
								const active = searchParams.tagId === tag.id;
								return (
									<Badge
										key={tag.id}
										onClick={() =>
											updateSearchParams({
												tagId: active ? undefined : tag.id,
												projectId: undefined,
												page: 1,
											})
										}
										className={`cursor-pointer rounded-full px-2 text-[10px] font-normal ${
											active
												? "bg-(--link) text-white"
												: "bg-(--bg-secondary) outline outline-(--link) text-(--link)"
										}`}
									>
										#{tag.name}
									</Badge>
								);
							})}
						</div>
					)}
				</SidebarSection>
			</div>

			<div
				className="shrink-0 border-t p-3"
				style={{ borderColor: "var(--border)" }}
			>
				<div className="flex min-w-0 items-center gap-2.5">
					<div
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
						style={{
							backgroundColor: "var(--bg)",
							color: "var(--text)",
						}}
					>
						{currentUser?.name?.slice(0, 2).toUpperCase() || "US"}
					</div>

					<div className="min-w-0 flex-1">
						<p
							className="truncate text-xs font-medium"
							style={{ color: "var(--text)" }}
						>
							{currentUser?.name || "User Account"}
						</p>
						<p
							className="truncate text-[10px]"
							style={{ color: "var(--text-secondary)" }}
						>
							{currentUser?.email || "user@dev.io"}
						</p>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							<DropdownMenuItem
								className="text-red-400"
								onClick={() =>
									authClient.signOut({
										fetchOptions: {
											onSuccess: async () => {
												await deleteSecureToken();
												window.location.href = "/login";
											},
										},
									})
								}
							>
								Log out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}

function SidebarSection({
	title,
	icon,
	action,
	children,
}: {
	title: string;
	icon: ReactNode;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="mt-7">
			<div
				className="mb-2 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider"
				style={{ color: "var(--text-secondary)" }}
			>
				<div className="flex items-center gap-1.5">
					{icon}
					<span>{title}</span>
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}

function SidebarItem({
	icon,
	iconClassName,
	label,
	active,
	onClick,
}: {
	icon: ReactNode;
	iconClassName?: string;
	label: string;
	active?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			onClick={onClick}
			className="w-full bg-(--bg-secondary) hover:bg-(--bg) gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors flex-none justify-start"
			style={{
				backgroundColor: active ? "var(--link)" : "",
				color: active ? "#ffffff" : "var(--text)",
			}}
		>
			<span className={iconClassName}>{icon}</span>
			<span>{label}</span>
		</Button>
	);
}

function TodoRow({
	todo,
	projects = [],
	allTags = [],
	isOnline = true,
	isSelected = false,
	onSelect,
	onToggle,
	onUpdateTodo,
	onDeleteTodo,
	onUpdateTags,
	onCreateSubtask,
	onToggleSubtask,
	onAddAttachment,
	onDeleteAttachment,
	dragHandleProps,
}: {
	todo: any;
	projects?: { id: string; name: string }[];
	allTags?: Tag[];
	isOnline?: boolean;
	isSelected?: boolean;
	onSelect?: () => void;
	onToggle: () => void;
	onUpdateTodo: (payload: {
		title?: string;
		description?: string | null;
		priority?: any;
		dueDate?: Date | null;
		reminderAt?: Date | null;
		recurrence?: string | null;
		estimatedMinutes?: number | null;
		actualMinutes?: number | null;
		isPinned?: boolean;
		status?: any;
		projectId?: string | null;
	}) => void;
	onDeleteTodo: (id: string) => void;
	onUpdateTags: (todoId: string, tagIds: string[]) => void;
	onCreateSubtask: (parentId: string, title: string) => void;
	onToggleSubtask: (subtask: OfflineTodo) => void;
	onAddAttachment: (todoId: string, name: string, url: string) => void;
	onDeleteAttachment: (todoId: string, attachmentId: string) => void;
	dragHandleProps?: any;
}) {
	const completed = todo.status === "COMPLETED";

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDesc, setIsEditingDesc] = useState(false);
	const [isEditingDueDate, setIsEditingDueDate] = useState(false);

	// Initial date & time states
	const initialDate = todo.dueDate ? new Date(todo.dueDate) : null;
	const [inlineDate, setInlineDate] = useState<Date | null>(initialDate);
	const [inlineTime, setInlineTime] = useState<string>(
		initialDate ? initialDate.toTimeString().slice(0, 5) : "",
	);

	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

	const titleRef = useRef<HTMLInputElement>(null);
	const descRef = useRef<HTMLTextAreaElement>(null);

	const handleSaveTitle = () => {
		const newTitle = titleRef.current?.value.trim();
		if (newTitle && newTitle !== todo.title) {
			onUpdateTodo({ title: newTitle });
		}
		setIsEditingTitle(false);
	};

	const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSaveTitle();
		} else if (e.key === "Escape") {
			setIsEditingTitle(false);
		}
	};

	const handleSaveDesc = () => {
		const newDesc = descRef.current?.value.trim() ?? "";
		if (newDesc !== (todo.description ?? "")) {
			onUpdateTodo({ description: newDesc || null });
		}
		setIsEditingDesc(false);
	};

	const handleDescKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSaveDesc();
		} else if (e.key === "Escape") {
			setIsEditingDesc(false);
		}
	};

	const handleInlineSaveDueDate = (
		dateToSave: Date | null,
		timeToSave: string,
	) => {
		if (!dateToSave) {
			onUpdateTodo({ dueDate: null });
			setIsEditingDueDate(false);
			return;
		}

		const finalDate = new Date(dateToSave);
		if (timeToSave) {
			const [hours, minutes] = timeToSave.split(":");
			finalDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
		} else {
			finalDate.setHours(0, 0, 0, 0);
		}

		onUpdateTodo({ dueDate: finalDate });
		setIsEditingDueDate(false);
	};

	return (
		<>
			<div
				onClick={onSelect}
				className={`group relative cursor-pointer border-b py-3.5 px-3 transition-colors sm:px-5 last:border-b-0 flex items-start justify-between gap-3 ${
					completed ? "opacity-60" : ""
				} ${
					isSelected
						? "bg-[#EFECE6]/70 border-l-2 border-l-[#1B4332]"
						: "hover:bg-(--bg)/60"
				}`}
				style={{ borderBottomColor: "var(--border)" }}
			>
				<div className="flex min-w-0 items-start gap-2.5 sm:gap-3 flex-1">
					<div
						className="hidden pt-1 sm:block cursor-grab active:cursor-grabbing"
						{...dragHandleProps}
					>
						<GripVertical
							className="h-4 w-4 opacity-40 transition-opacity group-hover:opacity-100"
							style={{ color: "var(--text-secondary)" }}
						/>
					</div>

					<Button
						variant="ghost"
						size="icon"
						className="mt-0.5 h-6 w-6 shrink-0 rounded-full p-0"
						onClick={onToggle}
						aria-label={
							completed ? "Mark task incomplete" : "Mark task complete"
						}
					>
						{completed ? (
							<CheckCircle2 className="h-5 w-5 text-emerald-500" />
						) : (
							<Circle
								className="h-5 w-5"
								style={{ color: "var(--text-secondary)" }}
							/>
						)}
					</Button>
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 items-center gap-2">
							{todo.isPinned && (
								<Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-amber-500" />
							)}

							{isEditingTitle ? (
								<Input
									ref={titleRef}
									autoFocus
									defaultValue={todo.title}
									maxLength={TITLE_MAX_LENGTH}
									onBlur={handleSaveTitle}
									onKeyDown={handleTitleKeyDown}
									className="h-auto w-full rounded-none border-0 border-b border-blue-500 bg-(--bg) px-0 py-0 text-sm font-medium leading-5 shadow-none focus-visible:ring-0"
									style={{ color: "var(--text)" }}
								/>
							) : (
								<Label
									onClick={() => !completed && setIsEditingTitle(true)}
									title="Double-click to edit title"
									className={`min-w-0 flex-1 select-none text-sm font-medium leading-5 transition-colors sm:text-sm ${
										completed
											? "line-through"
											: "cursor-pointer hover:text-blue-500"
									}`}
									style={{
										color: completed ? "var(--text-secondary)" : "var(--text)",
									}}
								>
									{todo.title}
								</Label>
							)}
						</div>

						<div className="mt-1">
							{isEditingDesc ? (
								<Textarea
									ref={descRef}
									autoFocus
									rows={1}
									defaultValue={todo.description ?? ""}
									maxLength={DESCRIPTION_MAX_LENGTH}
									onBlur={handleSaveDesc}
									onKeyDown={handleDescKeyDown}
									className="min-h-0 w-full resize-none rounded-none border-0 border-b border-blue-500 bg-(--bg) px-0 py-0 text-sm shadow-none focus-visible:ring-0"
									style={{ color: "var(--text)" }}
								/>
							) : (
								<Label
									onClick={() => !completed && setIsEditingDesc(true)}
									title="Double-click to edit description"
									className={`line-clamp-2 select-none text-sm transition-colors ${
										completed ? "" : "cursor-pointer hover:text-blue-500"
									}`}
									style={{ color: "var(--text-secondary)" }}
								>
									{todo.description || (
										<span className="italic opacity-40">
											Double-click to add a description...
										</span>
									)}
								</Label>
							)}
						</div>

						<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
							{/* Project Dropdown Selection */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<span
										title="Click to change project"
										className="flex min-w-0 max-w-[180px] items-center gap-1 text-[10px] font-medium cursor-pointer transition-colors hover:text-blue-500 select-none"
										style={{ color: "var(--text-secondary)" }}
									>
										<Folder className="h-3 w-3 shrink-0" />
										<span className="truncate">
											{todo.project?.name || "No project"}
										</span>
										<ChevronDown className="h-2.5 w-2.5 opacity-60" />
									</span>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="start"
									style={{
										backgroundColor: "var(--bg-secondary)",
										borderColor: "var(--border)",
										color: "var(--text)",
									}}
								>
									<DropdownMenuItem
										onClick={() => onUpdateTodo({ projectId: null })}
										className="text-[11px] cursor-pointer"
									>
										<span className="italic opacity-60">No project</span>
									</DropdownMenuItem>
									{projects.map((proj) => (
										<DropdownMenuItem
											key={proj.id}
											onClick={() => onUpdateTodo({ projectId: proj.id })}
											className="text-xs cursor-pointer"
										>
											{proj.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>

							{todo.dueDate && (
								<Popover
									open={isEditingDueDate}
									onOpenChange={(open) => {
										setIsEditingDueDate(open);
										if (open && todo.dueDate) {
											const d = new Date(todo.dueDate);
											setInlineDate(d);
											setInlineTime(d.toTimeString().slice(0, 5));
										}
									}}
								>
									<PopoverTrigger asChild>
										<Label
											onDoubleClick={() =>
												!completed && setIsEditingDueDate(true)
											}
											title="Double-click to change due date"
											className={`flex items-center gap-1 text-[10px] transition-colors select-none ${
												completed ? "" : "cursor-pointer hover:text-blue-500"
											}`}
											style={{ color: "var(--text-secondary)" }}
										>
											<CalendarDays className="h-3 w-3" />
											{formatDate(todo.dueDate)}
										</Label>
									</PopoverTrigger>
									<PopoverContent
										className="w-auto p-3 shadow-lg space-y-3"
										align="start"
										style={{
											backgroundColor: "var(--bg-secondary)",
											borderColor: "var(--border)",
											color: "var(--text)",
										}}
									>
										<Calendar
											mode="single"
											selected={inlineDate ?? undefined}
											onSelect={(date) => setInlineDate(date ?? null)}
											className="rounded-md border p-2 bg-(--bg) dark:bg-(--bg)"
											style={{
												backgroundColor: "var(--bg)",
												color: "var(--text)",
											}}
										/>
										<div className="space-y-1">
											<Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
												Time
											</Label>
											<div className="relative">
												<Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70" />
												<Input
													type="time"
													value={inlineTime}
													onChange={(e) => setInlineTime(e.target.value)}
													className="pl-8 text-xs h-8 bg-(--bg) dark:bg-(--bg)"
												/>
											</div>
										</div>
										<div className="flex justify-end gap-2 pt-1">
											<Button
												variant="outline"
												size="sm"
												className="h-7 text-xs"
												onClick={() => setIsEditingDueDate(false)}
											>
												Cancel
											</Button>
											<Button
												size="sm"
												className="h-7 text-xs text-white"
												style={{ backgroundColor: "var(--link)" }}
												onClick={() =>
													handleInlineSaveDueDate(inlineDate, inlineTime)
												}
											>
												Save
											</Button>
										</div>
									</PopoverContent>
								</Popover>
							)}

							{todo.children && todo.children.length > 0 && (
								<span
									className="flex items-center gap-1 text-[10px]"
									style={{ color: "var(--text-secondary)" }}
								>
									<CheckSquare className="h-3 w-3" />
									{todo.children.length} subtasks
								</span>
							)}

							{todo.attachments && todo.attachments.length > 0 && (
								<span
									className="flex items-center gap-1 text-[10px]"
									style={{ color: "var(--text-secondary)" }}
								>
									<Paperclip className="h-3 w-3" />
									{todo.attachments.length}
								</span>
							)}
						</div>

						{/* Unified badges section at the bottom with Status Dropdown */}
						<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
							{todo.tags?.map((item: any) => (
								<TagBadge key={item.tagId} name={item.tag?.name} />
							))}
							<PriorityMenu
								priority={todo.priority}
								disabled={completed}
								onChange={(priority) => onUpdateTodo({ priority })}
							/>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										title="Click to change status"
										className="cursor-pointer select-none border-none focus-visible:ring-0 transition-transform bg-(--bg-secondary) hover:bg-(--bg-secondary) outline-none inline-flex items-center gap-1"
									>
										<StatusBadge status={todo.status} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="start"
									style={{
										backgroundColor: "var(--bg)",
										borderColor: "var(--border)",
										color: "var(--text)",
									}}
								>
									<DropdownMenuItem
										onClick={() => onUpdateTodo({ status: "IN_PROGRESS" })}
										className="text-xs cursor-pointer flex items-center gap-2"
									>
										<span className="h-2 w-2 rounded-full bg-(--link)" />
										In Progress
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => onUpdateTodo({ status: "LATE" })}
										className="text-xs cursor-pointer flex items-center gap-2"
									>
										<span className="h-2 w-2 rounded-full bg-red-500" />
										Late
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => onUpdateTodo({ status: "COMPLETED" })}
										className="text-xs cursor-pointer flex items-center gap-2"
									>
										<span className="h-2 w-2 rounded-full bg-emerald-500" />
										Completed
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>

				{/* Edit button container displayed consistently on the right */}
				<div className="shrink-0 items-center gap-1.5 flex">
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
						onClick={() => setIsDetailsModalOpen(true)}
						title="Edit task details"
					>
						<Pencil className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<TodoDetailsDialog
				open={isDetailsModalOpen}
				onOpenChange={setIsDetailsModalOpen}
				todo={todo}
				allTags={allTags}
				isOnline={isOnline}
				onSave={(payload) => onUpdateTodo(payload)}
				onDelete={onDeleteTodo}
				onUpdateTags={onUpdateTags}
				onCreateSubtask={onCreateSubtask}
				onToggleSubtask={onToggleSubtask}
				onAddAttachment={onAddAttachment}
				onDeleteAttachment={onDeleteAttachment}
			/>
		</>
	);
}

const PRIORITY_OPTIONS: Todo["priority"][] = [
	"LOW",
	"MEDIUM",
	"HIGH",
	"URGENT",
];

function PriorityMenu({
	priority,
	onChange,
	disabled,
}: {
	priority: Todo["priority"];
	onChange: (priority: Todo["priority"]) => void;
	disabled?: boolean;
}) {
	if (disabled) {
		return <PriorityBadge priority={priority} />;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					title="Click to change priority"
					className="rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-500"
				>
					<PriorityBadge priority={priority} />
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="start" className="bg-(--bg)">
				{PRIORITY_OPTIONS.map((option) => (
					<DropdownMenuItem
						key={option}
						onClick={() => onChange(option)}
						className="flex items-center justify-between gap-3"
					>
						<PriorityBadge priority={option} />
						{option === priority && (
							<Check className="h-3.5 w-3.5" style={{ color: "var(--link)" }} />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function PriorityBadge({ priority }: { priority: Todo["priority"] }) {
	const styles: Record<
		Todo["priority"],
		{
			label: string;
			color: string;
			background: string;
		}
	> = {
		LOW: { label: "Low", color: "#64748b", background: "#64748b14" },
		MEDIUM: { label: "Medium", color: "#3b82f6", background: "#3b82f614" },
		HIGH: { label: "High", color: "#f59e0b", background: "#f59e0b14" },
		URGENT: { label: "Urgent", color: "#ef4444", background: "#ef444414" },
	};

	const style = styles[priority] ?? styles.MEDIUM;

	return (
		<span
			className="px-2.5 flex items-center rounded-md py-0.5 text-[9px]"
			style={{
				color: style.color,
				backgroundColor: style.background,
			}}
		>
			{style.label}
		</span>
	);
}

function StatusBadge({ status }: { status: Todo["status"] }) {
	const labels: Record<Todo["status"], string> = {
		IN_PROGRESS: "In progress",
		LATE: "Late",
		COMPLETED: "Completed",
	};

	return (
		<span
			className="px-2.5 flex items-center rounded-md py-0.5 text-[9px] font-medium"
			style={{
				color: status === "COMPLETED" ? "#10b981" : "var(--text-secondary)",
				backgroundColor: status === "COMPLETED" ? "#10b98114" : "var(--bg)",
			}}
		>
			{labels[status]}
		</span>
	);
}

function TagBadge({ name }: { name?: string }) {
	if (!name) return null;

	return (
		<span
			className="px-2.5 items-center rounded-md py-0.5 text-[9px]"
			style={{
				borderColor: "var(--border)",
				color: "var(--text-secondary)",
			}}
		>
			#{name}
		</span>
	);
}

function EmptyState({
	search,
	onCreate,
}: {
	search: boolean;
	onCreate: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center px-6 py-16 text-center">
			<div
				className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
				style={{ backgroundColor: "var(--bg)" }}
			>
				{search ? (
					<Search
						className="h-5 w-5"
						style={{ color: "var(--text-secondary)" }}
					/>
				) : (
					<Check className="h-5 w-5" style={{ color: "var(--link)" }} />
				)}
			</div>

			<h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
				{search ? "No tasks found" : "You're all caught up"}
			</h3>

			<p
				className="mt-1 max-w-xs text-xs leading-5"
				style={{ color: "var(--text-secondary)" }}
			>
				{search
					? "Try a different search term."
					: "Create a task to start organizing your work."}
			</p>

			{!search && (
				<Button
					size="sm"
					className="mt-5 gap-1.5 text-white"
					style={{ backgroundColor: "var(--link)" }}
					onClick={onCreate}
				>
					<Plus className="h-4 w-4" />
					New task
				</Button>
			)}
		</div>
	);
}

function CreateTaskDialog({
	open,
	onOpenChange,
	error: externalError,
	pending,
	onSubmit,
	onErrorClear,
	projects = [],
	defaultProjectId,
	defaultParentId,
}: CreateTaskDialogProps) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState<
		"LOW" | "MEDIUM" | "HIGH" | "URGENT"
	>("MEDIUM");
	const [dueDate, setDueDate] = useState<Date | null>(null);
	const [dueTime, setDueTime] = useState<string>("");
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [projectId, setProjectId] = useState(defaultProjectId || "");
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleFormSubmit = () => {
		setValidationError(null);

		let finalDate: Date | null = null;
		if (dueDate) {
			finalDate = new Date(dueDate);
			if (dueTime) {
				const [hours, minutes] = dueTime.split(":");
				finalDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
			}
		}

		const result = createTodoSchema.safeParse({
			title,
			status: "IN_PROGRESS",
			description: description.trim() ? description : undefined,
			priority,
			dueDate: finalDate || undefined,
			projectId: projectId || undefined,
			parentId: defaultParentId || undefined,
		});

		if (!result.success) {
			const flattened = result.error.flatten();
			const firstError =
				flattened.formErrors[0] ||
				Object.values(flattened.fieldErrors)[0]?.[0] ||
				"Invalid input";
			setValidationError(firstError);
			return;
		}

		onSubmit(result.data);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				onOpenChange(value);
				if (!value) {
					onErrorClear();
					setTitle("");
					setDescription("");
					setPriority("MEDIUM");
					setValidationError(null);
					setDueDate(null);
					setDueTime("");
					setProjectId(defaultProjectId || "");
				}
			}}
		>
			<DialogContent
				className="w-[calc(100vw-24px)] max-w-[480px] rounded-2xl border"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
					color: "var(--text)",
				}}
			>
				<DialogHeader>
					<DialogTitle className="text-base" style={{ color: "var(--text)" }}>
						Create task
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{(validationError || externalError) && (
						<div
							className="rounded-lg px-3 py-2 text-xs"
							style={{
								backgroundColor: "#ef444414",
								color: "#ef4444",
							}}
						>
							{validationError || externalError}
						</div>
					)}

					<div>
						<Label
							className="text-[10px] font-semibold uppercase tracking-wider"
							style={{ color: "var(--text-secondary)" }}
						>
							Title
						</Label>
						<Input
							autoFocus
							placeholder="What needs to be done?"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							maxLength={255}
							className="mt-1.5"
							style={{
								backgroundColor: "var(--bg)",
								borderColor: "var(--border)",
								color: "var(--text)",
							}}
						/>
						<p
							className="mt-1 text-right text-[10px]"
							style={{ color: "var(--text-secondary)" }}
						>
							{title.length}/255
						</p>
					</div>

					<div>
						<Label
							className="text-[10px] font-semibold uppercase tracking-wider"
							style={{ color: "var(--text-secondary)" }}
						>
							Description
						</Label>
						<Textarea
							placeholder="Add some context..."
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							maxLength={5000}
							rows={3}
							className="mt-1.5 resize-none"
							style={{
								backgroundColor: "var(--bg)",
								borderColor: "var(--border)",
								color: "var(--text)",
							}}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label
								className="text-[10px] font-semibold uppercase tracking-wider"
								style={{ color: "var(--text-secondary)" }}
							>
								Priority
							</Label>
							<Select
								value={priority}
								onValueChange={(value) => setPriority(value as any)}
							>
								<SelectTrigger
									className="mt-1.5 w-full text-xs"
									style={{
										backgroundColor: "var(--bg)",
										borderColor: "var(--border)",
										color: "var(--text)",
									}}
								>
									<SelectValue placeholder="Select priority" />
								</SelectTrigger>
								<SelectContent
									style={{
										backgroundColor: "var(--bg-secondary)",
										borderColor: "var(--border)",
										color: "var(--text)",
									}}
								>
									<SelectItem value="LOW">Low</SelectItem>
									<SelectItem value="MEDIUM">Medium</SelectItem>
									<SelectItem value="HIGH">High</SelectItem>
									<SelectItem value="URGENT">Urgent</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label
								className="text-[10px] font-semibold uppercase tracking-wider"
								style={{ color: "var(--text-secondary)" }}
							>
								Due Date
							</Label>
							<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className="mt-1.5 w-full justify-start text-left font-normal text-xs h-9"
										style={{
											backgroundColor: "var(--bg)",
											borderColor: "var(--border)",
											color: dueDate ? "var(--text)" : "var(--text-secondary)",
										}}
									>
										<CalendarDays className="mr-2 h-3.5 w-3.5 opacity-70" />
										{dueDate ? dueDate.toLocaleDateString() : "Pick a date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent
									className="w-auto p-0 shadow-lg"
									align="start"
									style={{
										backgroundColor: "var(--bg-secondary)",
										borderColor: "var(--border)",
									}}
								>
									<Calendar
										mode="single"
										selected={dueDate || undefined}
										onSelect={(date) => {
											setDueDate(date || null);
											setIsCalendarOpen(false);
										}}
										className="rounded-md border p-3"
										style={{
											backgroundColor: "var(--bg)",
											color: "var(--text)",
										}}
									/>
								</PopoverContent>
							</Popover>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label
								className="text-[10px] font-semibold uppercase tracking-wider"
								style={{ color: "var(--text-secondary)" }}
							>
								Due Time
							</Label>
							<div className="relative mt-1.5">
								<Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70" />
								<Input
									type="time"
									value={dueTime}
									color="var(--text)"
									onChange={(e) => setDueTime(e.target.value)}
									className=" pl-8 text-xs h-9 bg-(--bg) dark:bg-(--bg)"
								/>
							</div>
						</div>

						{projects.length > 0 && (
							<div>
								<Label
									className="text-[10px] font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-secondary)" }}
								>
									Project
								</Label>
								<Select
									value={projectId}
									onValueChange={(value) =>
										setProjectId(value === "none" ? "" : value)
									}
								>
									<SelectTrigger
										className="mt-1.5 w-full text-xs h-9"
										style={{
											backgroundColor: "var(--bg)",
											borderColor: "var(--border)",
											color: "var(--text)",
										}}
									>
										<SelectValue placeholder="No Project (Inbox)" />
									</SelectTrigger>
									<SelectContent
										style={{
											backgroundColor: "var(--bg-secondary)",
											borderColor: "var(--border)",
											color: "var(--text)",
										}}
									>
										<SelectItem value="none">No Project (Inbox)</SelectItem>
										{projects.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</div>
				</div>

				<DialogFooter className="gap-2">
					<Button
						className="border border-red-500 bg-(--bg-secondary) text-red-500 hover:bg-red-500 hover:text-(--text)"
						onClick={() => onOpenChange(false)}
						disabled={pending}
					>
						Cancel
					</Button>

					<Button
						onClick={handleFormSubmit}
						disabled={!title.trim() || pending}
						className="text-white"
						style={{ backgroundColor: "var(--link)" }}
					>
						{pending ? "Creating..." : "Create task"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ProjectDot({ color }: { color?: string }) {
	if (!color) {
		return <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />;
	}

	if (color.startsWith("bg-")) {
		return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
	}

	return (
		<span
			className="h-2 w-2 shrink-0 rounded-full"
			style={{ backgroundColor: color }}
		/>
	);
}

function formatDate(value: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}
