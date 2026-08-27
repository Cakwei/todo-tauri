import { createFileRoute } from "@tanstack/react-router";
import {
	BarChart2,
	Calendar as CalendarIcon,
	CheckCircle2,
	CheckSquare,
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

// Imports
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
	component: TodoDashboard,
});

// --- MOCK DATA MATCHING YOUR PRISMA SCHEMA ---
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

const MOCK_TODOS = [
	{
		id: "todo-1",
		title: "Implement drag-and-drop fractional reordering",
		description:
			"Use position float column to allow seamless reordering without updating all index rows.",
		status: "IN_PROGRESS",
		priority: "HIGH",
		dueDate: "2026-08-28T10:00:00Z",
		estimatedMinutes: 120,
		actualMinutes: 45,
		isPinned: true,
		projectName: "Side Project",
		tags: ["Frontend"],
		subtaskCount: 3,
		attachmentsCount: 1,
	},
	{
		id: "todo-2",
		title: "Configure MySQL composite indexes for high-read throughput",
		description:
			"Index (userId, status) and (userId, dueDate) for quick sidebar filtering.",
		status: "TODO",
		priority: "URGENT",
		dueDate: "2026-08-27T18:00:00Z",
		estimatedMinutes: 60,
		actualMinutes: 0,
		isPinned: false,
		projectName: "Work & Engineering",
		tags: ["Database", "Critical"],
		subtaskCount: 0,
		attachmentsCount: 2,
	},
	{
		id: "todo-3",
		title: "Setup RRULE recurrence parser for repeating tasks",
		description: "Integrate rrule.js to generate next instance when completed.",
		status: "COMPLETED",
		priority: "MEDIUM",
		dueDate: "2026-08-26T12:00:00Z",
		estimatedMinutes: 90,
		actualMinutes: 85,
		isPinned: false,
		projectName: "Personal Growth",
		tags: [],
		subtaskCount: 1,
		attachmentsCount: 0,
	},
];

function TodoDashboard() {
	const [todos, setTodos] = useState(MOCK_TODOS);
	const [activeTab, setActiveTab] = useState("inbox");
	const [searchQuery, setSearchQuery] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const toggleComplete = (id: string) => {
		setTodos((prev) =>
			prev.map((t) =>
				t.id === id
					? { ...t, status: t.status === "COMPLETED" ? "TODO" : "COMPLETED" }
					: t,
			),
		);
	};

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
					{/* User Workspace Info */}
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

					{/* Core Navigation Views */}
					<nav className="space-y-1">
						<SidebarItem
							icon={
								<Inbox className="w-4 h-4" style={{ color: "var(--text)" }} />
							}
							label="Inbox"
							count={todos.filter((t) => t.status !== "COMPLETED").length}
							active={activeTab === "inbox"}
							onClick={() => setActiveTab("inbox")}
						/>
						<SidebarItem
							icon={<CalendarIcon className="w-4 h-4 text-emerald-500" />}
							label="Today"
							count={1}
							active={activeTab === "today"}
							onClick={() => setActiveTab("today")}
						/>
						<SidebarItem
							icon={<Clock className="w-4 h-4 text-amber-500" />}
							label="Upcoming"
							active={activeTab === "upcoming"}
							onClick={() => setActiveTab("upcoming")}
						/>
						<SidebarItem
							icon={<CheckSquare className="w-4 h-4 text-blue-500" />}
							label="Completed"
							count={todos.filter((t) => t.status === "COMPLETED").length}
							active={activeTab === "completed"}
							onClick={() => setActiveTab("completed")}
						/>
					</nav>

					{/* Projects Section */}
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
									className="bg-(--bg-secondary) w-full flex justify-start hover:bg-(--bg)  px-2.5 py-1.5 rounded-md text-xs transition"
								>
									<span className={`w-2 h-2 rounded-full ${proj.color}`} />
									<span className="truncate text-(--text)">{proj.name}</span>
								</Button>
							))}
						</div>
					</div>

					{/* Tags Section */}
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

				{/* User Footer Profile */}
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
								placeholder="Search tasks, descriptions, or tags..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
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

				{/* Scrollable Dashboard View */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* Dashboard Metrics Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<StatCard
							title="Total Tasks"
							value={todos.length}
							icon={<CheckSquare style={{ color: "var(--link)" }} />}
						/>
						<StatCard
							title="In Progress"
							value={todos.filter((t) => t.status === "IN_PROGRESS").length}
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

					{/* Tasks Main Container */}
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
								Tasks & Subtasks
							</CardTitle>
							<span
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Sorted by Position Index
							</span>
						</CardHeader>
						<CardContent
							className="p-0 divide-y"
							style={{ borderColor: "var(--border)" }}
						>
							{todos.map((todo) => (
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

										<Button
											onClick={() => toggleComplete(todo.id)}
											className="mt-0.5"
										>
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

											{/* Meta Information */}
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

									{/* Status & Priority Badges */}
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
							))}
						</CardContent>
					</Card>
				</div>
			</main>

			{/* 3. SHADCN DIALOG FOR NEW TASK CREATION */}
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
								placeholder="Add details, markdown supported..."
								className="mt-1"
								rows={3}
								style={{
									backgroundColor: "var(--bg)",
									borderColor: "var(--border)",
									color: "var(--text)",
								}}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label
									className="text-xs font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-secondary)" }}
								>
									Priority
								</Label>
								<Select defaultValue="MEDIUM">
									<SelectTrigger
										className="mt-1"
										style={{
											backgroundColor: "var(--bg)",
											borderColor: "var(--border)",
										}}
									>
										<SelectValue placeholder="Priority" />
									</SelectTrigger>
									<SelectContent
										style={{
											backgroundColor: "var(--bg-secondary)",
											borderColor: "var(--border)",
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
									className="text-xs font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-secondary)" }}
								>
									Project
								</Label>
								<Select>
									<SelectTrigger
										className="mt-1"
										style={{
											backgroundColor: "var(--bg)",
											borderColor: "var(--border)",
										}}
									>
										<SelectValue placeholder="Select Project" />
									</SelectTrigger>
									<SelectContent
										style={{
											backgroundColor: "var(--bg-secondary)",
											borderColor: "var(--border)",
										}}
									>
										{MOCK_PROJECTS.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
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

// --- HELPER COMPONENTS ---

function SidebarItem({
	icon,
	label,
	count,
	active,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	count?: number;
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
			{count !== undefined && (
				<Badge
					variant="secondary"
					className="text-[10px] px-1.5 py-0 h-5"
					style={{
						backgroundColor: active ? "rgba(255,255,255,0.2)" : "var(--bg)",
						color: active ? "#ffffff" : "var(--text-secondary)",
					}}
				>
					{count}
				</Badge>
			)}
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
