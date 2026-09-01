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
		/*	const fetchHeaders = new Headers();

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
		}*/

		// console.log("Final header", fetchHeaders);

		const token = request.headers.authorization?.split(" ")[1] || "";
		// Pass the standard Fetch headers object
		const session = await auth.api.getSession({
			headers: { Authorization: `Bearer ${token}` },
		});

		// console.log("falg", session, token);
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
