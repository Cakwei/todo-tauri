import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/__routes/__auth")({
	beforeLoad: ({ context }) => {
		const session = context.session;
		if (session) {
			throw redirect({
				to: "/dashboard",
				search: { page: 1, limit: 10, tab: "" },
			});
		}
	},
	component: Outlet,
});
