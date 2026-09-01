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
import { isAxiosError } from "axios";
import {
	CalendarDays,
	Check,
	CheckCircle2,
	CheckSquare,
	ChevronLeft,
	ChevronRight,
	Circle,
	Clock3,
	Folder,
	GripVertical,
	Inbox,
	Menu,
	MoreHorizontal,
	Paperclip,
	Pin,
	Plus,
	Search,
	SlidersHorizontal,
	Tag as TagIcon,
	TrendingUp,
	X,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { z } from "zod";

import { axios } from "#/lib/utils";
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

interface Project {
	id: string;
	name: string;
	color?: string;
}

interface Tag {
	id: string;
	name: string;
}

interface TodoTag {
	tagId: string;
	tag?: Tag;
}

interface Todo {
	id: string;
	title: string;
	description?: string | null;
	status:
		| "BACKLOG"
		| "TODO"
		| "IN_PROGRESS"
		| "IN_REVIEW"
		| "COMPLETED"
		| "CANCELLED";
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
}

const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 5000;

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const todoStatusEnum = z.enum([
	"BACKLOG",
	"TODO",
	"IN_PROGRESS",
	"IN_REVIEW",
	"COMPLETED",
	"CANCELLED",
]);

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
	status: todoStatusEnum.optional().default("TODO"),
	priority: priorityEnum.optional().default("MEDIUM"),
	projectId: z.string().optional().nullable(),
	dueDate: z.date().optional().nullable(),
	estimatedMinutes: z.number().int().min(0).optional().nullable(),
});

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
			const online = await invoke("is_online");
			if (online) {
				console.log("Connected to the internet!");
			} else {
				console.log("No internet connection.");
			}
			return [];
		},
		refetchInterval: 5000,
	});

const fetchTodoQueryOptions = ({
	page = 1,
	limit = 10,
	search,
	tab,
	projectId,
}: TodoSearchParams) =>
	queryOptions({
		queryKey: ["todos", page, limit, search, tab, projectId],
		queryFn: () => fetchTodosApi({ page, limit, search, tab, projectId }),
		placeholderData: (previousData) => previousData,
		retry: (failureCount, error) => {
			console.error(error);
			return failureCount < 2;
		},
		refetchInterval: 5000,
	});

async function fetchTodosApi({
	page = 1,
	limit = 10,
	search,
	tab,
	projectId,
}: TodoSearchParams) {
	try {
		const response = await axios.get("/todos", {
			params: {
				page: page,
				limit: limit,
				search: search || undefined,
				status:
					tab === "completed"
						? "COMPLETED"
						: tab === "today"
							? "TODO"
							: undefined,
				projectId: projectId || undefined,
			},
		});

		const rawData = response.data || [];

		if (rawData.data && Array.isArray(rawData.data)) {
			rawData.data.sort(
				(a: Todo, b: Todo) => (a.reorderIndex ?? 0) - (b.reorderIndex ?? 0),
			);
		}

		return rawData;
	} catch (e) {
		console.error("Error @ fetchTodosApi", e);
		return { data: [], totalCount: 0, totalPages: 1 };
	}
}

async function fetchProjectsApi() {
	try {
		const response = await axios.get("/projects");
		//	console.log(response.data, "fah");
		return response.data || [];
	} catch (e) {
		console.error("fetchProjectsApi", e);
	}
}

async function fetchTagsApi() {
	try {
		const response = await axios.get("/tags");
		return response.data || [];
	} catch (e) {
		console.error("fetchTagsApi", e);
	}
}

async function fetchStatsApi() {
	try {
		const response = await axios.get("/todos/stats");
		return response.data || [];
	} catch (e) {
		console.error("fetchStatsApi @", e);
	}
}

