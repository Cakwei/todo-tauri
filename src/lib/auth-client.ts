import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	basePath: import.meta.env.DEV
		? "http://localhost:3001"
		: import.meta.env.VITE_API_URL,
});
