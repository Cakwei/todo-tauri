/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Store } from "@tauri-apps/plugin-store";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	CheckCircle2,
	Cloud,
	Command,
	FolderKanban,
	HardDrive,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/__routes/")({
	component: LaunchScreen,
});

const SLIDES = [
	{
		step: "01",
		eyebrow: "Editorial Focus",
		icon: CheckCircle2,
		title: "A calmer space for deep work.",
		description:
			"Organize your day in a three-pane workspace designed like fine stationery—inbox stream on the left, live task inspector on the right.",
		highlights: [
			"Zero-clutter 3-column split-pane layout",
			"Inline progress ring tracks daily momentum",
			"Pin critical priorities to the top of your stream",
		],
	},
	{
		step: "02",
		eyebrow: "Offline-First Sync",
		icon: Cloud,
		title: "Capture anywhere, even offline.",
		description:
			"Every task, subtask, and edit is saved instantly to your local SQLite vault and automatically reconciled when you reconnect.",
		highlights: [
			"Instant local SQLite reads & writes",
			"Automatic background outbox sync on reconnect",
			"OS Keychain-secured session storage",
		],
	},
	{
		step: "03",
		eyebrow: "Projects & Shortcuts",
		icon: FolderKanban,
		title: "Structured for speed.",
		description:
			"Group work into color-coded projects and smart tags, break down large deliverables into subtasks, and capture ideas from anywhere with ⌘⇧N.",
		highlights: [
			"Global quick-capture shortcut (⌘⇧N / Ctrl+Shift+N)",
			"Subtasks, attachments, reminders & recurrence",
			"Native desktop notifications for due items",
		],
	},
];

