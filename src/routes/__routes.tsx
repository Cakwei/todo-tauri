import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PendingComponent } from "#/components/ui/loading-component";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/__routes")({
	beforeLoad: async () => {
		try {
			const session = (await authClient.getSession()).data;

			return { session };
		} catch (e) {
			console.error("RootDocument Error @", e);
			return { session: null };
		}
	},
	pendingComponent: () => <PendingComponent />,
	component: Outlet,
});
