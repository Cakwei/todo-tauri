import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/__routes/__protected")({
	component: () => <Outlet />,
	beforeLoad: async ({ context }) => {
		const session = context.session;
		
		if (!session?.session || !session.user) {
			throw redirect({
				to: "/login",
			});
		}
	},
});
