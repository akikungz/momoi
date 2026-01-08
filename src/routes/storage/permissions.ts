import { Elysia } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { ErrorResponse } from "@momoi/model/shared/error";
import { storageModel } from "@momoi/model/storage";
import { StorageService } from "@momoi/service/storage";

export const storagePermissionsRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro
) => new Elysia({ name: "storage.permissions.route" })
  .use(auth)
  .use(storageModel)
  .guard({ auth: true })
  .decorate("storageService", new StorageService(prisma, cache))

  // --- File Permissions ---

  .get(
    "/files/:fileId/permissions",
    async ({ storageService, user, params }) => {
      return await storageService.getFilePermissions(user.id, params.fileId);
    },
    {
      params: "GetFilePermissionsRequestParams",
      response: {
        200: "GetFilePermissionsResponse",
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Get file permissions",
        description: "Retrieve permissions for a file (owner only)",
        tags: ["Storage", "File Permissions"],
      },
    }
  )

  .post(
    "/files/:fileId/permissions",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot add file permissions" });
      }
      return await storageService.addFilePermission(user.id, params.fileId, body);
    },
    {
      params: "AddFilePermissionRequestParams",
      body: "AddFilePermissionRequestBody",
      response: {
        200: "AddFilePermissionResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: "Add file permission",
        description: "Grant a user permission to access a file",
        tags: ["Storage", "File Permissions"],
      },
    }
  )

  .patch(
    "/files/:fileId/permissions/:permissionId",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot update file permissions" });
      }
      return await storageService.updateFilePermission(
        user.id,
        params.fileId,
        params.permissionId,
        body
      );
    },
    {
      params: "UpdateFilePermissionRequestParams",
      body: "UpdateFilePermissionRequestBody",
      response: {
        200: "UpdateFilePermissionResponse",
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Update file permission",
        description: "Update a user's permission level for a file",
        tags: ["Storage", "File Permissions"],
      },
    }
  )

  .delete(
    "/files/:fileId/permissions/:permissionId",
    async ({ storageService, user, params, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot remove file permissions" });
      }
      return await storageService.removeFilePermission(
        user.id,
        params.fileId,
        params.permissionId
      );
    },
    {
      params: "RemoveFilePermissionRequestParams",
      response: {
        200: "RemoveFilePermissionResponse",
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Remove file permission",
        description: "Remove a user's permission to access a file",
        tags: ["Storage", "File Permissions"],
      },
    }
  )

  // --- Share ---

  .post(
    "/files/:fileId/share",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot share files" });
      }
      return await storageService.shareFile(user.id, params.fileId, body);
    },
    {
      params: "ShareFileRequestParams",
      body: "ShareFileRequestBody",
      response: {
        200: "ShareFileResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: "Share file",
        description: "Share a file publicly and/or with specific users (owner only)",
        tags: ["Storage", "File Permissions"],
      },
    }
  );