function Dashboard() {
	const { queryClient } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	const { page, limit, search, tab, projectId } = Route.useSearch();

	const [mobileOpen, setMobileOpen] = useState(false);

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [searchTodoValue, setSearchTodoValue] = useState("");

	const searchTodoDebounceFn = useDebouncedCallback(
		async (query: string) => {
			updateSearchParams({ search: query });
		},
		{
			wait: 400,
		},
	);

	const { data: sessionData } = authClient.useSession();
	const currentUser = sessionData?.user;

	const updateSearchParams = async (params: Partial<TodoSearchParams>) => {
		navigate({
			search: (prev) => {
				return {
					...prev,
					...params,
				};
			},
		});
		await queryClient.invalidateQueries({ queryKey: ["todos"] });
	};

	const isReordering = useIsMutating({ mutationKey: ["reorder-todos"] }) > 0;

	const {
		data: todosRes,
		isPending,
		isPlaceholderData,
		isFetching,
	} = useQuery({
		...fetchTodoQueryOptions({ page, limit, search, tab, projectId }),
		// Don't let the automatic poll race the optimistic reorder update —
		// it can win the race against the mutation's own refetch and briefly
		// flash the pre-drag order back onto the screen.
		refetchInterval: isReordering ? false : 5000,
	});

	const _IGNORED______THIS_CHECKS_FOR_WIFI = useQuery(
		wifiConnectionQueryOptions(),
	);

	const { data: projectsRes } = useQuery({
		queryKey: ["projects"],
		queryFn: fetchProjectsApi,
		refetchInterval: 5000,
	});

	const { data: tagsRes } = useQuery({
		queryKey: ["tags"],
		queryFn: fetchTagsApi,
		refetchInterval: 5000,
	});

	const { data: statsRes } = useQuery({
		queryKey: ["todo-stats"],
		queryFn: fetchStatsApi,
		refetchInterval: 5000,
	});

	const updateTodoMutation = useMutation({
		mutationFn: async ({
			id,
			...payload
		}: {
			id: string;
			title?: string;
			description?: string | null;
			priority?: Todo["priority"];
		}) => {
			const response = await axios.patch(`/todos/${id}`, payload);
			return response.data;
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
		},
	});

	const reorderTodosMutation = useMutation({
		mutationKey: ["reorder-todos"],
		mutationFn: async (orderedIds: string[]) => {
			const response = await axios.post("/todos/reorder", { orderedIds });
			return response.data;
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
				// Assign reorderIndex to match the position each item will land
				// on the server (see the /todos/reorder route, which sets
				// reorderIndex = array index). Keeping this in sync locally
				// means any refetch that lands mid-drag or right after won't
				// disagree with what's already on screen and cause a flash.
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
			// Only force a refetch to resync with the server when something
			// actually went wrong — on success the optimistic state above
			// already matches what was persisted, so refetching immediately
			// would just cause a pointless flash.
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
		mutationFn: async (payload: { title: string; description?: string }) => {
			const validated = createTodoSchema.parse(payload);

			const response = await axios.post("/todos", {
				title: validated.title,
				description: validated.description || undefined,
			});

			return response.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["todos"],
			});

			queryClient.invalidateQueries({
				queryKey: ["todo-stats"],
			});

			setIsCreateOpen(false);
			setNewTitle("");
			setNewDescription("");
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

			const response = await axios.patch(`/todos/${validated.id}`, {
				status: validated.status,
			});

			return response.data;
		},
		onMutate: async ({ id, status }) => {
			await queryClient.cancelQueries({ queryKey: ["todos"] });
			const previousTodos = queryClient.getQueryData(["todos"]);
			const nextStatus = status === "COMPLETED" ? "TODO" : "COMPLETED";

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

			return { previousTodos };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousTodos) {
				queryClient.setQueryData(["todos"], context.previousTodos);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["todos"] });
			queryClient.invalidateQueries({ queryKey: ["todo-stats"] });
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
				className="
					hidden lg:flex
					w-[240px] xl:w-[260px]
					shrink-0
					border-r
				"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
				}}
			>
				<SidebarContent
					searchParams={{ page, limit, search, tab, projectId }}
					updateSearchParams={updateSearchParams}
					projects={projects}
					tags={tags}
					currentUser={currentUser}
					navigate={navigate}
				/>
			</aside>

			<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
				<SheetContent
					side="left"
					className="
						w-[min(86vw,300px)]
						p-0
						border-r
					"
					style={{
						backgroundColor: "var(--bg-secondary)",
						borderColor: "var(--border)",
					}}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Navigation</SheetTitle>
					</SheetHeader>

					<SidebarContent
						searchParams={{ page, limit, search, tab, projectId }}
						updateSearchParams={(params) => {
							updateSearchParams(params);
							setMobileOpen(false);
						}}
						projects={projects}
						tags={tags}
						currentUser={currentUser}
					/>
				</SheetContent>

				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<header
						className="
							flex h-14 shrink-0 items-center gap-2
							border-b px-3 sm:h-16 sm:px-5 lg:px-6
						"
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
									style={{
										color: "var(--text-secondary)",
									}}
								/>
							</Button>
						</SheetTrigger>

						<div className="min-w-0 flex-1">
							<div className="relative w-full max-w-xl">
								<Search
									className="
										pointer-events-none
										absolute left-3 top-1/2
										h-4 w-4 -translate-y-1/2
									"
									style={{
										color: "var(--text-secondary)",
									}}
								/>

								<Input
									value={searchTodoValue}
									onChange={(event) => {
										setSearchTodoValue(event.target.value);
										searchTodoDebounceFn(event.target.value);
									}}
									placeholder="Search tasks..."
									className="
										h-9 w-full
										border-transparent
										pl-9 pr-9
										text-sm
										shadow-none
										focus-visible:ring-1
									"
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
										className="
											absolute right-1 top-1/2
											h-7 w-7 -translate-y-1/2
										"
										onClick={() => searchTodoDebounceFn("")}
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								)}
							</div>
						</div>

						<Button
							variant="outline"
							size="sm"
							className="hidden shrink-0 gap-2 sm:inline-flex"
							style={{
								borderColor: "var(--border)",
								color: "var(--text)",
							}}
						>
							<SlidersHorizontal className="h-3.5 w-3.5" />
							<span>Filter</span>
						</Button>

						<Button
							size="sm"
							className="h-9 shrink-0 gap-1.5 text-white"
							style={{
								backgroundColor: "var(--link)",
							}}
							onClick={() => setIsCreateOpen(true)}
						>
							<Plus className="h-4 w-4" />

							<span className="hidden sm:inline">New task</span>
						</Button>
					</header>

					<main className="min-h-0 flex-1 overflow-y-auto">
						<div className="mx-auto w-full max-w-[1500px] p-3 sm:p-5 lg:p-7">
							<div className="mb-5 flex items-end justify-between gap-4">
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<h1
											className="truncate text-xl font-bold tracking-tight sm:text-2xl"
											style={{
												color: "var(--text)",
											}}
										>
											{pageTitle}
										</h1>

										{/*isFetching && (
											<span className="hidden rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500 sm:inline-flex">
												Fetching...
											</span>
										)*/}
									</div>

									<p
										className="
											mt-1 truncate
											text-xs sm:text-sm
										"
										style={{
											color: "var(--text-secondary)",
										}}
									>
										{pageDescription}
									</p>
								</div>

								<div className="hidden shrink-0 text-right sm:block">
									<p
										className="text-lg font-semibold"
										style={{
											color: "var(--text)",
										}}
									>
										{todosRes?.totalCount ?? 0}
									</p>
									<p
										className="text-[11px]"
										style={{
											color: "var(--text-secondary)",
										}}
									>
										tasks
									</p>
								</div>
							</div>

							<div
								className="
									mb-5
									grid grid-cols-2
									gap-2.5
									sm:grid-cols-3
									sm:gap-3
								"
							>
								<StatCard
									title="Tasks"
									value={todosRes?.totalCount ?? 0}
									icon={<CheckSquare className="h-4 w-4 text-blue-500" />}
								/>

								<StatCard
									title="Completion"
									value={`${stats.completionRate}%`}
									icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
								/>

								<StatCard
									title="Remaining"
									value={`${Math.floor(
										stats.remainingMinutes / 60,
									)}h ${stats.remainingMinutes % 60}m`}
									icon={<Clock3 className="h-4 w-4 text-amber-500" />}
								/>
							</div>

							<Card
								className="overflow-hidden gap-0 rounded-xl shadow-none"
								style={{
									backgroundColor: "var(--bg-secondary)",
									borderColor: "var(--border)",
								}}
							>
								<CardHeader
									className="
										flex flex-row items-center
										justify-between
										border-b px-4 py-3
										sm:px-5
									"
									style={{
										borderColor: "var(--border)",
									}}
								>
									<div className="flex min-w-0 items-center gap-2">
										<CardTitle
											className="text-sm font-semibold"
											style={{
												color: "var(--text)",
											}}
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
										style={{
											color: "var(--text-secondary)",
										}}
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
									className="
										flex flex-wrap
										items-center justify-between
										gap-3 border-t px-4 py-3
										sm:px-5
									"
									style={{
										borderColor: "var(--border)",
									}}
								>
									<p
										className="text-[11px]"
										style={{
											color: "var(--text-secondary)",
										}}
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
					</main>
				</div>
			</Sheet>

			<CreateTaskDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				title={newTitle}
				description={newDescription}
				error={formError}
				pending={createTodoMutation.isPending}
				onTitleChange={setNewTitle}
				onDescriptionChange={setNewDescription}
				onSubmit={() =>
					createTodoMutation.mutate({
						title: newTitle,
						description: newDescription,
					})
				}
				onErrorClear={() => setFormError(null)}
			/>
		</div>
	);
}

