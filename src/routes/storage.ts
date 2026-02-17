import { Elysia, t } from "elysia";
import { AuthMacro } from "@momoi/auth";
import { PrismaClient } from "@momoi/database";
import { StorageService } from "@momoi/service/storage";

export const storageRoute = (
  prisma: PrismaClient,
  auth: AuthMacro
) => new Elysia({ name: "storage.route", prefix: "/storage" })
  .use(auth)
  .guard({ auth: true })
  .decorate("storageService", new StorageService(prisma))
  .get("/files", async ({ storageService, user, query }) => {
    return await storageService.listFiles(user.id, query.parentId, query.page, query.pageSize);
  }, {
    query: t.Object({
      parentId: t.Optional(t.String()),
      page: t.Optional(t.Number({ default: 1 })),
      pageSize: t.Optional(t.Number({ default: 20 }))
    }),
    detail: {
      summary: "List files and folders",
      tags: ["Storage"]
    }
  })
  .post("/upload", async ({ storageService, user, body }) => {
    return await storageService.uploadFile(user.id, body.file, body.parentId);
  }, {
    body: t.Object({
      file: t.File(),
      parentId: t.Optional(t.String())
    }),
    detail: {
      summary: "Upload file to RustFS",
      tags: ["Storage"]
    }
  })
  .get("/download/:fileId", async ({ params, user }) => {
    // RustFS Download logic placeholder
    return { message: "Download from RustFS placeholder" };
  }, {
    params: t.Object({
      fileId: t.String()
    }),
    detail: {
      summary: "Download file from RustFS",
      tags: ["Storage"]
    }
  })
  .delete("/:fileId", async ({ storageService, params, user }) => {
    return await storageService.deleteFile(user.id, params.fileId);
  }, {
    params: t.Object({
      fileId: t.String()
    }),
    detail: {
      summary: "Delete file or folder",
      tags: ["Storage"]
    }
  });
