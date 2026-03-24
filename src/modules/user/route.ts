import { Elysia, t } from "elysia";

import type { AuthMacro } from "@momoi/auth";
import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database";
import { userModel } from "@momoi/model/user";

import { createUserSSHKeyUseCases } from ".";

export const userRoute = (
	prisma: PrismaClient,
	cache: CacheModule,
	auth: AuthMacro,
) => {
	const useCases = createUserSSHKeyUseCases(prisma, cache);

	return new Elysia({ name: "user.route", prefix: "/user" })
		.use(auth)
		.use(userModel)
		.guard({ auth: true })
		.get(
			"/me",
			async ({ user }) => {
				return {
					id: user.id,
					email: user.email,
					name: user.name,
					role: user.role,
					image: user.image,
				};
			},
			{
				response: {
					200: "UserGetMeResponse",
				},
				detail: {
					summary: "Get current user",
					description:
						"Retrieve the profile information of the currently authenticated user",
					tags: ["User"],
				},
			},
		)
		.get(
			"/ssh-keys",
			async ({ user, query }) => {
				return useCases.getSSHKeys.execute(user.id, query.page, query.pageSize);
			},
			{
				query: "UserGetSSHKeyRequestQuery",
				response: {
					200: "UserGetSSHKeyResponse",
				},
				detail: {
					summary: "Get user SSH keys",
					description:
						"Retrieve a paginated list of SSH keys for the current user",
					tags: ["User", "SSH Keys"],
				},
			},
		)
		.post(
			"/ssh-keys",
			async ({ user, body }) => {
				return useCases.addSSHKey.execute({
					ownerId: user.id,
					name: body.name,
					publicKey: body.publicKey,
				});
			},
			{
				body: "UserAddSSHKeyRequestBody",
				response: {
					200: "UserAddSSHKeyResponse",
				},
				detail: {
					summary: "Add SSH key",
					description: "Add a new SSH public key to the current user's account",
					tags: ["User", "SSH Keys"],
				},
			},
		)
		.delete(
			"/ssh-keys",
			async ({ user, body }) => {
				return useCases.removeSSHKeys.execute({
					ownerId: user.id,
					keyIds: body.keyIds,
				});
			},
			{
				body: "UserRemoveSSHKeyRequestBody",
				response: {
					200: t.Number({ description: "Number of SSH keys removed" }),
				},
				detail: {
					summary: "Remove SSH keys",
					description:
						"Remove one or more SSH keys from the current user's account",
					tags: ["User", "SSH Keys"],
				},
			},
		);
};
