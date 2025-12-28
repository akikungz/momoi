import { Elysia, t } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { ErrorResponse } from "@momoi/model/shared/error";
import { storageModel } from "@momoi/model/storage";
import { StorageService } from "@momoi/service/storage";

export const storageRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro
) => new Elysia({ name: "storage.route", prefix: "/storage" })
  .use(auth)
  .use(storageModel)
  .guard({ auth: true })
  .decorate("storageService", new StorageService(prisma, cache))

  // --- File/Folder CRUD ---

  .get(
    "/files",
    async ({ storageService, user, query }) => {
      return await storageService.listFiles(user.id, query);
    },
    {
      query: "ListFilesRequestQuery",
      response: {
        200: "ListFilesResponse",
      },
      detail: {
        summary: "List files and folders",
        description: "Retrieve a paginated list of files and folders for the current user",
        tags: ["Storage"],
      },
    }
  )

  .get(
    "/files/search",
    async ({ storageService, user, query }) => {
      return await storageService.searchFiles(user.id, query);
    },
    {
      query: "SearchFilesRequestQuery",
      response: {
        200: "SearchFilesResponse",
      },
      detail: {
        summary: "Search files and folders",
        description: "Search for files and folders by name",
        tags: ["Storage"],
      },
    }
  )

  .get(
    "/files/:fileId",
    async ({ storageService, user, params }) => {
      return await storageService.getFile(user.id, params.fileId);
    },
    {
      params: "GetFileRequestParams",
      response: {
        200: "GetFileResponse",
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Get file or folder details",
        description: "Retrieve detailed information about a specific file or folder",
        tags: ["Storage"],
      },
    }
  )

  .post(
    "/files",
    async ({ storageService, user, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot create files" });
      }
      return await storageService.createFile(user.id, body);
    },
    {
      body: "CreateFileRequestBody",
      response: {
        200: "CreateFileResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: "Create file or folder",
        description: "Create a new file or folder",
        tags: ["Storage"],
      },
    }
  )

  .patch(
    "/files/:fileId",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot update files" });
      }
      return await storageService.updateFile(user.id, params.fileId, body);
    },
    {
      params: "UpdateFileRequestParams",
      body: "UpdateFileRequestBody",
      response: {
        200: "UpdateFileResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: "Update file or folder",
        description: "Update metadata of a file or folder",
        tags: ["Storage"],
      },
    }
  )

  .delete(
    "/files/:fileId",
    async ({ storageService, user, params, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot delete files" });
      }
      return await storageService.deleteFile(user.id, params.fileId);
    },
    {
      params: "DeleteFileRequestParams",
      response: {
        200: "DeleteFileResponse",
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Delete file or folder",
        description: "Delete a file or folder and all its children",
        tags: ["Storage"],
      },
    }
  )

  // --- Move/Copy Operations ---

  .post(
    "/files/:fileId/move",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot move files" });
      }
      return await storageService.moveFile(user.id, params.fileId, body);
    },
    {
      params: "MoveFileRequestParams",
      body: "MoveFileRequestBody",
      response: {
        200: "MoveFileResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: "Move file or folder",
        description: "Move a file or folder to a new location",
        tags: ["Storage"],
      },
    }
  )

  .post(
    "/files/:fileId/copy",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot copy files" });
      }
      return await storageService.copyFile(user.id, params.fileId, body);
    },
    {
      params: "CopyFileRequestParams",
      body: "CopyFileRequestBody",
      response: {
        200: "CopyFileResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: "Copy file or folder",
        description: "Copy a file or folder to a new location",
        tags: ["Storage"],
      },
    }
  )

  // --- File Versions ---

  .get(
    "/files/:fileId/versions",
    async ({ storageService, user, params, query }) => {
      return await storageService.getFileVersions(
        user.id,
        params.fileId,
        query.page ?? 1,
        query.pageSize ?? 10
      );
    },
    {
      params: "GetFileVersionsRequestParams",
      query: t.Object({
        page: t.Optional(t.Number({ description: "Page number", default: 1 })),
        pageSize: t.Optional(t.Number({ description: "Items per page", default: 10 })),
      }),
      response: {
        200: "GetFileVersionsResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Get file versions",
        description: "Retrieve version history for a file",
        tags: ["Storage", "File Versions"],
      },
    }
  )

  .post(
    "/files/:fileId/versions",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot create file versions" });
      }
      return await storageService.createFileVersion(user.id, params.fileId, body);
    },
    {
      params: "CreateFileVersionRequestParams",
      body: "CreateFileVersionRequestBody",
      response: {
        200: "CreateFileVersionResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Create file version",
        description: "Create a new version of a file",
        tags: ["Storage", "File Versions"],
      },
    }
  )

  .delete(
    "/files/:fileId/versions/:versionId",
    async ({ storageService, user, params, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot delete file versions" });
      }
      return await storageService.deleteFileVersion(
        user.id,
        params.fileId,
        params.versionId
      );
    },
    {
      params: "DeleteFileVersionRequestParams",
      response: {
        200: "DeleteFileVersionResponse",
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Delete file version",
        description: "Delete a specific version of a file",
        tags: ["Storage", "File Versions"],
      },
    }
  )

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
  );
