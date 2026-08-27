import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/__routes/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="w-full h-dvh flex justify-center items-center">
			<Link to="/dashboard">
				<Button>Click me</Button>
			</Link>
		</div>
	);
}
