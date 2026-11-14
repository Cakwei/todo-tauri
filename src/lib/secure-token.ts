import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";

let storePromise: Promise<Store> | null = null;
let cachedToken: string | null | undefined;

export function getAppStore() {
	if (!storePromise) {
		storePromise = Store.load("app-settings.json");
	}
	return storePromise;
}

function isTauriEnv(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getSecureToken(): Promise<string | null> {
	if (cachedToken !== undefined) {
		return cachedToken;
	}

	if (isTauriEnv()) {
		try {
			const token = await invoke<string | null>("get_secure_token");
			if (token) {
				cachedToken = token;
				return token;
			}
		} catch (e) {
			console.warn("Keychain read failed, falling back to store:", e);
		}
	}

	try {
		const store = await getAppStore();
		const fallback = await store.get<string>("better-auth.session_token");
		cachedToken = fallback ?? null;
		return cachedToken;
	} catch {
		return null;
	}
}

export async function setSecureToken(token: string): Promise<void> {
	cachedToken = token;
	if (isTauriEnv()) {
		try {
			await invoke("set_secure_token", { token });
			// Clean up any legacy plaintext token in app-settings.json
			const store = await getAppStore();
			await store.delete("better-auth.session_token");
			await store.save();
			return;
		} catch (e) {
			console.warn("Keychain write failed, falling back to store:", e);
		}
	}

	const store = await getAppStore();
	await store.set("better-auth.session_token", token);
	await store.save();
}

export async function deleteSecureToken(): Promise<void> {
	cachedToken = null;
	if (isTauriEnv()) {
		try {
			await invoke("delete_secure_token");
		} catch (e) {
			console.warn("Keychain delete failed:", e);
		}
	}

	try {
		const store = await getAppStore();
		await store.delete("better-auth.session_token");
		await store.delete("cached_user");
		await store.save();
	} catch {
		// Ignore store errors on sign out
	}
}
