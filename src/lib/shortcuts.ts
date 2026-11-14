import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

const QUICK_CAPTURE_SHORTCUT = "CommandOrControl+Shift+Space";

function isTauriEnv(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function registerQuickCaptureShortcut(
	onTrigger: () => void,
): Promise<() => void> {
	if (!isTauriEnv()) return () => {};

	let registered = false;
	try {
		await register(QUICK_CAPTURE_SHORTCUT, async (event) => {
			if (event.state === "Pressed") {
				try {
					const win = getCurrentWindow();
					await win.unminimize();
					await win.show();
					await win.setFocus();
				} catch {
					// Ignore window focus errors
				}
				onTrigger();
			}
		});
		registered = true;
	} catch (err) {
		console.warn("Failed to register global shortcut:", err);
	}

	return () => {
		if (registered) {
			void unregister(QUICK_CAPTURE_SHORTCUT).catch(() => {});
		}
	};
}
