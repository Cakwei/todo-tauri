/** biome-ignore-all lint/a11y/noSvgWithoutTitle: <explanation> */
``
export function PendingComponent() {
	return (
		<div
			className="flex h-screen w-full flex-col items-center justify-center gap-4 font-sans select-none transition-colors duration-200"
			style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
		>
			{/* Animated SVG Loader Container */}
			<div className="relative flex items-center justify-center">
				{/* Ambient Glow Pulse */}
				<div
					className="absolute h-14 w-14 animate-ping rounded-full opacity-25"
					style={{ backgroundColor: "var(--link)" }}
				/>

				{/* Dual-Ring SVG Spinner */}
				<svg
					className="h-12 w-12 animate-spin"
					viewBox="0 0 48 48"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					{/* Background Track */}
					<circle
						cx="24"
						cy="24"
						r="18"
						stroke="var(--border)"
						strokeWidth="4"
					/>
					{/* Foreground Animated Gradient Arc */}
					<path
						d="M24 6C14.0589 6 6 14.0589 6 24C6 28.9706 8.01472 33.4706 11.2721 36.7279"
						stroke="var(--link)"
						strokeWidth="4"
						strokeLinecap="round"
					/>
				</svg>

				{/* Center Accent Dot */}
				<div
					className="absolute h-2.5 w-2.5 rounded-full shadow-sm"
					style={{ backgroundColor: "var(--link)" }}
				/>
			</div>

			{/* Status Labels */}
			<div className="flex flex-col items-center gap-1 text-center">
				<h3
					className="text-sm font-medium tracking-wide"
					style={{ color: "var(--text)" }}
				>
					Loading...
				</h3>
				<p className="text-xs" style={{ color: "var(--text-secondary)" }}>
					Syncing application state
				</p>
			</div>
		</div>
	);
}
