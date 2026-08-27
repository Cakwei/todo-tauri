import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Github, Loader2, Lock, Mail } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { authClient } from "#/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/__routes/login/")({
	component: Login,
});
function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const handleEmailLogin = async (e: SubmitEvent) => {
		try {
			e.preventDefault();
			setIsLoading(true);
			setErrorMessage(null);

			await authClient.signIn.email(
				{
					email: email,
					password: password,
				},
				{
					onSuccess: () => {
						console.log("success");
						window.location.href = "/";
					},
					onError: (ctx) => {
						console.log("onError", ctx);
						setErrorMessage(ctx.error.message || "Failed to sign in");
						setIsLoading(false);
					},
				},
			);
		} catch (e) {
			console.error(e);
		}
	};

	const handleSocialLogin = async (provider: "github" | "google") => {
		await authClient.signIn.social({
			provider,
			callbackURL: "/",
		});
	};

	return (
		<div className="flex min-h-screen w-full items-center justify-center p-4 bg-(--bg) text-(--text)">
			<Card className="w-full max-w-md bg-(--bg-secondary) border-(--border)">
				<CardHeader className="space-y-1">
					<CardTitle className="text-xl font-bold">Sign in</CardTitle>
					<CardDescription className="text-xs text-(--text-secondary)">
						Enter your credentials to test your BetterAuth endpoint
					</CardDescription>
				</CardHeader>

				<form onSubmit={handleEmailLogin}>
					<CardContent className="space-y-4">
						{errorMessage && (
							<div className="flex items-center gap-2 p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{errorMessage}</span>
							</div>
						)}

						<div className="space-y-1.5">
							<Label className="text-xs uppercase font-semibold text-(--text-secondary)">
								Email Address
							</Label>
							<div className="relative">
								<Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-(--text-secondary)" />
								<Input
									type="email"
									placeholder="name@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									className="pl-9 h-9 bg-(--bg) border-(--border)"
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs uppercase font-semibold text-(--text-secondary)">
								Password
							</Label>
							<div className="relative">
								<Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-(--text-secondary)" />
								<Input
									type="password"
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									className="pl-9 h-9 bg-(--bg) border-(--border)"
								/>
							</div>
						</div>

						<Button
							type="submit"
							disabled={isLoading}
							className="w-full text-white mt-2"
							style={{ backgroundColor: "var(--link)" }}
						>
							{isLoading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								"Sign In"
							)}
						</Button>
					</CardContent>
				</form>

				<div className="px-6 pb-2">
					<div className="relative flex items-center justify-center text-xs uppercase my-2">
						<span className="bg-(--bg-secondary) px-2 text-(--text-secondary) z-10">
							Or continue with
						</span>
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t border-(--border)" />
						</div>
					</div>
				</div>

				<CardFooter className="flex gap-2">
					<Button
						variant="outline"
						className="w-full gap-2 text-xs border-(--border)"
						onClick={() => handleSocialLogin("github")}
					>
						<Github className="w-4 h-4" />
						GitHub
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
