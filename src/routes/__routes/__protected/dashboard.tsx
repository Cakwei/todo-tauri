import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	BarChart2,
	Calendar as CalendarIcon,
	CheckCircle2,
	CheckSquare,
	ChevronLeft,
	ChevronRight,
	Circle,
	Clock,
	Filter,
	Folder,
	GripVertical,
	Inbox,
	MoreVertical,
	Paperclip,
	Pin,
	Plus,
	Search,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// 1. SEARCH PARAMS SCHEMA DEFINITION
/*const todoSearchSchema = z.object({
	page: z.number().catch(1),
	limit: z.number().catch(10),
	search: z.string().optional().catch(""),
	tab: z.string().catch("inbox"),
});

type TodoSearchParams = z.infer<typeof todoSearchSchema>;
*/
export const Route = createFileRoute("/__routes/__protected/dashboard")({
	// validateSearch: (search) => todoSearchSchema.parse(search),
	component: Dashboard,
	});

// Mock DB Records for API Simulator
const ALL_MOCK_TODOS = Array.from({ length: 35 }).map((_, i) => ({
	id: `todo-${i + 1}`,
	title: `Task #${i + 1}: ${
		[
			"Implement drag-and-drop fractional reordering",
			"Configure MySQL composite indexes",
			"Setup RRULE recurrence parser",
			"Optimize Prisma query batching",
			"Add BetterAuth password hashing",
		][i % 5]
	}`,
	description: "Auto-generated task item for pagination testing.",
	status: i % 3 === 0 ? "COMPLETED" : i % 2 === 0 ? "IN_PROGRESS" : "TODO",
	priority: ["LOW", "MEDIUM", "HIGH", "URGENT"][i % 4],
	dueDate: new Date(Date.now() + i * 86400000).toISOString(),
	isPinned: i % 7 === 0,
	projectName: ["Work & Engineering", "Personal Growth", "Side Project"][i % 3],
	tags: [["Frontend"], ["Database", "Critical"], []][i % 3],
	subtaskCount: i % 3,
	attachmentsCount: i % 2,
}));

// 2. MOCK FETCH API FUNCTION
async function fetchTodosApi(params: TodoSearchParams) {
	await new Promise((res) => setTimeout(res, 300)); // Simulate latency

	let filtered = ALL_MOCK_TODOS;

	if (params.tab === "completed") {
		filtered = filtered.filter((t) => t.status === "COMPLETED");
	} else if (params.tab === "today") {
		filtered = filtered.filter((t) => t.status !== "COMPLETED");
	}

	if (params.search) {
		const q = params.search.toLowerCase();
		filtered = filtered.filter(
			(t) =>
				t.title.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q),
		);
	}

	const total = filtered.length;
	const totalPages = Math.ceil(total / params.limit) || 1;
	const start = (params.page - 1) * params.limit;
	const items = filtered.slice(start, start + params.limit);

	return {
		items,
		total,
		totalPages,
		page: params.page,
		limit: params.limit,
	};
}

const MOCK_PROJECTS = [
	{ id: "p1", name: "Work & Engineering", color: "bg-blue-500" },
	{ id: "p2", name: "Personal Growth", color: "bg-emerald-500" },
	{ id: "p3", name: "Side Project", color: "bg-purple-500" },
];

const MOCK_TAGS = [
	{ id: "t1", name: "Frontend" },
	{ id: "t2", name: "Database" },
	{ id: "t3", name: "Critical" },
];

