import { createAuthClient } from "better-auth/react";
import { API_URL } from "./utils";

export const authClient = createAuthClient({
	baseURL: API_URL,
});
