import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "./auth";

declare module "fastify" {
	interface FastifyRequest {
		user?: { id: string };
	}
}

export async function requireAuth(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	/* const headers = new Headers();
	for (const [key, value] of Object.entries(request.headers)) {
		if (typeof value === "string") headers.append(key, value);
		else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
	}*/

	const betterAuthCookie = request.cookies["better-auth.session_token"];
	const cookie = `better-auth.session_token=${betterAuthCookie}`;

	if (!cookie)
		return reply.status(401).send({ success: false, message: "Unauthorized" });

	const session = await auth.api.getSession({
		headers: {
			cookie: cookie,
		},
	});
	// console.log("testing", cookie, session);
	if (!session?.user?.id) {
		return reply.status(401).send({ success: false, message: "Unauthorized" });
	}

	request.user = { id: session.user.id };
}
