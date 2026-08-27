import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";

export const auth = betterAuth({
	trustedOrigins: ["http://localhost:3000"],
	database: prismaAdapter(prisma, {
		provider: "mysql",
	}),
});
