import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Github,
	Loader2,
	Lock,
	Mail,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { authClient } from "#/lib/auth-client";
import { setSecureToken } from "#/lib/secure-token";
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
					onSuccess: async (ctx) => {
						const token = ctx.response.headers.get("set-auth-token") || "";
						if (token) {
							await setSecureToken(token);
						}
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
		<div className="relative flex min-h-dvh w-full flex-col bg-(--bg) text-(--text) select-none overflow-hidden font-sans">
			<header className="flex items-center justify-between px-6 py-5 sm:px-10">
				<Button
					type="button"
					variant="ghost"
					onClick={() => navigate({ to: "/" })}
					className="flex items-center gap-2 rounded-full px-3.5 text-xs font-medium text-(--text-secondary) hover:bg-(--bg-subtle) hover:text-(--text)"
				>
					<ArrowLeft className="h-4 w-4" />
					<span>Back to intro</span>
				</Button>
				<div className="flex items-center gap-2">
					<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1B4332] text-white font-editorial font-bold text-xs">
						C
					</div>
					<span className="font-editorial text-sm font-semibold text-(--text)">
						Cakwei&apos;s TODO
					</span>
				</div>
			</header>

			<main className="flex flex-1 flex-col items-center justify-center px-6 pb-12 w-full">
				<Card className="w-full max-w-md rounded-3xl border border-(--border) bg-(--bg-secondary) text-(--text) shadow-xl shadow-stone-900/5">
					<CardHeader className="space-y-2 text-center pb-4 pt-8 px-8">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1B4332] text-white font-editorial text-xl font-bold shadow-sm mb-2">
							C
						</div>
						<CardTitle className="font-editorial text-2xl font-semibold tracking-tight text-(--text)">
							Welcome back
						</CardTitle>
						<CardDescription className="text-xs sm:text-sm text-(--text-secondary)">
							Sign in to sync your tasks and offline vault across devices
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-5 px-8 pb-8">
						<form onSubmit={handleEmailLogin} className="space-y-4">
							{errorMessage && (
								<div className="flex items-center gap-2.5 rounded-md border border-[#D97757]/30 bg-[#D97757]/10 p-3 text-xs text-[#B45337]">
									<AlertCircle className="h-4 w-4 shrink-0" />
									<span>{errorMessage}</span>
								</div>
							)}

							<div className="space-y-1.5">
								<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
									Email Address
								</Label>
								<div className="relative">
									<Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-secondary)" />
									<Input
										type="email"
										placeholder="name@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										className="h-10 rounded-md border-(--border) bg-(--bg) pl-10 text-sm text-(--text) placeholder:text-(--text-secondary)/60 focus-visible:border-[#1B4332] focus-visible:ring-[#1B4332]/20"
									/>
								</div>
							</div>

							<div className="space-y-1.5">
								<Label className="text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary)">
									Password
								</Label>
								<div className="relative">
									<Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-secondary)" />
									<Input
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										className="h-10 rounded-md border-(--border) bg-(--bg) pl-10 text-sm text-(--text) placeholder:text-(--text-secondary)/60 focus-visible:border-[#1B4332] focus-visible:ring-[#1B4332]/20"
									/>
								</div>
							</div>

							<Button
								type="submit"
								disabled={isLoading}
								className="mt-2 h-10 w-full rounded-md bg-[#1B4332] text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2D6A4F] active:scale-[0.98]"
							>
								{isLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Sign In"
								)}
							</Button>
						</form>

						<div className="relative my-4 flex items-center justify-center">
							<span className="w-full border-t border-(--border)" />
							<span className="absolute bg-(--bg-secondary) px-3 text-[10px] font-semibold uppercase tracking-widest text-(--text-secondary)">
								Or continue with
							</span>
						</div>

						<Button
							type="button"
							variant="outline"
							className="h-10 w-full gap-2.5 rounded-md border-(--border) bg-(--bg) text-xs font-semibold text-(--text) transition-colors hover:bg-(--bg-subtle)"
							onClick={() => handleSocialLogin("github")}
						>
							<Github className="h-4 w-4 text-(--text-secondary)" />
							GitHub
						</Button>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