function SidebarContent({
	searchParams,
	updateSearchParams,
	projects,
	tags,
	currentUser,
}: {
	searchParams: TodoSearchParams;
	updateSearchParams: (params: Partial<TodoSearchParams>) => void;
	projects: Project[];
	tags: Tag[];
	currentUser?: {
		name?: string;
		email?: string;
	} | null;
}) {
	const { queryClient } = Route.useRouteContext();
	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto p-4">
				<div className="mb-7 flex items-center gap-3 px-1">
					<div
						className="
							flex h-9 w-9 shrink-0
							items-center justify-center
							rounded-full
							text-sm font-bold text-white
							shadow-sm
						"
						style={{
							backgroundColor: "var(--link)",
						}}
					>
						T
					</div>

					<div className="min-w-0">
						<p
							className="truncate text-sm font-semibold"
							style={{
								color: "var(--text)",
							}}
						>
							Cakwei's TODO
						</p>

						<p
							className="truncate text-[11px]"
							style={{
								color: "var(--text-secondary)",
							}}
						>
							Personal workspace
						</p>
					</div>
				</div>

				<div className="space-y-1">
					<SidebarItem
						icon={<Inbox className="h-4 w-4" />}
						label="Inbox"
						active={searchParams.tab === "inbox" && !searchParams.projectId}
						onClick={() =>
							updateSearchParams({
								tab: "inbox",
								projectId: undefined,
								page: 1,
							})
						}
					/>

					<SidebarItem
						icon={<CalendarDays className="h-4 w-4" />}
						iconClassName="text-emerald-500"
						label="Today"
						active={searchParams.tab === "today"}
						onClick={async () => {
							updateSearchParams({
								tab: "today",
								projectId: undefined,
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
								page: 1,
							});
							await queryClient.invalidateQueries({ queryKey: ["todos"] });
						}}
					/>
				</div>

				<SidebarSection
					title="Projects"
					icon={<Folder className="h-3.5 w-3.5" />}
				>
					{projects.length === 0 ? (
						<p
							className="px-2 text-[11px]"
							style={{
								color: "var(--text-secondary)",
							}}
						>
							No projects yet
						</p>
					) : (
						<div className="space-y-0.5 hover:bg-(--bg)">
							{projects.map((project) => {
								const active = searchParams.projectId === project.id;
								return (
									<button
										key={project.id}
										type="button"
										onClick={() =>
											updateSearchParams({
												projectId: project.id,
												tab: "inbox",
												page: 1,
											})
										}
										className="flex w-full min-w-0 items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-xs transition-colors"
										style={{
											backgroundColor: active ? "var(--link)" : "",
											color: "var(--text)",
										}}
									>
										<ProjectDot color={project.color} />

										<span className="truncate">{project.name}</span>
									</button>
								);
							})}
						</div>
					)}
				</SidebarSection>

				<SidebarSection title="Tags" icon={<TagIcon className="h-3.5 w-3.5" />}>
					{tags.length === 0 ? (
						<p
							className="px-2 text-[11px]"
							style={{
								color: "var(--text-secondary)",
							}}
						>
							No tags yet
						</p>
					) : (
						<div className="flex flex-wrap gap-1.5 px-1">
							{tags.map((tag) => (
								<Badge
									key={tag.id}
									className="bg-(--bg-secondary) outline outline-(--link) text-(--link) rounded-full px-2 text-[10px] font-normal"
								>
									#{tag.name}
								</Badge>
							))}
						</div>
					)}
				</SidebarSection>
			</div>

			<div
				className="shrink-0 border-t p-3"
				style={{
					borderColor: "var(--border)",
				}}
			>
				<div className="flex min-w-0 items-center gap-2.5">
					<div
						className="
							flex h-8 w-8 shrink-0
							items-center justify-center
							rounded-full
							text-[10px] font-semibold
						"
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
							style={{
								color: "var(--text)",
							}}
						>
							{currentUser?.name || "User Account"}
						</p>

						<p
							className="truncate text-[10px]"
							style={{
								color: "var(--text-secondary)",
							}}
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
											onSuccess: () => {
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
	children,
}: {
	title: string;
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="mt-7">
			<div
				className="
					mb-2 flex items-center gap-1.5
					px-2 text-[10px] font-semibold
					uppercase tracking-wider
				"
				style={{
					color: "var(--text-secondary)",
				}}
			>
				{icon}
				<span>{title}</span>
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
	onToggle,
	onUpdateTodo,
	dragHandleProps,
}: {
	todo: Todo;
	onToggle: () => void;
	onUpdateTodo: (payload: {
		title?: string;
		description?: string | null;
		priority?: Todo["priority"];
	}) => void;
	dragHandleProps?: any;
}) {
	const completed = todo.status === "COMPLETED";

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDesc, setIsEditingDesc] = useState(false);

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

	return (
		<div
			className={`group relative border-b py-3.5 px-3 transition-colors sm:px-5 last:border-b-0 ${
				completed ? "opacity-60" : ""
			}`}
			style={{ borderColor: "var(--border)" }}
		>
			<div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
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
					aria-label={completed ? "Mark task incomplete" : "Mark task complete"}
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
								className="h-auto w-full rounded-none border-0 border-b border-blue-500 bg-transparent px-0 py-0 text-sm font-medium leading-5 shadow-none focus-visible:ring-0"
								style={{ color: "var(--text)" }}
							/>
						) : (
							<h3
								onDoubleClick={() => !completed && setIsEditingTitle(true)}
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
							</h3>
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
								className="min-h-0 w-full resize-none rounded-none border-0 border-b border-blue-500 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
								style={{ color: "var(--text)" }}
							/>
						) : (
							<p
								onDoubleClick={() => !completed && setIsEditingDesc(true)}
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
							</p>
						)}
					</div>

					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
						{todo.project?.name && (
							<span
								className="flex min-w-0 max-w-[180px] items-center gap-1 text-[10px] font-medium"
								style={{ color: "var(--text-secondary)" }}
							>
								<Folder className="h-3 w-3 shrink-0" />
								<span className="truncate">{todo.project.name}</span>
							</span>
						)}

						{todo.dueDate && (
							<span
								className="flex items-center gap-1 text-[10px]"
								style={{ color: "var(--text-secondary)" }}
							>
								<CalendarDays className="h-3 w-3" />
								{formatDate(todo.dueDate)}
							</span>
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

					<div className="mt-2.5 flex flex-wrap gap-1.5 lg:hidden">
						<PriorityMenu
							priority={todo.priority}
							disabled={completed}
							onChange={(priority) => onUpdateTodo({ priority })}
						/>
						<StatusBadge status={todo.status} />
						{todo.tags?.slice(0, 2).map((item) => (
							<TagBadge key={item.tagId} name={item.tag?.name} />
						))}
					</div>
				</div>

				<div className="hidden shrink-0 items-center gap-1.5 lg:flex">
					{todo.tags?.slice(0, 3).map((item) => (
						<TagBadge key={item.tagId} name={item.tag?.name} />
					))}
					<PriorityMenu
						priority={todo.priority}
						disabled={completed}
						onChange={(priority) => onUpdateTodo({ priority })}
					/>
					<StatusBadge status={todo.status} />
				</div>
			</div>
		</div>
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

function StatCard({
	title,
	value,
	icon,
}: {
	title: string;
	value: string | number;
	icon: ReactNode;
}) {
	return (
		<Card
			className="rounded-xl shadow-none h-25 flex justify-center"
			style={{
				backgroundColor: "var(--bg-secondary)",
				borderColor: "var(--border)",
			}}
		>
			<CardContent className="p-3 sm:p-4">
				<div className="flex items-center justify-between gap-2">
					<span
						className="truncate text-[10px] font-medium uppercase tracking-wide sm:text-[11px]"
						style={{
							color: "var(--text-secondary)",
						}}
					>
						{title}
					</span>

					{icon}
				</div>

				<p
					className="
						mt-1.5
						text-base font-bold
						tracking-tight
						sm:text-xl
					"
					style={{
						color: "var(--text)",
					}}
				>
					{value}
				</p>
			</CardContent>
		</Card>
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
		LOW: {
			label: "Low",
			color: "#64748b",
			background: "#64748b14",
		},
		MEDIUM: {
			label: "Medium",
			color: "#3b82f6",
			background: "#3b82f614",
		},
		HIGH: {
			label: "High",
			color: "#f59e0b",
			background: "#f59e0b14",
		},
		URGENT: {
			label: "Urgent",
			color: "#ef4444",
			background: "#ef444414",
		},
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
		BACKLOG: "Backlog",
		TODO: "Todo",
		IN_PROGRESS: "In progress",
		IN_REVIEW: "Review",
		COMPLETED: "Completed",
		CANCELLED: "Cancelled",
	};

	return (
		<span
			className="px-2.5 flex items-center rounded-md py-0.5 text-[9px]"
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
				className="
					mb-4 flex h-12 w-12
					items-center justify-center
					rounded-2xl
				"
				style={{
					backgroundColor: "var(--bg)",
				}}
			>
				{search ? (
					<Search
						className="h-5 w-5"
						style={{
							color: "var(--text-secondary)",
						}}
					/>
				) : (
					<Check
						className="h-5 w-5"
						style={{
							color: "var(--link)",
						}}
					/>
				)}
			</div>

			<h3
				className="text-sm font-semibold"
				style={{
					color: "var(--text)",
				}}
			>
				{search ? "No tasks found" : "You're all caught up"}
			</h3>

			<p
				className="mt-1 max-w-xs text-xs leading-5"
				style={{
					color: "var(--text-secondary)",
				}}
			>
				{search
					? "Try a different search term."
					: "Create a task to start organizing your work."}
			</p>

			{!search && (
				<Button
					size="sm"
					className="mt-5 gap-1.5 text-white"
					style={{
						backgroundColor: "var(--link)",
					}}
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
	title,
	description,
	error,
	pending,
	onTitleChange,
	onDescriptionChange,
	onSubmit,
	onErrorClear,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	error: string | null;
	pending: boolean;
	onTitleChange: (value: string) => void;
	onDescriptionChange: (value: string) => void;
	onSubmit: () => void;
	onErrorClear: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				onOpenChange(value);

				if (!value) {
					onErrorClear();
				}
			}}
		>
			<DialogContent
				className="
					w-[calc(100vw-24px)] max-w-[480px] rounded-2xl border
				"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
					color: "var(--text)",
				}}
			>
				<DialogHeader>
					<DialogTitle
						className="text-base"
						style={{
							color: "var(--text)",
						}}
					>
						Create task
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{error && (
						<div
							className="rounded-lg px-3 py-2 text-xs"
							style={{
								backgroundColor: "#ef444414",
								color: "#ef4444",
							}}
						>
							{error}
						</div>
					)}

					<div>
						<Label
							className="
								text-[10px] font-semibold
								uppercase tracking-wider
							"
							style={{
								color: "var(--text-secondary)",
							}}
						>
							Title
						</Label>

						<Input
							autoFocus
							placeholder="What needs to be done?"
							value={title}
							onChange={(event) => onTitleChange(event.target.value)}
							maxLength={TITLE_MAX_LENGTH}
							className="mt-1.5"
							style={{
								backgroundColor: "var(--bg)",
								borderColor: "var(--border)",
								color: "var(--text)",
							}}
						/>

						<p
							className="mt-1 text-right text-[10px]"
							style={{
								color: "var(--text-secondary)",
							}}
						>
							{title.length}/{TITLE_MAX_LENGTH}
						</p>
					</div>

					<div>
						<Label
							className="
								text-[10px] font-semibold
								uppercase tracking-wider
							"
							style={{
								color: "var(--text-secondary)",
							}}
						>
							Description
						</Label>

						<Textarea
							placeholder="Add some context..."
							value={description}
							onChange={(event) => onDescriptionChange(event.target.value)}
							maxLength={DESCRIPTION_MAX_LENGTH}
							rows={4}
							className="mt-1.5 resize-none"
							style={{
								backgroundColor: "var(--bg)",
								borderColor: "var(--border)",
								color: "var(--text)",
							}}
						/>
					</div>
				</div>

				<DialogFooter className="gap-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={pending}
					>
						Cancel
					</Button>

					<Button
						onClick={onSubmit}
						disabled={!title.trim() || pending}
						className="text-white"
						style={{
							backgroundColor: "var(--link)",
						}}
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
			style={{
				backgroundColor: color,
			}}
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
