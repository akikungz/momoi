import { Elysia, t } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { userModel } from "@momoi/model/user";
import { UserService } from "@momoi/service/user";
import { pick } from "@momoi/utils/object";

export const userRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro
) => new Elysia({ name: "user.route", prefix: "/user" })
  .use(auth)
  .use(userModel)
  .guard({ auth: true })
  .decorate("userService", new UserService(prisma, cache))
  .get("/me", async ({ user }) => {
    return pick(user, ["id", "email", "name", "role", "image"]);
  }, {
    response: {
      200: "UserGetMeResponse",
    },
    detail: {
      summary: "Get current user",
      description: "Retrieve the profile information of the currently authenticated user",
      tags: ["User"],
    },
  })
  .get("/ssh-keys", async ({ userService, user, query }) => {
    return userService.getSSHKeys(user.id, query.page, query.pageSize);
  }, {
    query: "UserGetSSHKeyRequestQuery",
    response: {
      200: "UserGetSSHKeyResponse",
    },
    detail: {
      summary: "Get user SSH keys",
      description: "Retrieve a paginated list of SSH keys for the current user",
      tags: ["User", "SSH Keys"],
    },
  })
  .post("/ssh-keys", async ({ userService, user, body }) => {
    return userService.addSSHKey(user.id, body.name, body.publicKey);
  }, {
    body: "UserAddSSHKeyRequestBody",
    response: {
      200: "UserAddSSHKeyResponse",
    },
    detail: {
      summary: "Add SSH key",
      description: "Add a new SSH public key to the current user's account",
      tags: ["User", "SSH Keys"],
    },
  })
  .delete("/ssh-keys", async ({ userService, user, body }) => {
    return userService.removeSSHKey(user.id, body.keyIds);
  }, {
    body: "UserRemoveSSHKeyRequestBody",
    response: {
      200: t.Number({ description: "Number of SSH keys removed" }),
    },
    detail: {
      summary: "Remove SSH keys",
      description: "Remove one or more SSH keys from the current user's account",
      tags: ["User", "SSH Keys"],
    },
  });


