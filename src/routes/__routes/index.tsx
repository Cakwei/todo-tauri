/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Store } from "@tauri-apps/plugin-store";
import { ArrowRight, CheckCircle2, FolderKanban, ListTodo } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/__routes/")({
	component: LaunchScreen,
	/*beforeLoad: async ({ location }) => {
		try {
			// Fetch Session
			const store = await Store.load("app-settings.json");
			const token = await store.get("better-auth.session_token");

			const session = (
				await authClient.getSession({
					fetchOptions: {
						headers: {
							authorization: `Bearer ${token}`,
						},
					},
				})
			).data;
			// const appDataPath = await appDataDir();

			// console.log("/boom", appDataPath);

			// Reads from Tauri Store
			const isFirstTime = (await store.get<boolean>("isFirstTime")) ?? true;

			// 3Redirect returning users to dashboard if not already there
			console.log("firstime", isFirstTime);
			if (!isFirstTime && !location.pathname.startsWith("/dashboard")) {
				throw redirect({
					to: "/dashboard",
					search: {
						limit: 10,
						page: 1,
						tab: "",
					},
				});
			}

			return { session, isFirstTime };
		} catch (e) {
			// Always re-throw TanStack Router redirect signals
			if (isRedirect(e)) throw e;

			console.error("RootDocument Error @", e);
			return { session: null, isFirstTime: true };
		}
	},*/
});

const SLIDES = [
	{
		icon: CheckCircle2,
		iconColor: "text-emerald-400",
		title: "Ready to focus?",
		description:
			"Capture tasks quickly, stay organized, and clean up your backlog without distraction.",
	},
	{
		icon: ListTodo,
		iconColor: "text-blue-400",
		title: "Keyboard-First Speed",
		description:
			"Built for rapid entry. Quickly create subtasks, assign priorities, and clear items.",
	},
	{
		icon: FolderKanban,
		iconColor: "text-purple-400",
		title: "Projects & Smart Tags",
		description:
			"Group your engineering tasks into dedicated projects and query them instantly.",
	},
];

function LaunchScreen() {
	const navigate = useNavigate();
	const [currentSlide, setCurrentSlide] = useState(0);

	const isLastSlide = currentSlide === SLIDES.length - 1;

	// Save flag to Tauri store and navigate to login
	const completeOnboarding = async () => {
		try {
			const store = await Store.load("app-settings.json");
			await store.set("isFirstTime", false);
			await store.save();
		} catch (error) {
			console.error("Failed to update onboarding status in store:", error);
		} finally {
			navigate({ to: "/login" });
		}
	};

	const handleNext = async () => {
		if (isLastSlide) {
			await completeOnboarding();
		} else {
			setCurrentSlide((prev) => prev + 1);
		}
	};

	const handleSkip = async () => {
		await completeOnboarding();
	};

	const current = SLIDES[currentSlide];
	const IconComponent = current.icon;

	return (
		<div className="relative flex flex-col h-screen w-screen bg-(--bg) text-(--text) select-none overflow-hidden">
			{/* Main Content Area */}
			<main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 md:p-16 text-center max-w-sm sm:max-w-md md:max-w-lg w-full mx-auto">
				<Button
					onClick={handleSkip}
					className="absolute top-5 left-5 text-base text-(--text) bg-(--bg) hover:bg-(--bg-secondary) px-3.5 py-2"
				>
					Skip
				</Button>
				<div
					key={currentSlide}
					className="flex flex-col items-center w-full animate-in fade-in duration-200"
				>
					<div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl bg-(--bg-secondary) border-border flex items-center justify-center mb-6 sm:mb-8 shadow-sm">
						<IconComponent
							className={`w-7 h-7 sm:w-10 sm:h-10 ${current.iconColor}`}
						/>
					</div>

					<h1 className="text-2xl sm:text-3xl tracking-tight text-(--text)">
						{current.title}
					</h1>
					<p className="text-base text-zinc-400 mt-3 sm:mt-4 mb-8 sm:mb-12 leading-relaxed max-w-md">
						{current.description}
					</p>
				</div>

				{/* Actions & Stepper Dots */}
				<div className="w-full space-y-6 sm:space-y-8">
					<Button
						onClick={handleNext}
						className="w-full flex rounded-md items-center justify-center h-9 gap-2 bg-(--link) text-(--text) text-base sm:text-md  hover:bg-(--link)/80 transition-all active:scale-[0.98]"
					>
						<span>{isLastSlide ? "Get Started" : "Next"}</span>
						<ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
					</Button>

					<div className="flex justify-center items-center gap-2">
						{SLIDES.map((_, index) => (
							<button
								type="button"
								key={index}
								onClick={() => setCurrentSlide(index)}
								className={`h-2 rounded-full transition-all duration-300 ${
									index === currentSlide
										? "w-8 bg-zinc-100"
										: "w-2 bg-zinc-800 hover:bg-zinc-700"
								}`}
								aria-label={`Go to slide ${index + 1}`}
							/>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
