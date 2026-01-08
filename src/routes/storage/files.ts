import { Elysia } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { ErrorResponse } from "@momoi/model/shared/error";
import { storageModel } from "@momoi/model/storage";
import { StorageService } from "@momoi/service/storage";

export const storageFilesRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro
) => new Elysia({ name: "storage.files.route" })
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

      // Coerce string booleans from multipart form data
      const normalizedBody = {
        ...body,
        isPublic: body.isPublic === "true" || body.isPublic === true,
      };

      return await storageService.createFile(user.id, normalizedBody);
    },
    {
      body: "CreateFileRequestBody",
      type: "multipart/form-data",
      response: {
        200: "CreateFileResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: "Create file or folder",
        description: "Create a new file or folder, optionally with file upload",
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

      // Coerce string booleans from multipart form data
      const normalizedBody = {
        ...body,
        isPublic: body.isPublic !== undefined
          ? (body.isPublic === "true" || body.isPublic === true)
          : undefined,
      };

      return await storageService.updateFile(user.id, params.fileId, normalizedBody);
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
        summary: "Update file or folder metadata",
        description: "Update name, parent folder, or public status",
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
        description: "Permanently delete a file or folder and its contents",
        tags: ["Storage"],
      },
    }
  )

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
      },
      detail: {
        summary: "Move file to another folder",
        description: "Move a file or folder to a different parent folder",
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
      },
      detail: {
        summary: "Copy file to another folder",
        description: "Create a copy of a file in the same or different folder",
        tags: ["Storage"],
      },
    }
  );