function SlidePreview({ index }: { index: number }) {
	if (index === 0) {
		return (
			<div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-lg shadow-stone-900/5">
				<div className="flex items-center justify-between border-b border-(--border) pb-3 mb-4">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-widest text-(--text-secondary)">
							Today
						</p>
						<p className="font-editorial text-lg font-semibold text-(--text)">
							Morning Focus
						</p>
					</div>
					<div className="flex items-center gap-2 rounded-full bg-(--bg-subtle) px-3 py-1">
						<span className="h-2.5 w-2.5 rounded-full bg-[#52B788]" />
						<span className="text-xs font-semibold text-(--text)">67%</span>
					</div>
				</div>
				<div className="space-y-2.5">
					<div className="flex items-center justify-between rounded-md border border-[#1B4332]/20 bg-[#1B4332]/5 px-3.5 py-2.5">
						<div className="flex items-center gap-2.5">
							<span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#1B4332] bg-[#1B4332] text-white">
								<Check className="h-2.5 w-2.5" />
							</span>
							<span className="text-xs font-medium text-(--text) line-through opacity-60">
								Review architecture notes
							</span>
						</div>
						<span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#1B4332] border border-(--border)">
							Core
						</span>
					</div>
					<div className="flex items-center justify-between rounded-md border border-(--border) bg-white px-3.5 py-2.5 shadow-xs">
						<div className="flex items-center gap-2.5">
							<span className="h-4 w-4 rounded-full border-2 border-[#D97757]" />
							<span className="text-xs font-semibold text-(--text)">
								Finalize Q4 release checklist
							</span>
						</div>
						<span className="rounded-full bg-[#D97757]/12 px-2 py-0.5 text-[10px] font-semibold text-[#D97757]">
							Urgent
						</span>
					</div>
					<div className="flex items-center justify-between rounded-md border border-(--border) bg-white px-3.5 py-2.5">
						<div className="flex items-center gap-2.5">
							<span className="h-4 w-4 rounded-full border-2 border-stone-300" />
							<span className="text-xs font-medium text-(--text)">
								Draft release changelog
							</span>
						</div>
						<span className="text-[10px] text-(--text-secondary)">4:00 PM</span>
					</div>
				</div>
			</div>
		);
	}

	if (index === 1) {
		return (
			<div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-lg shadow-stone-900/5">
				<div className="flex items-center justify-between mb-5">
					<div className="flex items-center gap-2 rounded-full bg-(--bg-subtle) px-3 py-1.5">
						<HardDrive className="h-3.5 w-3.5 text-[#1B4332]" />
						<span className="text-xs font-semibold text-(--text)">
							Local SQLite Vault
						</span>
					</div>
					<div className="flex items-center gap-1.5 rounded-full bg-[#52B788]/15 px-3 py-1 text-[11px] font-semibold text-[#1B4332]">
						<span className="h-2 w-2 rounded-full bg-[#52B788]" />
						Synced
					</div>
				</div>
				<div className="space-y-3">
					<div className="rounded-md border border-(--border) bg-(--bg) p-3.5">
						<div className="flex items-center justify-between text-xs mb-1">
							<span className="font-semibold text-(--text)">
								Offline Mutation Queue
							</span>
							<span className="text-[11px] font-medium text-[#52B788]">
								0 pending
							</span>
						</div>
						<p className="text-[11px] text-(--text-secondary)">
							Changes queue locally when Wi-Fi drops and upload automatically
							with Last-Write-Wins conflict resolution.
						</p>
					</div>
					<div className="grid grid-cols-2 gap-2.5">
						<div className="rounded-md border border-(--border) p-3 bg-white">
							<p className="text-[10px] uppercase tracking-wider text-(--text-secondary)">
								Latency
							</p>
							<p className="font-editorial text-lg font-semibold text-[#1B4332]">
								&lt; 2 ms
							</p>
						</div>
						<div className="rounded-md border border-(--border) p-3 bg-white">
							<p className="text-[10px] uppercase tracking-wider text-(--text-secondary)">
								Auth Storage
							</p>
							<p className="font-editorial text-lg font-semibold text-[#1B4332]">
								Keychain
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-lg shadow-stone-900/5">
			<div className="flex items-center justify-between mb-3">
				<span className="rounded-full bg-[#1B4332] px-2.5 py-0.5 text-[10px] font-semibold text-white">
					Inspector
				</span>
				<span className="inline-flex items-center gap-1 rounded-md border border-(--border) bg-(--bg) px-2 py-0.5 text-[10px] font-medium text-(--text-secondary)">
					<Command className="h-3 w-3" /> ⇧ N
				</span>
			</div>
			<p className="font-editorial text-base font-semibold text-(--text) mb-3">
				Ship v2.0 Desktop Experience
			</p>
			<div className="mb-3">
				<div className="flex items-center justify-between text-[11px] text-(--text-secondary) mb-1.5">
					<span>Subtasks</span>
					<span className="font-semibold text-[#1B4332]">3 / 4</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-(--bg-subtle)">
					<div className="h-full w-3/4 rounded-full bg-[#52B788]" />
				</div>
			</div>
			<div className="space-y-1.5 text-xs">
				<div className="flex items-center gap-2 text-(--text-secondary) line-through">
					<CheckCircle2 className="h-3.5 w-3.5 text-[#52B788]" />
					<span>Design Nordic Paper palette</span>
				</div>
				<div className="flex items-center gap-2 text-(--text-secondary) line-through">
					<CheckCircle2 className="h-3.5 w-3.5 text-[#52B788]" />
					<span>Wire SQLite offline cache</span>
				</div>
				<div className="flex items-center gap-2 font-medium text-(--text)">
					<span className="h-3.5 w-3.5 rounded-full border-2 border-[#1B4332]" />
					<span>Publish macOS notarized build</span>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-(--border)">
				<span className="rounded-full bg-(--bg-subtle) px-2.5 py-0.5 text-[10px] font-medium text-[#1B4332]">
					#release
				</span>
				<span className="rounded-full bg-[#D97757]/12 px-2.5 py-0.5 text-[10px] font-medium text-[#D97757]">
					#priority
				</span>
			</div>
		</div>
	);
}

function LaunchScreen() {
	const navigate = useNavigate();
	const [currentSlide, setCurrentSlide] = useState(0);

	const isLastSlide = currentSlide === SLIDES.length - 1;

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

	const current = SLIDES[currentSlide];
	const IconComponent = current.icon;

	return (
		<div className="relative flex min-h-dvh w-full flex-col bg-(--bg) text-(--text) select-none overflow-hidden">
			{/* Top Editorial Header */}
			<header className="flex items-center justify-between px-6 py-5 sm:px-10">
				<div className="flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1B4332] text-white font-editorial font-bold text-sm shadow-sm">
						C
					</div>
					<span className="font-editorial text-base font-semibold tracking-tight text-(--text)">
						Cakwei&apos;s TODO
					</span>
				</div>

				<Button
					type="button"
					variant="ghost"
					onClick={completeOnboarding}
					className="text-xs font-medium text-(--text-secondary) hover:text-(--text) hover:bg-(--bg-subtle) rounded-full px-4"
				>
					Skip intro
				</Button>
			</header>

			{/* Main Split-Pane Editorial Showcase */}
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-10 pt-2 sm:px-10 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
				{/* Left: Visual Preview Stage */}
				<div className="hidden md:flex lg:col-span-6 items-center justify-center rounded-3xl border border-(--border) bg-(--bg-subtle)/70 p-8 lg:p-10 relative overflow-hidden min-h-[380px]">
					<div
						className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-35 blur-3xl"
						style={{ background: "#52B788" }}
					/>
					<div
						className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-25 blur-3xl"
						style={{ background: "#D97757" }}
					/>
					<div
						key={`preview-${currentSlide}`}
						className="relative z-10 w-full flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300"
					>
						<SlidePreview index={currentSlide} />
					</div>
				</div>

				{/* Right: Editorial Copy & Controls */}
				<div className="lg:col-span-6 flex flex-col justify-center max-w-lg mx-auto lg:mx-0 w-full">
					<div
						key={`copy-${currentSlide}`}
						className="animate-in fade-in duration-200"
					>
						<div className="inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--bg-secondary) px-3 py-1 mb-5 shadow-2xs">
							<IconComponent className="h-3.5 w-3.5 text-[#1B4332]" />
							<span className="text-[11px] font-semibold uppercase tracking-widest text-[#1B4332]">
								{current.step} · {current.eyebrow}
							</span>
						</div>

						<h1 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-(--text) leading-[1.15]">
							{current.title}
						</h1>

						<p className="mt-4 text-sm sm:text-base leading-relaxed text-(--text-secondary)">
							{current.description}
						</p>

						<ul className="mt-6 space-y-2.5">
							{current.highlights.map((item) => (
								<li
									key={item}
									className="flex items-center gap-2.5 text-xs sm:text-sm text-(--text)"
								>
									<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#52B788]/20 text-[#1B4332]">
										<Sparkles className="h-3 w-3" />
									</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>

					{/* Stepper & Action Row */}
					<div className="mt-9 flex flex-col gap-5 pt-6 border-t border-(--border)">
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								{SLIDES.map((_, index) => (
									<button
										type="button"
										key={index}
										onClick={() => setCurrentSlide(index)}
										className={`h-2 rounded-full transition-all duration-300 ${
											index === currentSlide
												? "w-8 bg-[#1B4332]"
												: "w-2 bg-stone-300 hover:bg-stone-400"
										}`}
										aria-label={`Go to slide ${index + 1}`}
									/>
								))}
							</div>

							<div className="flex items-center gap-2">
								{currentSlide > 0 && (
									<Button
										type="button"
										variant="outline"
										onClick={() => setCurrentSlide((prev) => prev - 1)}
										className="h-10 rounded-full border-(--border) bg-(--bg-secondary) px-4 text-xs font-semibold text-(--text) hover:bg-(--bg-subtle)"
									>
										<ArrowLeft className="h-3.5 w-3.5 mr-1" />
										Back
									</Button>
								)}
								<Button
									type="button"
									onClick={handleNext}
									className="h-10 rounded-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white px-6 text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
								>
									<span>{isLastSlide ? "Get Started" : "Continue"}</span>
									<ArrowRight className="ml-1.5 h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
