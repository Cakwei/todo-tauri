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
	try {
		const fetchHeaders = new Headers();

		for (const [key, value] of Object.entries(request.headers)) {
			if (value !== undefined) {
				if (key === "cookie") continue;

				if (Array.isArray(value)) {
					value.forEach((v) => {
						fetchHeaders.append(key, v);
					});
				} else {
					fetchHeaders.append(key, value);
				}
			}
		}
		console.log("Final header", fetchHeaders);
		// 2. Pass the standard Fetch headers object
		const session = await auth.api.getSession({
			headers: fetchHeaders,
		});

		// console.log(session);

		if (!session?.user?.id) {
			return reply
				.status(401)
				.send({ success: false, message: "Unauthorized" });
		}

		request.user = { id: session.user.id };
	} catch (error) {
		request.log.error(error, "Authentication middleware error");
		return reply.status(401).send({ success: false, message: "Unauthorized" });
	}
}
