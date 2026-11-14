import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isPermissionGrantedMock = vi.fn();
const requestPermissionMock = vi.fn();
const sendNotificationMock = vi.fn();

vi.mock("@tauri-apps/plugin-notification", () => ({
	isPermissionGranted: () => isPermissionGrantedMock(),
	requestPermission: () => requestPermissionMock(),
	sendNotification: (payload: unknown) => sendNotificationMock(payload),
}));

describe("notifications", () => {
	beforeEach(() => {
		vi.resetModules();
		isPermissionGrantedMock.mockReset();
		requestPermissionMock.mockReset();
		sendNotificationMock.mockReset();
		(globalThis as Record<string, unknown>).window = {
			__TAURI_INTERNALS__: {},
		};
	});

	afterEach(() => {
		delete (globalThis as Record<string, unknown>).window;
	});

	it("sends notification once for due IN_PROGRESS tasks when permission is granted", async () => {
		isPermissionGrantedMock.mockResolvedValue(true);
		const { checkAndNotifyDueTodos } = await import("#/lib/notifications");

		const dueSoon = new Date(Date.now() + 30_000).toISOString();
		const todos = [
			{
				id: "todo-1",
				title: "Submit report",
				status: "IN_PROGRESS",
				reminderAt: dueSoon,
				dueDate: null,
			},
			{
				id: "todo-2",
				title: "Already done",
				status: "COMPLETED",
				reminderAt: dueSoon,
				dueDate: null,
			},
		];

		await checkAndNotifyDueTodos(todos);
		expect(sendNotificationMock).toHaveBeenCalledTimes(1);
		expect(sendNotificationMock).toHaveBeenCalledWith({
			title: "Task Reminder",
			body: "Submit report",
		});

		// Second call with same todo should be deduplicated
		await checkAndNotifyDueTodos(todos);
		expect(sendNotificationMock).toHaveBeenCalledTimes(1);
	});

	it("does not send notifications when permission is denied", async () => {
		isPermissionGrantedMock.mockResolvedValue(false);
		requestPermissionMock.mockResolvedValue("denied");
		const { checkAndNotifyDueTodos } = await import("#/lib/notifications");

		await checkAndNotifyDueTodos([
			{
				id: "todo-3",
				title: "Should not fire",
				status: "IN_PROGRESS",
				dueDate: new Date(Date.now() + 10_000).toISOString(),
			},
		]);

		expect(sendNotificationMock).not.toHaveBeenCalled();
	});
});