function Dashboard() {
	const navigate = useNavigate({ from: Route.fullPath });
	const searchParams = Route.useSearch();
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	// 3. TANSTACK QUERY INTEGRATION
	const { data, isLoading, isPlaceholderData } = useQuery({
		queryKey: ["todos", searchParams],
		queryFn: () => fetchTodosApi(searchParams),
		placeholderData: (previousData) => previousData,
	});

	const updateSearchParams = (newParams: Partial<TodoSearchParams>) => {
		navigate({
			search: (prev) => ({
				...prev,
				...newParams,
			}),
		});
	};

	const todos = data?.items ?? [];
	const totalPages = data?.totalPages ?? 1;

	return (
		<div
			className="flex h-screen w-full font-sans transition-colors duration-200"
			style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
		>
			{/* 1. SIDEBAR NAVIGATION */}
			<aside
				className="w-64 border-r flex flex-col justify-between shrink-0"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
				}}
			>
				<div className="p-4 space-y-6">
					<div className="flex items-center gap-3 px-2">
						<div
							className="h-9 w-9 rounded-lg flex items-center justify-center font-bold shadow-md text-white"
							style={{ backgroundColor: "var(--link)" }}
						>
							T
						</div>
						<div className="overflow-hidden">
							<h2
								className="text-sm font-semibold truncate"
								style={{ color: "var(--text)" }}
							>
								TaskSpace Pro
							</h2>
							<p
								className="text-xs truncate"
								style={{ color: "var(--text-secondary)" }}
							>
								Production Workspace
							</p>
						</div>
					</div>

					{/* Core Navigation Views synced with search params */}
					<nav className="space-y-1">
						<SidebarItem
							icon={
								<Inbox className="w-4 h-4" style={{ color: "var(--text)" }} />
							}
							label="Inbox"
							active={searchParams.tab === "inbox"}
							onClick={() => updateSearchParams({ tab: "inbox", page: 1 })}
						/>
						<SidebarItem
							icon={<CalendarIcon className="w-4 h-4 text-emerald-500" />}
							label="Today"
							active={searchParams.tab === "today"}
							onClick={() => updateSearchParams({ tab: "today", page: 1 })}
						/>
						<SidebarItem
							icon={<CheckSquare className="w-4 h-4 text-blue-500" />}
							label="Completed"
							active={searchParams.tab === "completed"}
							onClick={() => updateSearchParams({ tab: "completed", page: 1 })}
						/>
					</nav>

					{/* Projects */}
					<div className="space-y-2 pt-2">
						<div className="flex items-center justify-between px-2">
							<span
								className="text-xs font-semibold tracking-wider uppercase"
								style={{ color: "var(--text-secondary)" }}
							>
								Projects
							</span>
							<Button variant="ghost" size="icon" className="h-5 w-5">
								<Plus
									className="w-3.5 h-3.5"
									style={{ color: "var(--text-secondary)" }}
								/>
							</Button>
						</div>
						<div className="space-y-0.5">
							{MOCK_PROJECTS.map((proj) => (
								<Button
									key={proj.id}
									className="bg-(--bg-secondary) w-full flex justify-start hover:bg-(--bg) px-2.5 py-1.5 rounded-md text-xs transition"
								>
									<span className={`w-2 h-2 rounded-full ${proj.color}`} />
									<span className="truncate text-(--text)">{proj.name}</span>
								</Button>
							))}
						</div>
					</div>

					{/* Tags */}
					<div className="space-y-2 pt-2">
						<span
							className="text-xs font-semibold tracking-wider uppercase px-2"
							style={{ color: "var(--text-secondary)" }}
						>
							Tags
						</span>
						<div className="flex flex-wrap gap-1.5 px-2">
							{MOCK_TAGS.map((tag) => (
								<Badge key={tag.id} variant="secondary" className="text-xs">
									#{tag.name}
								</Badge>
							))}
						</div>
					</div>
				</div>

				{/* User Profile Footer */}
				<div
					className="p-3 border-t flex items-center justify-between"
					style={{ borderColor: "var(--border)" }}
				>
					<div className="flex items-center gap-2.5">
						<div
							className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs"
							style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
						>
							JD
						</div>
						<div className="text-xs">
							<p className="font-semibold" style={{ color: "var(--text)" }}>
								Jane Doe
							</p>
							<p style={{ color: "var(--text-secondary)" }}>jane@dev.io</p>
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-7 w-7">
								<MoreVertical
									className="w-4 h-4"
									style={{ color: "var(--text-secondary)" }}
								/>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>Profile Settings</DropdownMenuItem>
							<DropdownMenuItem className="text-destructive">
								Log out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</aside>

			{/* 2. MAIN CONTENT AREA */}
			<main className="flex-1 flex flex-col overflow-hidden">
				{/* Top Header */}
				<header
					className="h-16 border-b px-6 flex items-center justify-between shrink-0"
					style={{
						backgroundColor: "var(--bg-secondary)",
						borderColor: "var(--border)",
					}}
				>
					<div className="flex items-center gap-4 flex-1 max-w-md">
						<div className="relative w-full">
							<Search
								className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
								style={{ color: "var(--text-secondary)" }}
							/>
							<Input
								placeholder="Search tasks by title..."
								value={searchParams.search ?? ""}
								onChange={(e) =>
									updateSearchParams({ search: e.target.value, page: 1 })
								}
								className="pl-9 h-9"
								style={{
									backgroundColor: "var(--bg)",
									borderColor: "var(--border)",
									color: "var(--text)",
								}}
							/>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							style={{ borderColor: "var(--border)", color: "var(--text)" }}
						>
							<Filter className="w-3.5 h-3.5" />
							Filter
						</Button>

						<Button
							size="sm"
							className="gap-1.5 text-white"
							style={{ backgroundColor: "var(--link)" }}
							onClick={() => setIsCreateOpen(true)}
						>
							<Plus className="w-4 h-4" />
							New Task
						</Button>
					</div>
				</header>

				{/* Scrollable View */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* Stat Metrics */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<StatCard
							title="Total Loaded"
							value={data?.total ?? 0}
							icon={<CheckSquare style={{ color: "var(--link)" }} />}
						/>
						<StatCard
							title="Current Page"
							value={`${searchParams.page} / ${totalPages}`}
							icon={<Clock className="text-amber-500" />}
						/>
						<StatCard
							title="Completion Rate"
							value="33%"
							icon={<TrendingUp className="text-emerald-500" />}
						/>
						<StatCard
							title="Est. Time Remaining"
							value="3h 00m"
							icon={<BarChart2 className="text-blue-500" />}
						/>
					</div>

					{/* Tasks Main Table/Card Container */}
					<Card
						style={{
							backgroundColor: "var(--bg-secondary)",
							borderColor: "var(--border)",
						}}
					>
						<CardHeader
							className="py-3 px-4 flex flex-row items-center justify-between border-b"
							style={{ borderColor: "var(--border)" }}
						>
							<CardTitle
								className="text-sm font-semibold"
								style={{ color: "var(--text)" }}
							>
								Tasks ({data?.total ?? 0})
							</CardTitle>
							{isLoading && (
								<span className="text-xs text-amber-500 animate-pulse">
									Loading data...
								</span>
							)}
						</CardHeader>
						<CardContent
							className="p-0 divide-y"
							style={{ borderColor: "var(--border)" }}
						>
							{todos.length === 0 ? (
								<div
									className="p-8 text-center text-xs"
									style={{ color: "var(--text-secondary)" }}
								>
									No tasks found.
								</div>
							) : (
								todos.map((todo) => (
									<div
										key={todo.id}
										className={`group p-4 flex items-start justify-between transition ${
											todo.status === "COMPLETED" ? "opacity-60" : ""
										}`}
										style={{ borderColor: "var(--border)" }}
									>
										<div className="flex items-start gap-3.5 flex-1 min-w-0">
											<Button
												className="mt-0.5 cursor-grab"
												style={{ color: "var(--text-secondary)" }}
											>
												<GripVertical className="w-4 h-4" />
											</Button>

											<Button className="mt-0.5">
												{todo.status === "COMPLETED" ? (
													<CheckCircle2 className="w-5 h-5 text-emerald-500" />
												) : (
													<Circle
														className="w-5 h-5 transition"
														style={{ color: "var(--text-secondary)" }}
													/>
												)}
											</Button>

											<div className="space-y-1.5 flex-1 pr-4">
												<div className="flex items-center gap-2">
													{todo.isPinned && (
														<Pin className="w-3.5 h-3.5 text-amber-500 rotate-45" />
													)}
													<h4
														className={`font-medium text-sm ${
															todo.status === "COMPLETED" ? "line-through" : ""
														}`}
														style={{
															color:
																todo.status === "COMPLETED"
																	? "var(--text-secondary)"
																	: "var(--text)",
														}}
													>
														{todo.title}
													</h4>
												</div>

												{todo.description && (
													<p
														className="text-xs line-clamp-1"
														style={{ color: "var(--text-secondary)" }}
													>
														{todo.description}
													</p>
												)}

												<div
													className="flex items-center gap-3 pt-1 text-xs"
													style={{ color: "var(--text-secondary)" }}
												>
													{todo.projectName && (
														<span
															className="flex items-center gap-1 font-medium"
															style={{ color: "var(--text)" }}
														>
															<Folder
																className="w-3 h-3"
																style={{ color: "var(--link)" }}
															/>
															{todo.projectName}
														</span>
													)}

													{todo.dueDate && (
														<span className="flex items-center gap-1">
															<CalendarIcon className="w-3 h-3" />
															{new Date(todo.dueDate).toLocaleDateString(
																"en-US",
																{ month: "short", day: "numeric" },
															)}
														</span>
													)}

													{todo.subtaskCount > 0 && (
														<span className="flex items-center gap-1">
															<ChevronRight className="w-3 h-3" />
															{todo.subtaskCount} Subtasks
														</span>
													)}

													{todo.attachmentsCount > 0 && (
														<span className="flex items-center gap-1">
															<Paperclip className="w-3 h-3" />
															{todo.attachmentsCount}
														</span>
													)}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-3 shrink-0">
											{todo.tags.map((tag) => (
												<Badge
													key={tag}
													variant="outline"
													className="hidden sm:inline-block text-[10px]"
													style={{
														borderColor: "var(--border)",
														color: "var(--text-secondary)",
													}}
												>
													{tag}
												</Badge>
											))}

											<PriorityBadge priority={todo.priority} />
											<StatusBadge status={todo.status} />
										</div>
									</div>
								))
							)}
						</CardContent>

						{/* 4. PAGINATION CONTROLS FOOTER */}
						<CardFooter
							className="py-3 px-4 border-t flex items-center justify-between text-xs"
							style={{ borderColor: "var(--border)" }}
						>
							<div
								className="flex items-center gap-2"
								style={{ color: "var(--text-secondary)" }}
							>
								<span>Rows per page</span>
								<Select
									value={String(searchParams.limit)}
									onValueChange={(val) =>
										updateSearchParams({ limit: Number(val), page: 1 })
									}
								>
									<SelectTrigger
										className="h-7 w-[70px] text-xs"
										style={{
											backgroundColor: "var(--bg)",
											borderColor: "var(--border)",
										}}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent
										style={{
											backgroundColor: "var(--bg-secondary)",
											borderColor: "var(--border)",
										}}
									>
										<SelectItem value="5">5</SelectItem>
										<SelectItem value="10">10</SelectItem>
										<SelectItem value="20">20</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center gap-2">
								<span style={{ color: "var(--text-secondary)" }}>
									Page {searchParams.page} of {totalPages}
								</span>

								<div className="flex items-center gap-1">
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										disabled={searchParams.page <= 1 || isPlaceholderData}
										onClick={() =>
											updateSearchParams({ page: searchParams.page - 1 })
										}
										style={{
											borderColor: "var(--border)",
											color: "var(--text)",
										}}
									>
										<ChevronLeft className="w-4 h-4" />
									</Button>

									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										disabled={
											searchParams.page >= totalPages || isPlaceholderData
										}
										onClick={() =>
											updateSearchParams({ page: searchParams.page + 1 })
										}
										style={{
											borderColor: "var(--border)",
											color: "var(--text)",
										}}
									>
										<ChevronRight className="w-4 h-4" />
									</Button>
								</div>
							</div>
						</CardFooter>
					</Card>
				</div>
			</main>

			{/* CREATE TASK DIALOG */}
			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent
					className="sm:max-w-[425px]"
					style={{
						backgroundColor: "var(--bg-secondary)",
						borderColor: "var(--border)",
						color: "var(--text)",
					}}
				>
					<DialogHeader>
						<DialogTitle style={{ color: "var(--text)" }}>
							Create Task
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div>
							<Label
								className="text-xs font-semibold uppercase tracking-wider"
								style={{ color: "var(--text-secondary)" }}
							>
								Title
							</Label>
							<Input
								placeholder="Task title..."
								className="mt-1"
								style={{
									backgroundColor: "var(--bg)",
									borderColor: "var(--border)",
									color: "var(--text)",
								}}
							/>
						</div>

						<div>
							<Label
								className="text-xs font-semibold uppercase tracking-wider"
								style={{ color: "var(--text-secondary)" }}
							>
								Description
							</Label>
							<Textarea
								placeholder="Add details..."
								className="mt-1"
								rows={3}
								style={{
									backgroundColor: "var(--bg)",
									borderColor: "var(--border)",
									color: "var(--text)",
								}}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsCreateOpen(false)}
							style={{ borderColor: "var(--border)", color: "var(--text)" }}
						>
							Cancel
						</Button>
						<Button
							onClick={() => setIsCreateOpen(false)}
							className="text-white"
							style={{ backgroundColor: "var(--link)" }}
						>
							Save Task
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// HELPER COMPONENTS
function SidebarItem({
	icon,
	label,
	active,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	active?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			onClick={onClick}
			className="hover:bg-(--bg) bg-(--bg-secondary) w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition cursor-pointer"
			style={{
				backgroundColor: active ? "var(--link)" : "",
				color: active ? "#ffffff" : "var(--text)",
			}}
		>
			<div className="flex items-center gap-2.5">
				{icon}
				<span>{label}</span>
			</div>
		</Button>
	);
}

