import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";

const notifiedIds = new Set<string>();

function isTauriEnv(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function ensureNotificationPermission(): Promise<boolean> {
	if (!isTauriEnv()) return false;
	try {
		let granted = await isPermissionGranted();
		if (!granted) {
			const permission = await requestPermission();
			granted = permission === "granted";
		}
		return granted;
	} catch {
		return false;
	}
}

export async function checkAndNotifyDueTodos(
	todos: Array<{
		id: string;
		title: string;
		status: string;
		reminderAt?: string | null;
		dueDate?: string | null;
	}>,
): Promise<void> {
	if (!isTauriEnv() || todos.length === 0) return;

	const granted = await ensureNotificationPermission();
	if (!granted) return;

	const now = Date.now();
	const windowMs = 60_000; // Notify when within 1 minute of reminderAt or dueDate

	for (const todo of todos) {
		if (todo.status === "COMPLETED") continue;
		const targetIso = todo.reminderAt || todo.dueDate;
		if (!targetIso) continue;

		const key = `${todo.id}:${targetIso}`;
		if (notifiedIds.has(key)) continue;

		const targetTime = new Date(targetIso).getTime();
		if (Number.isNaN(targetTime)) continue;

		if (targetTime <= now + windowMs && targetTime >= now - 15 * 60_000) {
			notifiedIds.add(key);
			sendNotification({
				title: todo.reminderAt ? "Task Reminder" : "Task Due Soon",
				body: todo.title,
			});
		}
	}
}
