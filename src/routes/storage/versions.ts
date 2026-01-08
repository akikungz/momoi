import { Elysia, t } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { ErrorResponse } from "@momoi/model/shared/error";
import { storageModel } from "@momoi/model/storage";
import { StorageService } from "@momoi/service/storage";

export const storageVersionsRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro
) => new Elysia({ name: "storage.versions.route" })
  .use(auth)
  .use(storageModel)
  .guard({ auth: true })
  .decorate("storageService", new StorageService(prisma, cache))

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

  // --- S3 Presign & Upload ---

  .post(
    "/files/:fileId/versions/presign_upload",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot create file versions" });
      }
      return await storageService.presignFileVersionUpload(user.id, params.fileId, body);
    },
    {
      params: "PresignUploadRequestParams",
      body: "PresignUploadRequestBody",
      response: {
        200: "PresignUploadResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Presign upload URL for file version",
        description: "Generate a presigned PUT URL to upload a new file version directly to S3",
        tags: ["Storage", "File Versions", "S3"],
      },
    }
  )

  .post(
    "/files/:fileId/versions/upload",
    async ({ storageService, user, params, body, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot create file versions" });
      }

      // Extract file from multipart form data
      const file = body.file;
      if (!file || !(file instanceof Blob)) {
        return status(400, { status: 400, message: "File is required" });
      }

      return await storageService.uploadFileVersion(user.id, params.fileId, file, file.type);
    },
    {
      params: "UploadFileVersionRequestParams",
      type: "multipart/form-data",
      response: {
        200: "UploadFileVersionResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Upload file version directly",
        description: "Upload a new file version directly through the API (alternative to presign flow)",
        tags: ["Storage", "File Versions", "Upload"],
      },
    }
  )

  .get(
    "/files/:fileId/versions/:versionId/presign_download",
    async ({ storageService, user, params, query }) => {
      return await storageService.presignFileVersionDownload(
        user.id,
        params.fileId,
        params.versionId,
        query.expiresIn ?? 60 * 60 * 24
      );
    },
    {
      params: "PresignDownloadRequestParams",
      query: "PresignDownloadRequestQuery",
      response: {
        200: "PresignDownloadResponse",
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: "Presign download URL for file version",
        description: "Generate a presigned GET URL to download an existing file version from S3",
        tags: ["Storage", "File Versions", "S3"],
      },
    }
  );
