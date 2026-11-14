import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "cakwei_todo_theme";

export function useTheme() {
	const [theme, setTheme] = useState<ThemeMode>(() => {
		if (typeof window === "undefined") return "light";
		const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
		return saved === "dark" ? "dark" : "light";
	});

	useEffect(() => {
		if (typeof document === "undefined") return;
		document.body.classList.toggle("dark", theme === "dark");
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	}, [theme]);

	const toggleTheme = () => {
		setTheme((prev) => (prev === "light" ? "dark" : "light"));
	};

	return { theme, setTheme, toggleTheme };
}
