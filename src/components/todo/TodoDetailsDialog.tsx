import { useQuery } from "@tanstack/react-query";
import {
	CalendarDays,
	CheckCircle2,
	Circle,
	Clock,
	History,
	Link2,
	Pin,
	Plus,
	Repeat,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import type { OfflineTodo } from "#/lib/offline-db";
import { axios } from "#/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const RECURRENCE_OPTIONS = [
	{ label: "None", value: "none" },
	{ label: "Daily", value: "FREQ=DAILY" },
	{ label: "Weekly", value: "FREQ=WEEKLY" },
	{ label: "Monthly", value: "FREQ=MONTHLY" },
];

type TodoDetailsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	todo: OfflineTodo;
	allTags: Array<{ id: string; name: string; color?: string | null }>;
	isOnline: boolean;
	onSave: (payload: {
		title: string;
		description: string | null;
		priority: OfflineTodo["priority"];
		status: OfflineTodo["status"];
		dueDate: Date | null;
		reminderAt: Date | null;
		recurrence: string | null;
		estimatedMinutes: number | null;
		actualMinutes: number | null;
		isPinned: boolean;
	}) => void;
	onDelete: (id: string) => void;
	onUpdateTags: (todoId: string, tagIds: string[]) => void;
	onCreateSubtask: (parentId: string, title: string) => void;
	onToggleSubtask: (subtask: OfflineTodo) => void;
	onAddAttachment: (todoId: string, name: string, url: string) => void;
	onDeleteAttachment: (todoId: string, attachmentId: string) => void;
};

