import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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

const COLOR_PRESETS = [
	"#3b82f6",
	"#10b981",
	"#a855f7",
	"#ef4444",
	"#f59e0b",
	"#6366f1",
];

export function CreateProjectDialog({
	open,
	onOpenChange,
	onCreate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (data: { name: string; color: string }) => void;
}) {
	const [name, setName] = useState("");
	const [color, setColor] = useState(COLOR_PRESETS[0]);

	const handleSubmit = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		onCreate({ name: trimmed, color });
		setName("");
		setColor(COLOR_PRESETS[0]);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[380px]"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
					color: "var(--text)",
				}}
			>
				<DialogHeader>
					<DialogTitle className="text-base">New Project</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="space-y-1.5">
						<Label className="text-xs">Name</Label>
						<Input
							autoFocus
							placeholder="e.g. Work, Personal"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
							maxLength={191}
							style={{
								backgroundColor: "var(--bg)",
								borderColor: "var(--border)",
								color: "var(--text)",
							}}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs">Color</Label>
						<div className="flex items-center gap-2">
							{COLOR_PRESETS.map((c) => (
								<button
									key={c}
									type="button"
									onClick={() => setColor(c)}
									className={`h-6 w-6 rounded-full transition-transform ${
										color === c ? "scale-110 ring-2 ring-white" : "opacity-75"
									}`}
									style={{ backgroundColor: c }}
								/>
							))}
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!name.trim()}
						className="text-white"
						style={{ backgroundColor: "var(--link)" }}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function CreateTagDialog({
	open,
	onOpenChange,
	tags,
	onCreate,
	onDelete,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tags: Array<{ id: string; name: string; color?: string | null }>;
	onCreate: (data: { name: string; color: string }) => void;
	onDelete: (id: string) => void;
}) {
	const [name, setName] = useState("");
	const [color, setColor] = useState(COLOR_PRESETS[2]);

	const handleSubmit = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		onCreate({ name: trimmed, color });
		setName("");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[400px]"
				style={{
					backgroundColor: "var(--bg-secondary)",
					borderColor: "var(--border)",
					color: "var(--text)",
				}}
			>
				<DialogHeader>
					<DialogTitle className="text-base">Manage Tags</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="flex items-center gap-2">
						<Input
							placeholder="New tag name..."
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
							maxLength={50}
							style={{
								backgroundColor: "var(--bg)",
								borderColor: "var(--border)",
								color: "var(--text)",
							}}
						/>
						<Button
							size="sm"
							onClick={handleSubmit}
							disabled={!name.trim()}
							className="text-white shrink-0"
							style={{ backgroundColor: "var(--link)" }}
						>
							<Plus className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex items-center gap-2">
						{COLOR_PRESETS.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setColor(c)}
								className={`h-5 w-5 rounded-full ${
									color === c ? "ring-2 ring-white" : "opacity-70"
								}`}
								style={{ backgroundColor: c }}
							/>
						))}
					</div>

					<div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
						{tags.length === 0 ? (
							<p className="text-xs opacity-60">No tags yet.</p>
						) : (
							tags.map((tag) => (
								<div
									key={tag.id}
									className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs"
									style={{ backgroundColor: "var(--bg)" }}
								>
									<span className="flex items-center gap-2">
										<span
											className="h-2.5 w-2.5 rounded-full"
											style={{ backgroundColor: tag.color || "#6366f1" }}
										/>
										#{tag.name}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 text-red-400 hover:text-red-500"
										onClick={() => onDelete(tag.id)}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							))
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