function StatCard({
	title,
	value,
	icon,
}: {
	title: string;
	value: string | number;
	icon: React.ReactNode;
}) {
	return (
		<Card
			style={{
				backgroundColor: "var(--bg-secondary)",
				borderColor: "var(--border)",
			}}
		>
			<CardContent className="p-4 space-y-1">
				<div
					className="flex items-center justify-between"
					style={{ color: "var(--text-secondary)" }}
				>
					<span className="text-xs font-medium">{title}</span>
					{icon}
				</div>
				<p className="text-2xl font-bold" style={{ color: "var(--text)" }}>
					{value}
				</p>
			</CardContent>
		</Card>
	);
}

function PriorityBadge({ priority }: { priority: string }) {
	const variants: Record<string, "secondary" | "outline" | "destructive"> = {
		LOW: "secondary",
		MEDIUM: "outline",
		HIGH: "outline",
		URGENT: "destructive",
	};
	return (
		<Badge
			variant={variants[priority] || "outline"}
			className="text-[10px] uppercase"
		>
			{priority}
		</Badge>
	);
}

function StatusBadge({ status }: { status: string }) {
	return (
		<Badge
			variant={status === "COMPLETED" ? "default" : "secondary"}
			className="text-[10px]"
		>
			{status.replace("_", " ")}
		</Badge>
	);
}
