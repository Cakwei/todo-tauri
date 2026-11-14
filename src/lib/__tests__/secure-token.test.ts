import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const storeMock = {
	get: vi.fn(),
	set: vi.fn(),
	delete: vi.fn(),
	save: vi.fn(),
};

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
	Store: {
		load: vi.fn(async () => storeMock),
	},
}));

describe("secure-token", () => {
	beforeEach(() => {
		vi.resetModules();
		invokeMock.mockReset();
		storeMock.get.mockReset();
		storeMock.set.mockReset();
		storeMock.delete.mockReset();
		storeMock.save.mockReset();
		(globalThis as Record<string, unknown>).window = {
			__TAURI_INTERNALS__: {},
		};
	});

	afterEach(() => {
		delete (globalThis as Record<string, unknown>).window;
	});

	it("reads token from OS keychain when running in Tauri", async () => {
		invokeMock.mockResolvedValueOnce("keychain-token-123");
		const { getSecureToken } = await import("#/lib/secure-token");

		const token = await getSecureToken();
		expect(token).toBe("keychain-token-123");
		expect(invokeMock).toHaveBeenCalledWith("get_secure_token");
	});

	it("falls back to Store when keychain read fails", async () => {
		invokeMock.mockRejectedValueOnce(new Error("Keychain locked"));
		storeMock.get.mockResolvedValueOnce("store-fallback-token");
		const { getSecureToken } = await import("#/lib/secure-token");

		const token = await getSecureToken();
		expect(token).toBe("store-fallback-token");
	});

	it("saves token to keychain and removes legacy plaintext store entry", async () => {
		invokeMock.mockResolvedValueOnce(undefined);
		const { setSecureToken } = await import("#/lib/secure-token");

		await setSecureToken("new-secret-token");
		expect(invokeMock).toHaveBeenCalledWith("set_secure_token", {
			token: "new-secret-token",
		});
		expect(storeMock.delete).toHaveBeenCalledWith("better-auth.session_token");
		expect(storeMock.save).toHaveBeenCalled();
	});

	it("deletes token from both keychain and store on sign out", async () => {
		invokeMock.mockResolvedValueOnce(undefined);
		const { deleteSecureToken } = await import("#/lib/secure-token");

		await deleteSecureToken();
		expect(invokeMock).toHaveBeenCalledWith("delete_secure_token");
		expect(storeMock.delete).toHaveBeenCalledWith("better-auth.session_token");
		expect(storeMock.delete).toHaveBeenCalledWith("cached_user");
	});
});
