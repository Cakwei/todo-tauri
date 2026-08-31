import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Github,
	Loader2,
	Lock,
	Mail,
	User2,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { authClient } from "#/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/__routes/__auth/login/")({
	component: Login,
});

function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const navigate = useNavigate();

	const handleEmailLogin = async (e: FormEvent) => {
		e.preventDefault();
		try {
			setIsLoading(true);
			setErrorMessage(null);

			await authClient.signIn.email(
				{
					email: email,
					password: password,
				},
				{
					onSuccess: async () => {
						window.location.href = "/dashboard";
					},
					onError: (ctx) => {
						setErrorMessage(ctx.error.message || "Failed to sign in");
						setIsLoading(false);
					},
				},
			);
		} catch (e) {
			console.error(e);
			setIsLoading(false);
		}
	};

	const handleSocialLogin = async (provider: "github" | "google") => {
		await authClient.signIn.social({
			provider,
			callbackURL: "/",
		});
	};

	return (
		<div className="relative flex flex-col h-screen w-screen bg-(--bg) text-(--text) select-none overflow-hidden font-sans">
			<Button
				onClick={() => navigate({ to: "/" })}
				className="absolute top-5 bg-(--bg) hover:bg-(--bg-secondary) left-5 flex items-center gap-2 text-xs text-(--text-secondary) hover:text-(--text) transition-colors"
			>
				<ArrowLeft className="w-4 h-4" />
				<span>Back</span>
			</Button>
			<main className="flex-1 flex flex-col items-center justify-center p-6 w-full">
				<Card className="w-full max-w-sm bg-(--bg-secondary) border-(--border) text-(--text) shadow-2xl backdrop-blur-md rounded-2xl">
					<CardHeader className="space-y-2 text-center pb-6">
						<div className="mx-auto w-12 h-12 rounded-2xl bg-(--bg) border border-(--border) flex items-center justify-center mb-1">
							<User2 className="w-6 h-6 text-(--link)" />
						</div>
						<CardTitle className="text-2xl font-bold tracking-tight text-(--text)">
							Welcome Back
						</CardTitle>
						<CardDescription className="text-sm text-(--text-secondary)">
							Sign in to sync your tasks and workspace across devices
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-4">
						<form onSubmit={handleEmailLogin} className="space-y-4">
							{errorMessage && (
								<div className="flex items-center gap-2.5 p-3 text-xs rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
									<AlertCircle className="w-4 h-4 shrink-0" />
									<span>{errorMessage}</span>
								</div>
							)}

							<div className="space-y-2">
								<Label className="text-xs uppercase font-semibold text-(--text-secondary) tracking-wider">
									Email Address
								</Label>
								<div className="relative">
									<Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-(--text-secondary)" />
									<Input
										type="email"
										placeholder="name@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										className="pl-10 h-10 bg-(--bg) text-sm border-(--border) text-(--text) placeholder:text-(--text-secondary)/50 focus-visible:ring-(--link) focus-visible:border-(--link) rounded-md"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label className="text-xs uppercase font-semibold text-(--text-secondary) tracking-wider">
									Password
								</Label>
								<div className="relative">
									<Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-(--text-secondary)" />
									<Input
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										className="pl-10 h-10 bg-(--bg) text-sm border-(--border) text-(--text) placeholder:text-(--text-secondary)/50 focus-visible:ring-(--link) focus-visible:border-(--link) rounded-md"
									/>
								</div>
							</div>

							<Button
								type="submit"
								disabled={isLoading}
								className="w-full h-10 rounded-md bg-(--link) hover:bg-(--link-hover) text-white font-medium text-sm transition-all active:scale-[0.98] mt-2 shadow-md shadow-indigo-950/40"
							>
								{isLoading ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									"Sign In"
								)}
							</Button>
						</form>

						<div className="relative flex items-center justify-center my-4">
							<span className="w-full border-t border-border" />
							<span className="absolute bg-(--bg-secondary) px-3 text-[10px] uppercase tracking-widest text-(--text-secondary)">
								Or
							</span>
						</div>

						<Button
							type="button"
							className="w-full h-10 gap-2.5 rounded-md border-(--border) bg-(--bg) hover:bg-(--bg)/50 ( text-(--text) text-xs font-medium transition-colors"
							onClick={() => handleSocialLogin("github")}
						>
							<Github className="w-4 h-4 text-(--text-secondary)" />
							Continue with GitHub
						</Button>
					</CardContent>

					{/* 	<CardFooter className="flex flex-col items-center pt-2 pb-6">
					 <button
                            type="button"
                            onClick={() =>
                                navigate({
                                    to: "/dashboard",
                                    search: { limit: 10, page: 1, tab: "" },
                                })
                            }
                            className="text-xs text-(--text-secondary) hover:text-(--text) underline underline-offset-4 transition-colors"
                        >
                            Skip & continue as guest
                        </button>
 

					</CardFooter> */}
				</Card>
			</main>
		</div>
	);
}