export function TodoDetailsDialog({
	open,
	onOpenChange,
	todo,
	allTags,
	isOnline,
	onSave,
	onDelete,
	onUpdateTags,
	onCreateSubtask,
	onToggleSubtask,
	onAddAttachment,
	onDeleteAttachment,
}: TodoDetailsDialogProps) {
	const [title, setTitle] = useState(todo.title);
	const [description, setDescription] = useState(todo.description ?? "");
	const [priority, setPriority] = useState<OfflineTodo["priority"]>(
		todo.priority,
	);
	const [status, setStatus] = useState<OfflineTodo["status"]>(todo.status);
	const [isPinned, setIsPinned] = useState(Boolean(todo.isPinned));
	const [dueDate, setDueDate] = useState<Date | null>(
		todo.dueDate ? new Date(todo.dueDate) : null,
	);
	const [dueTime, setDueTime] = useState(
		todo.dueDate ? new Date(todo.dueDate).toTimeString().slice(0, 5) : "",
	);
	const [reminderAt, setReminderAt] = useState<string>(
		todo.reminderAt ? new Date(todo.reminderAt).toISOString().slice(0, 16) : "",
	);
	const [recurrence, setRecurrence] = useState<string>(
		todo.recurrence || "none",
	);
	const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
		todo.estimatedMinutes != null ? String(todo.estimatedMinutes) : "",
	);
	const [actualMinutes, setActualMinutes] = useState<string>(
		todo.actualMinutes != null ? String(todo.actualMinutes) : "",
	);
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

	const [subtaskTitle, setSubtaskTitle] = useState("");
	const [attachName, setAttachName] = useState("");
	const [attachUrl, setAttachUrl] = useState("");
	const [showActivity, setShowActivity] = useState(false);

	useEffect(() => {
		if (open) {
			setTitle(todo.title);
			setDescription(todo.description ?? "");
			setPriority(todo.priority);
			setStatus(todo.status);
			setIsPinned(Boolean(todo.isPinned));
			const d = todo.dueDate ? new Date(todo.dueDate) : null;
			setDueDate(d);
			setDueTime(d ? d.toTimeString().slice(0, 5) : "");
			setReminderAt(
				todo.reminderAt
					? new Date(todo.reminderAt).toISOString().slice(0, 16)
					: "",
			);
			setRecurrence(todo.recurrence || "none");
			setEstimatedMinutes(
				todo.estimatedMinutes != null ? String(todo.estimatedMinutes) : "",
			);
			setActualMinutes(
				todo.actualMinutes != null ? String(todo.actualMinutes) : "",
			);
		}
	}, [open, todo]);

	const { data: activityLogs = [] } = useQuery({
		queryKey: ["todo-activity", todo.id],
		queryFn: async () => {
			const res = await axios.get(`/todos/${todo.id}/activity`);
			return (res.data?.data ?? []) as Array<{
				id: string;
				action: string;
				createdAt: string;
			}>;
		},
		enabled: open && showActivity && isOnline,
	});

	const assignedTagIds = new Set((todo.tags ?? []).map((t) => t.tagId));

	const toggleTag = (tagId: string) => {
		const next = new Set(assignedTagIds);
		if (next.has(tagId)) {
			next.delete(tagId);
		} else {
			next.add(tagId);
		}
		onUpdateTags(todo.id, Array.from(next));
	};

	const handleSave = () => {
		let finalDueDate: Date | null = null;
		if (dueDate) {
			finalDueDate = new Date(dueDate);
			if (dueTime) {
				const [h, m] = dueTime.split(":");
				finalDueDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
			} else {
				finalDueDate.setHours(0, 0, 0, 0);
			}
		}

		onSave({
			title: title.trim() || todo.title,
			description: description.trim() || null,
			priority,
			status,
			dueDate: finalDueDate,
			reminderAt: reminderAt ? new Date(reminderAt) : null,
			recurrence: recurrence === "none" ? null : recurrence,
			estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
			actualMinutes: actualMinutes ? Number(actualMinutes) : null,
			isPinned,
		});
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[540px] max-h-[88vh] overflow-y-auto"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
					color: "var(--text)",
				}}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center justify-between pr-6">
						<span>Todo Details</span>
						<div className="flex items-center gap-2 text-xs font-normal">
							<Pin className="h-3.5 w-3.5 text-amber-500" />
							<span>Pin</span>
							<Switch checked={isPinned} onCheckedChange={setIsPinned} />
						</div>
					</DialogTitle>
				</DialogHeader>

				<div className="grid gap-4 py-2">
					<div className="grid gap-1.5">
						<Label
							className="text-xs"
							style={{ color: "var(--text-secondary)" }}
						>
							Title
						</Label>
						<Input
							className="bg-(--bg)"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={255}
						/>
					</div>

					<div className="grid gap-1.5">
						<Label
							className="text-xs"
							style={{ color: "var(--text-secondary)" }}
						>
							Description
						</Label>
						<Textarea
							className="bg-(--bg)"
							rows={3}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={5000}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Priority
							</Label>
							<Select
								value={priority}
								onValueChange={(v) => setPriority(v as OfflineTodo["priority"])}
							>
								<SelectTrigger className="bg-(--bg) text-xs h-9">
									<SelectValue />
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

						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Status
							</Label>
							<Select
								value={status}
								onValueChange={(v) => setStatus(v as OfflineTodo["status"])}
							>
								<SelectTrigger className="bg-(--bg) text-xs h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent
									style={{
										backgroundColor: "var(--bg-secondary)",
										borderColor: "var(--border)",
										color: "var(--text)",
									}}
								>
									<SelectItem value="IN_PROGRESS">In Progress</SelectItem>
									<SelectItem value="LATE">Late</SelectItem>
									<SelectItem value="COMPLETED">Completed</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Due Date
							</Label>
							<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className="w-full justify-start text-left font-normal text-xs h-9 bg-(--bg)"
									>
										<CalendarDays className="mr-2 h-3.5 w-3.5 opacity-70" />
										{dueDate ? dueDate.toLocaleDateString() : "Pick date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={dueDate ?? undefined}
										onSelect={(d) => {
											setDueDate(d ?? null);
											setIsCalendarOpen(false);
										}}
									/>
								</PopoverContent>
							</Popover>
						</div>

						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Due Time
							</Label>
							<div className="relative">
								<Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70" />
								<Input
									type="time"
									value={dueTime}
									onChange={(e) => setDueTime(e.target.value)}
									className="pl-8 text-xs h-9 bg-(--bg)"
								/>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Reminder
							</Label>
							<Input
								type="datetime-local"
								value={reminderAt}
								onChange={(e) => setReminderAt(e.target.value)}
								className="text-xs h-9 bg-(--bg)"
							/>
						</div>

						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Recurrence
							</Label>
							<Select value={recurrence} onValueChange={setRecurrence}>
								<SelectTrigger className="bg-(--bg) text-xs h-9">
									<Repeat className="mr-1.5 h-3.5 w-3.5 opacity-70" />
									<SelectValue />
								</SelectTrigger>
								<SelectContent
									style={{
										backgroundColor: "var(--bg-secondary)",
										borderColor: "var(--border)",
										color: "var(--text)",
									}}
								>
									{RECURRENCE_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Estimated (min)
							</Label>
							<Input
								type="number"
								min={0}
								value={estimatedMinutes}
								onChange={(e) => setEstimatedMinutes(e.target.value)}
								placeholder="e.g. 30"
								className="text-xs h-9 bg-(--bg)"
							/>
						</div>

						<div className="grid gap-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Actual (min)
							</Label>
							<Input
								type="number"
								min={0}
								value={actualMinutes}
								onChange={(e) => setActualMinutes(e.target.value)}
								placeholder="e.g. 25"
								className="text-xs h-9 bg-(--bg)"
							/>
						</div>
					</div>

					{/* Tags */}
					{allTags.length > 0 && (
						<div className="space-y-1.5">
							<Label
								className="text-xs"
								style={{ color: "var(--text-secondary)" }}
							>
								Tags
							</Label>
							<div className="flex flex-wrap gap-1.5">
								{allTags.map((tag) => {
									const active = assignedTagIds.has(tag.id);
									return (
										<button
											key={tag.id}
											type="button"
											onClick={() => toggleTag(tag.id)}
											className={`rounded-full px-2.5 py-0.5 text-[11px] border transition-colors ${
												active
													? "bg-(--link) text-white border-(--link)"
													: "bg-(--bg) border-(--border) opacity-75 hover:opacity-100"
											}`}
										>
											#{tag.name}
										</button>
									);
								})}
							</div>
						</div>
					)}

					{/* Subtasks */}
					<div
						className="space-y-2 border-t pt-3"
						style={{ borderColor: "var(--border)" }}
					>
						<Label
							className="text-xs"
							style={{ color: "var(--text-secondary)" }}
						>
							Subtasks ({todo.children?.length ?? 0})
						</Label>
						<div className="space-y-1.5">
							{(todo.children ?? []).map((sub) => (
								<div
									key={sub.id}
									className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs bg-(--bg)"
								>
									<button
										type="button"
										onClick={() => onToggleSubtask(sub)}
										className="shrink-0"
									>
										{sub.status === "COMPLETED" ? (
											<CheckCircle2 className="h-4 w-4 text-emerald-500" />
										) : (
											<Circle className="h-4 w-4 opacity-60" />
										)}
									</button>
									<span
										className={
											sub.status === "COMPLETED"
												? "line-through opacity-60"
												: ""
										}
									>
										{sub.title}
									</span>
								</div>
							))}
						</div>
						<div className="flex gap-2">
							<Input
								placeholder="Add a subtask..."
								value={subtaskTitle}
								onChange={(e) => setSubtaskTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && subtaskTitle.trim()) {
										onCreateSubtask(todo.id, subtaskTitle.trim());
										setSubtaskTitle("");
									}
								}}
								className="h-8 text-xs bg-(--bg)"
							/>
							<Button
								size="sm"
								variant="outline"
								className="h-8 px-2.5"
								disabled={!subtaskTitle.trim()}
								onClick={() => {
									onCreateSubtask(todo.id, subtaskTitle.trim());
									setSubtaskTitle("");
								}}
							>
								<Plus className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>

					{/* Attachments */}
					<div
						className="space-y-2 border-t pt-3"
						style={{ borderColor: "var(--border)" }}
					>
						<Label
							className="text-xs"
							style={{ color: "var(--text-secondary)" }}
						>
							Attachments ({todo.attachments?.length ?? 0})
						</Label>
						<div className="space-y-1">
							{(todo.attachments ?? []).map((att) => (
								<div
									key={att.id}
									className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs bg-(--bg)"
								>
									<a
										href={att.url}
										target="_blank"
										rel="noreferrer"
										className="flex items-center gap-1.5 truncate text-(--link) hover:underline"
									>
										<Link2 className="h-3.5 w-3.5 shrink-0" />
										<span className="truncate">{att.name}</span>
									</a>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 text-red-400"
										onClick={() => onDeleteAttachment(todo.id, att.id)}
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
							))}
						</div>
						<div className="grid grid-cols-5 gap-2">
							<Input
								placeholder="Label"
								value={attachName}
								onChange={(e) => setAttachName(e.target.value)}
								className="col-span-2 h-8 text-xs bg-(--bg)"
							/>
							<Input
								placeholder="https://... or file path"
								value={attachUrl}
								onChange={(e) => setAttachUrl(e.target.value)}
								className="col-span-2 h-8 text-xs bg-(--bg)"
							/>
							<Button
								size="sm"
								variant="outline"
								className="h-8 text-xs"
								disabled={!attachName.trim() || !attachUrl.trim()}
								onClick={() => {
									onAddAttachment(todo.id, attachName.trim(), attachUrl.trim());
									setAttachName("");
									setAttachUrl("");
								}}
							>
								Add
							</Button>
						</div>
					</div>

					{/* Activity Log */}
					{isOnline && (
						<div
							className="border-t pt-3"
							style={{ borderColor: "var(--border)" }}
						>
							<button
								type="button"
								onClick={() => setShowActivity((prev) => !prev)}
								className="flex items-center gap-1.5 text-xs opacity-75 hover:opacity-100"
							>
								<History className="h-3.5 w-3.5" />
								{showActivity ? "Hide Activity Log" : "Show Activity Log"}
							</button>
							{showActivity && (
								<div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-[11px] opacity-80">
									{activityLogs.length === 0 ? (
										<p>No activity recorded yet.</p>
									) : (
										activityLogs.map((log) => (
											<div key={log.id} className="flex justify-between">
												<span>{log.action}</span>
												<span>{new Date(log.createdAt).toLocaleString()}</span>
											</div>
										))
									)}
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter className="flex items-center justify-between sm:justify-between">
					<Button
						variant="outline"
						className="border-red-500/40 text-red-400 hover:bg-red-500/10"
						onClick={() => {
							onDelete(todo.id);
							onOpenChange(false);
						}}
					>
						<Trash2 className="mr-1.5 h-3.5 w-3.5" />
						Delete
					</Button>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							style={{ backgroundColor: "var(--link)", color: "#ffffff" }}
						>
							Save Changes
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
