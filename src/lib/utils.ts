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

axios.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("better-auth.session_token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);
