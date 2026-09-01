import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Store } from "@tauri-apps/plugin-store";
import { PendingComponent } from "#/components/ui/loading-component";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/__routes")({
	beforeLoad: async ({ location }) => {
		const store = await Store.load("app-settings.json");
		try {
			await store.reload();
		} catch (e) {
			console.error("app-settings.json not present, clearing store", e);
			await store.clear();
		}

		const token = store
			? await store.get<string>("better-auth.session_token")
			: undefined;

		const session = token
			? await authClient
					.getSession({
						fetchOptions: {
							headers: { authorization: `Bearer ${token}` },
						},
					})
					.then((res) => res.data)
					.catch((err) => {
						console.error("Failed to fetch session", err);
						return null;
					})
			: null;

		const isFirstTime = store
			? ((await store.get<boolean>("isFirstTime")) ?? true)
			: true;

		// console.log("test", { token, isFirstTime });

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
