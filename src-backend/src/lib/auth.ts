import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "../db";
import { CORSList } from "./const";

export const auth = betterAuth({
	trustedOrigins: CORSList,
	plugins: [bearer()],
	database: prismaAdapter(prisma, {
		provider: "mysql",
	}),
	emailAndPassword: {
		enabled: true,
	},
});
