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
	Sparkles,
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

export type TodoInspectorProps = {
	todo: OfflineTodo | null;
	allTags: Array<{ id: string; name: string; color?: string | null }>;
	isOnline: boolean;
	onSave: (
		todoId: string,
		payload: {
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
		},
	) => void;
	onDelete: (id: string) => void;
	onUpdateTags: (todoId: string, tagIds: string[]) => void;
	onCreateSubtask: (parentId: string, title: string) => void;
	onToggleSubtask: (subtask: OfflineTodo) => void;
	onAddAttachment: (todoId: string, name: string, url: string) => void;
	onDeleteAttachment: (todoId: string, attachmentId: string) => void;
};

export function TodoInspector({
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
}: TodoInspectorProps) {
	const [title, setTitle] = useState(todo?.title ?? "");
	const [description, setDescription] = useState(todo?.description ?? "");
	const [priority, setPriority] = useState<OfflineTodo["priority"]>(
		todo?.priority ?? "MEDIUM",
	);
	const [status, setStatus] = useState<OfflineTodo["status"]>(
		todo?.status ?? "IN_PROGRESS",
	);
	const [isPinned, setIsPinned] = useState(Boolean(todo?.isPinned));
	const [dueDate, setDueDate] = useState<Date | null>(
		todo?.dueDate ? new Date(todo.dueDate) : null,
	);
	const [dueTime, setDueTime] = useState(
		todo?.dueDate ? new Date(todo.dueDate).toTimeString().slice(0, 5) : "",
	);
	const [reminderAt, setReminderAt] = useState<string>(
		todo?.reminderAt ? new Date(todo.reminderAt).toISOString().slice(0, 16) : "",
	);
	const [recurrence, setRecurrence] = useState<string>(
		todo?.recurrence || "none",
	);
	const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
		todo?.estimatedMinutes != null ? String(todo.estimatedMinutes) : "",
	);
	const [actualMinutes, setActualMinutes] = useState<string>(
		todo?.actualMinutes != null ? String(todo.actualMinutes) : "",
	);
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

	const [subtaskTitle, setSubtaskTitle] = useState("");
	const [attachName, setAttachName] = useState("");
	const [attachUrl, setAttachUrl] = useState("");
	const [showActivity, setShowActivity] = useState(false);

	useEffect(() => {
		if (!todo) return;
		setTitle(todo.title);
		setDescription(todo.description ?? "");
		setPriority(todo.priority);
		setStatus(todo.status);
		setIsPinned(Boolean(todo.isPinned));
		const d = todo.dueDate ? new Date(todo.dueDate) : null;
		setDueDate(d);
		setDueTime(d ? d.toTimeString().slice(0, 5) : "");
		setReminderAt(
			todo.reminderAt ? new Date(todo.reminderAt).toISOString().slice(0, 16) : "",
		);
		setRecurrence(todo.recurrence || "none");
		setEstimatedMinutes(
			todo.estimatedMinutes != null ? String(todo.estimatedMinutes) : "",
		);
		setActualMinutes(
			todo.actualMinutes != null ? String(todo.actualMinutes) : "",
		);
		setSubtaskTitle("");
		setAttachName("");
		setAttachUrl("");
	}, [todo]);

	const { data: activityLogs = [] } = useQuery({
		queryKey: ["todo-activity", todo?.id],
		queryFn: async () => {
			if (!todo) return [];
			const res = await axios.get(`/todos/${todo.id}/activity`);
			return (res.data?.data ?? []) as Array<{
				id: string;
				action: string;
				createdAt: string;
			}>;
		},
		enabled: Boolean(todo?.id) && showActivity && isOnline,
	});

	if (!todo) {
		return (
			<div className="flex h-full flex-col items-center justify-center p-8 text-center">
				<div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--border) bg-(--bg) text-[#1B4332] mb-4">
					<Sparkles className="h-5 w-5" />
				</div>
				<h3 className="font-editorial text-lg font-semibold text-(--text)">
					Task Inspector
				</h3>
				<p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-(--text-secondary)">
					Select any task from the stream to inspect subtasks, attachments,
					reminders, and activity.
				</p>
			</div>
		);
	}

	const subtasks = todo.children ?? [];
	const completedSubtasks = subtasks.filter(
		(s) => s.status === "COMPLETED",
	).length;
	const subtaskProgress =
		subtasks.length > 0
			? Math.round((completedSubtasks / subtasks.length) * 100)
			: 0;

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

		onSave(todo.id, {
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
	};

	return (
		<div className="flex h-full flex-col overflow-hidden bg-(--bg-secondary)">
			{/* Inspector Top Bar */}
			<div className="flex shrink-0 items-center justify-between border-b border-(--border) px-5 py-3.5">
				<div className="flex items-center gap-2">
					<span className="h-2 w-2 rounded-full bg-[#52B788]" />
					<span className="text-[11px] font-semibold uppercase tracking-widest text-(--text-secondary)">
						Inspector
					</span>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
						<Pin
							className={`h-3.5 w-3.5 ${
								isPinned ? "text-[#D97757]" : "text-(--text-secondary)"
							}`}
						/>
						<span>Pin</span>
						<Switch checked={isPinned} onCheckedChange={setIsPinned} />
					</div>
				</div>
			</div>

			{/* Scrollable Inspector Body */}
			<div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
				{/* Title */}
				<div className="space-y-1.5">
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						maxLength={255}
						placeholder="Task title..."
						className="font-editorial h-auto border-0 bg-transparent px-0 py-1 text-xl font-semibold text-(--text) shadow-none focus-visible:ring-0"
					/>
					<Textarea
						rows={3}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						maxLength={5000}
						placeholder="Add notes, context, or links..."
						className="resize-none rounded-md border-(--border) bg-(--bg) text-xs leading-relaxed text-(--text) placeholder:text-(--text-secondary)/60"
					/>
				</div>

				{/* Status & Priority */}
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
							Priority
						</Label>
						<Select
							value={priority}
							onValueChange={(v) => setPriority(v as OfflineTodo["priority"])}
						>
							<SelectTrigger className="h-9 rounded-md border-(--border) bg-(--bg) text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="border-(--border) bg-(--bg-secondary) text-(--text)">
								<SelectItem value="LOW">Low</SelectItem>
								<SelectItem value="MEDIUM">Medium</SelectItem>
								<SelectItem value="HIGH">High</SelectItem>
								<SelectItem value="URGENT">Urgent</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
							Status
						</Label>
						<Select
							value={status}
							onValueChange={(v) => setStatus(v as OfflineTodo["status"])}
						>
							<SelectTrigger className="h-9 rounded-md border-(--border) bg-(--bg) text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="border-(--border) bg-(--bg-secondary) text-(--text)">
								<SelectItem value="IN_PROGRESS">In Progress</SelectItem>
								<SelectItem value="LATE">Late</SelectItem>
								<SelectItem value="COMPLETED">Completed</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Schedule: Due Date + Time */}
				<div className="space-y-1.5">
					<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
						Due Date & Time
					</Label>
					<div className="flex gap-2">
						<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className="h-9 flex-1 justify-start rounded-md border-(--border) bg-(--bg) text-xs font-normal text-(--text)"
								>
									<CalendarDays className="mr-2 h-3.5 w-3.5 text-[#1B4332]" />
									{dueDate ? dueDate.toLocaleDateString() : "Pick a date"}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0 border-(--border) bg-(--bg-secondary)">
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
						<Input
							type="time"
							value={dueTime}
							onChange={(e) => setDueTime(e.target.value)}
							className="h-9 w-28 rounded-md border-(--border) bg-(--bg) text-xs"
						/>
						{dueDate && (
							<Button
								variant="ghost"
								size="sm"
								className="h-9 rounded-md px-2.5 text-xs text-(--text-secondary)"
								onClick={() => {
									setDueDate(null);
									setDueTime("");
								}}
							>
								Clear
							</Button>
						)}
					</div>
				</div>

				{/* Reminder & Recurrence */}
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
							Reminder
						</Label>
						<div className="relative">
							<Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--text-secondary)" />
							<Input
								type="datetime-local"
								value={reminderAt}
								onChange={(e) => setReminderAt(e.target.value)}
								className="h-9 rounded-md border-(--border) bg-(--bg) pl-8 text-[11px]"
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
							Recurrence
						</Label>
						<Select value={recurrence} onValueChange={setRecurrence}>
							<SelectTrigger className="h-9 rounded-md border-(--border) bg-(--bg) text-xs">
								<Repeat className="mr-1.5 h-3.5 w-3.5 text-[#1B4332]" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="border-(--border) bg-(--bg-secondary) text-(--text)">
								{RECURRENCE_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Estimates */}
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
							Est. Minutes
						</Label>
						<Input
							type="number"
							min={0}
							value={estimatedMinutes}
							onChange={(e) => setEstimatedMinutes(e.target.value)}
							placeholder="30"
							className="h-9 rounded-md border-(--border) bg-(--bg) text-xs"
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
							Actual Minutes
						</Label>
						<Input
							type="number"
							min={0}
							value={actualMinutes}
							onChange={(e) => setActualMinutes(e.target.value)}
							placeholder="25"
							className="h-9 rounded-md border-(--border) bg-(--bg) text-xs"
						/>
					</div>
				</div>

				{/* Tags */}
				{allTags.length > 0 && (
					<div className="space-y-2 border-t border-(--border) pt-4">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
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
					</div>
				)}

				{/* Subtasks with Sage Progress Bar */}
				<div className="space-y-2.5 border-t border-(--border) pt-4">
					<div className="flex items-center justify-between">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
							Subtasks
						</Label>
						<span className="text-[11px] font-semibold text-[#1B4332]">
							{completedSubtasks}/{subtasks.length}
						</span>
					</div>

					{subtasks.length > 0 && (
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-(--bg-subtle)">
							<div
								className="h-full rounded-full bg-[#52B788] transition-all duration-300"
								style={{ width: `${subtaskProgress}%` }}
							/>
						</div>
					)}

					<div className="space-y-1.5">
						{subtasks.map((sub) => (
							<div
								key={sub.id}
								className="flex items-center gap-2 rounded-md border border-(--border) bg-(--bg) px-3 py-2 text-xs"
							>
								<button
									type="button"
									onClick={() => onToggleSubtask(sub)}
									className="shrink-0"
								>
									{sub.status === "COMPLETED" ? (
										<CheckCircle2 className="h-4 w-4 text-[#52B788]" />
									) : (
										<Circle className="h-4 w-4 text-stone-400" />
									)}
								</button>
								<span
									className={
										sub.status === "COMPLETED"
											? "line-through text-(--text-secondary)"
											: "text-(--text)"
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
							className="h-8 rounded-md border-(--border) bg-(--bg) text-xs"
						/>
						<Button
							size="sm"
							variant="outline"
							className="h-8 rounded-md border-(--border) bg-(--bg) px-2.5"
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
				<div className="space-y-2 border-t border-(--border) pt-4">
					<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
						Attachments ({todo.attachments?.length ?? 0})
					</Label>
					<div className="space-y-1.5">
						{(todo.attachments ?? []).map((att) => (
							<div
								key={att.id}
								className="flex items-center justify-between rounded-md border border-(--border) bg-(--bg) px-3 py-1.5 text-xs"
							>
								<a
									href={att.url}
									target="_blank"
									rel="noreferrer"
									className="flex items-center gap-1.5 truncate font-medium text-[#1B4332] hover:underline"
								>
									<Link2 className="h-3.5 w-3.5 shrink-0" />
									<span className="truncate">{att.name}</span>
								</a>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 text-[#D97757] hover:bg-[#D97757]/10"
									onClick={() => onDeleteAttachment(todo.id, att.id)}
								>
									<Trash2 className="h-3 w-3" />
								</Button>
							</div>
						))}
					</div>
					<div className="grid grid-cols-5 gap-1.5">
						<Input
							placeholder="Label"
							value={attachName}
							onChange={(e) => setAttachName(e.target.value)}
							className="col-span-2 h-8 rounded-md border-(--border) bg-(--bg) text-xs"
						/>
						<Input
							placeholder="URL or path"
							value={attachUrl}
							onChange={(e) => setAttachUrl(e.target.value)}
							className="col-span-2 h-8 rounded-md border-(--border) bg-(--bg) text-xs"
						/>
						<Button
							size="sm"
							variant="outline"
							className="h-8 rounded-md border-(--border) bg-(--bg) text-xs"
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
					<div className="border-t border-(--border) pt-4">
						<button
							type="button"
							onClick={() => setShowActivity((prev) => !prev)}
							className="flex items-center gap-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--text)"
						>
							<History className="h-3.5 w-3.5" />
							{showActivity ? "Hide Activity Log" : "Show Activity Log"}
						</button>
						{showActivity && (
							<div className="mt-2.5 max-h-32 space-y-1.5 overflow-y-auto text-[11px] text-(--text-secondary)">
								{activityLogs.length === 0 ? (
									<p>No activity recorded yet.</p>
								) : (
									activityLogs.map((log) => (
										<div
											key={log.id}
											className="flex justify-between rounded-lg bg-(--bg) px-2.5 py-1.5"
										>
											<span className="font-medium text-(--text)">
												{log.action}
											</span>
											<span>
												{new Date(log.createdAt).toLocaleDateString()}
											</span>
										</div>
									))
								)}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Sticky Footer Actions */}
			<div className="flex shrink-0 items-center justify-between border-t border-(--border) bg-(--bg-secondary) px-5 py-3.5">
				<Button
					variant="ghost"
					size="sm"
					className="h-9 rounded-md text-xs font-medium text-[#D97757] hover:bg-[#D97757]/10 hover:text-[#D97757]"
					onClick={() => onDelete(todo.id)}
				>
					<Trash2 className="mr-1.5 h-3.5 w-3.5" />
					Delete
				</Button>
				<Button
					size="sm"
					onClick={handleSave}
					className="h-9 rounded-md bg-[#1B4332] px-5 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
				>
					Save Changes
				</Button>
			</div>
		</div>
	);
}
