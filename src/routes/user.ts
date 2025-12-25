import { Elysia, t } from "elysia";

import { AuthMacro, authMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { pick } from "@momoi/utils/object";

import { userModel } from "@momoi/model/user";
import { UserService } from "@momoi/service/user";

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
    return pick(user, ["id", "email", "name", "role"]);
  }, {
    response: {
      200: t.Object({
        id: t.Number(),
        email: t.String(),
        name: t.String(),
        role: t.Union([t.Literal("ADMIN"), t.Literal("INSTRUCTOR"), t.Literal("STUDENT")]),
      }),
    }
  })
  .get("/ssh-keys", async ({ userService, user, query }) => {
    return userService.getSSHKeys(user.id, query.page, query.pageSize);
  }, {
    query: "GetSSHKeyRequestQuery",
    response: {
      200: "GetSSHKeyResponse",
    },
  })
  .post("/ssh-keys", async ({ userService, user, body }) => {
    return userService.addSSHKey(user.id, body.name, body.publicKey);
  }, {
    body: "AddSSHKeyRequestBody",
    response: {
      200: "GetSSHKeyData",
    },
  })
  .delete("/ssh-keys", async ({ userService, user, body }) => {
    return userService.removeSSHKey(user.id, body.keyIds);
  }, {
    body: "RemoveSSHKeyRequestBody",
    response: {
      200: t.Number({ description: "Number of SSH keys removed" }),
    },
  });
