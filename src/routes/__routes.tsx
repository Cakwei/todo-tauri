import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { PendingComponent } from "#/components/ui/loading-component";
import { authClient } from "#/lib/auth-client";
import { getAppStore, getSecureToken } from "#/lib/secure-token";

export const Route = createFileRoute("/__routes")({
	beforeLoad: async ({ location }) => {
		const store = await getAppStore();
		try {
			await store.reload();
		} catch (e) {
			console.error("app-settings.json not present, clearing store", e);
			await store.clear();
		}

		const token = await getSecureToken();

		let session = null;
		if (token) {
			try {
				const res = await authClient.getSession({
					fetchOptions: {
						headers: { authorization: `Bearer ${token}` },
					},
				});
				session = res.data;
				if (session?.user) {
					await store.set("cached_user", session);
					await store.save();
				}
			} catch (err) {
				console.warn(
					"Failed to fetch online session, checking offline cache:",
					err,
				);
				const cached = await store.get<typeof session>("cached_user");
				if (cached?.user && cached?.session) {
					session = cached;
				}
			}
		}

		const isFirstTime = store
			? ((await store.get<boolean>("isFirstTime")) ?? true)
			: true;

		if (isFirstTime && !session && location.pathname !== "/") {
			throw redirect({
				to: "/",
			});
		}

		if (
			!isFirstTime &&
			!location.pathname.startsWith("/dashboard") &&
			session
		) {
			throw redirect({
				to: "/dashboard",
				search: {
					limit: 10,
					page: 1,
					tab: "inbox",
				},
			});
		}

		return { session, isFirstTime };
	},
	pendingComponent: () => <PendingComponent />,
	component: Outlet,
});
