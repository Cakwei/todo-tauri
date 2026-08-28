import Axios from "axios";
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const axios = Axios.create({
	baseURL: `${import.meta.env.VITE_API_URL}/api`,
	withCredentials: true, // Replaces credentials: "include" for Fastify CORS cookies
});
