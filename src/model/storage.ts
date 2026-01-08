import { Elysia, t } from "elysia";

import { PaginationRequest, PaginationResponse } from "./shared/pagination";
import { TimestampResponse } from "./shared/timestamp";

// --- Enums ---

export const PlatformFileType = t.Union([
  t.Literal("FILE", { description: "Regular file" }),
  t.Literal("FOLDER", { description: "Folder/directory" })
], { description: "Type of the platform file" });

export const PlatformFileViewerRole = t.Union([
  t.Literal("VIEWER", { description: "Can view the file" }),
  t.Literal("EDITOR", { description: "Can edit the file" }),
  t.Literal("OWNER", { description: "Owner of the file" })
], { description: "Permission role for the file" });

// --- File/Folder Data Types ---

export const FileData = t.Object({
  id: t.String({ description: "Unique identifier for the file/folder" }),
  name: t.String({ description: "Name of the file/folder" }),
  type: PlatformFileType,
  sizeBytes: t.Number({ description: "Size of the file in bytes (0 for folders)" }),
  visibility: PlatformFileViewerRole,
  parentId: t.Optional(t.Nullable(t.String({ description: "Parent folder ID (null for root)" }))),
  isPublic: t.Boolean({ description: "Whether the file is publicly accessible" }),
  ...TimestampResponse.properties
}, { description: "File or folder data structure" });

export const FileDataWithPath = t.Object({
  ...FileData.properties,
  path: t.String({ description: "Full path of the file/folder" }),
}, { description: "File or folder data with full path" });

export const FileVersionData = t.Object({
  id: t.Number({ description: "Unique identifier for the version" }),
  versionNumber: t.Number({ description: "Version number" }),
  sizeBytes: t.Number({ description: "Size of the version in bytes" }),
  createdAt: t.Date({ description: "When this version was created" }),
}, { description: "File version data" });

export const FilePermissionData = t.Object({
  id: t.Number({ description: "Unique identifier for the permission" }),
  platformUserId: t.Number({ description: "User ID with permission" }),
  permission: PlatformFileViewerRole,
  user: t.Optional(t.Object({
    id: t.Number({ description: "User ID" }),
    name: t.String({ description: "User name" }),
    email: t.String({ description: "User email" }),
  })),
}, { description: "File permission data" });

// --- Request/Response Types ---

// List files/folders
export const ListFilesRequestQuery = t.Object({
  ...PaginationRequest.properties,
  parentId: t.Optional(t.Nullable(t.String({ description: "Parent folder ID (null/omitted for root)" }))),
  type: t.Optional(PlatformFileType),
});

export const ListFilesResponse = t.Object({
  values: t.Array(FileData, { description: "List of files/folders" }),
  ...PaginationResponse.properties
});

// Get single file/folder
export const GetFileRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file/folder" }),
});

export const GetFileResponse = t.Object({
  ...FileData.properties,
  path: t.String({ description: "Full path of the file/folder" }),
  children: t.Optional(t.Array(FileData, { description: "Child files/folders (for folders)" })),
  versions: t.Optional(t.Array(FileVersionData, { description: "File versions (for files)" })),
  permissions: t.Optional(t.Array(FilePermissionData, { description: "File permissions" })),
});

// Create file/folder
export const CreateFileRequestBody = t.Object({
  name: t.String({ description: "Name of the file/folder" }),
  type: PlatformFileType,
  file: t.Optional(t.File({ description: "File to upload (required if type is FILE)" })),
  parentId: t.Optional(t.Nullable(t.String({ description: "Parent folder ID (null for root)" }))),
  isPublic: t.Optional(t.Union([t.Boolean(), t.String()], { description: "Whether the file is publicly accessible", default: false })),
});

export const CreateFileResponse = FileData;

// Update file/folder metadata
export const UpdateFileRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file/folder" }),
});

export const UpdateFileRequestBody = t.Object({
  name: t.Optional(t.String({ description: "New name for the file/folder" })),
  parentId: t.Optional(t.Nullable(t.String({ description: "New parent folder ID" }))),
  isPublic: t.Optional(t.Union([t.Boolean(), t.String()], { description: "Whether the file is publicly accessible" })),
  visibility: t.Optional(PlatformFileViewerRole),
});

export const UpdateFileResponse = FileData;

// Delete file/folder
export const DeleteFileRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file/folder" }),
});

export const DeleteFileResponse = t.Object({
  success: t.Boolean({ description: "Whether the deletion was successful" }),
  deletedCount: t.Number({ description: "Number of files/folders deleted (including children)" }),
});

// Move file/folder
export const MoveFileRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file/folder to move" }),
});

export const MoveFileRequestBody = t.Object({
  targetParentId: t.Nullable(t.String({ description: "Target parent folder ID (null for root)" })),
});

export const MoveFileResponse = FileData;

// Copy file/folder
export const CopyFileRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file/folder to copy" }),
});

export const CopyFileRequestBody = t.Object({
  targetParentId: t.Nullable(t.String({ description: "Target parent folder ID (null for root)" })),
  newName: t.Optional(t.String({ description: "New name for the copied file/folder" })),
});

export const CopyFileResponse = FileData;

// --- File Versions ---

export const GetFileVersionsRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
});

export const GetFileVersionsResponse = t.Object({
  values: t.Array(FileVersionData, { description: "List of file versions" }),
  ...PaginationResponse.properties
});

export const CreateFileVersionRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
});

export const CreateFileVersionRequestBody = t.Object({
  sizeBytes: t.Number({ description: "Size of the new version in bytes" }),
  storagePath: t.String({ description: "Storage path for the new version" }),
});

export const CreateFileVersionResponse = FileVersionData;

export const DeleteFileVersionRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
  versionId: t.Number({ description: "Unique identifier for the version" }),
});

export const DeleteFileVersionResponse = t.Object({
  success: t.Boolean({ description: "Whether the deletion was successful" }),
});

// --- File Permissions ---

export const GetFilePermissionsRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
});

export const GetFilePermissionsResponse = t.Array(FilePermissionData, {
  description: "List of file permissions"
});

export const AddFilePermissionRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
});

export const AddFilePermissionRequestBody = t.Object({
  platformUserId: t.Number({ description: "User ID to grant permission to" }),
  permission: PlatformFileViewerRole,
});

export const AddFilePermissionResponse = FilePermissionData;

export const UpdateFilePermissionRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
  permissionId: t.Number({ description: "Unique identifier for the permission" }),
});

export const UpdateFilePermissionRequestBody = t.Object({
  permission: PlatformFileViewerRole,
});

export const UpdateFilePermissionResponse = FilePermissionData;

export const RemoveFilePermissionRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
  permissionId: t.Number({ description: "Unique identifier for the permission" }),
});

export const RemoveFilePermissionResponse = t.Object({
  success: t.Boolean({ description: "Whether the removal was successful" }),
});

// --- Search ---

export const SearchFilesRequestQuery = t.Object({
  ...PaginationRequest.properties,
  query: t.String({ description: "Search query string" }),
  type: t.Optional(PlatformFileType),
});

export const SearchFilesResponse = t.Object({
  values: t.Array(FileDataWithPath, { description: "List of matching files/folders" }),
  ...PaginationResponse.properties
});

// --- Share (Public or Specific Users) ---

export const ShareFileRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file/folder" }),
});

export const ShareTargetUser = t.Object({
  platformUserId: t.Number({ description: "User ID to share with" }),
  permission: PlatformFileViewerRole,
});

export const ShareFileRequestBody = t.Object({
  isPublic: t.Optional(t.Boolean({ description: "Whether the file should be publicly viewable" })),
  users: t.Optional(t.Array(ShareTargetUser, { description: "Specific users to share with and their permission levels" })),
}, { description: "Share a file publicly and/or with specific users" });

export const ShareFileResponse = GetFileResponse;

// --- S3 Presign (Upload/Download) ---

export const PresignUploadRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
});

export const PresignUploadRequestBody = t.Object({
  contentType: t.Optional(t.String({ description: "Content-Type of the upload" })),
  expiresIn: t.Optional(t.Number({ description: "Expiry in seconds", default: 86400 })),
});

export const PresignUploadResponse = t.Object({
  url: t.String({ description: "Presigned URL for uploading" }),
  storagePath: t.String({ description: "Storage key/path for uploaded version" }),
  method: t.Literal("PUT"),
  expiresIn: t.Number(),
  contentType: t.Optional(t.String()),
});

export const PresignDownloadRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
  versionId: t.Number({ description: "Version id to download" }),
});

export const PresignDownloadRequestQuery = t.Object({
  expiresIn: t.Optional(t.Number({ description: "Expiry in seconds", default: 86400 })),
});

export const PresignDownloadResponse = t.Object({
  url: t.String({ description: "Presigned URL for downloading" }),
  method: t.Literal("GET"),
  expiresIn: t.Number(),
});

// --- Direct Upload (alternative to presign flow) ---

export const UploadFileVersionRequestParams = t.Object({
  fileId: t.String({ description: "Unique identifier for the file" }),
});

export const UploadFileVersionResponse = t.Object({
  ...FileVersionData.properties,
  storagePath: t.String({ description: "Storage path where the file was uploaded" }),
});

// --- Elysia Model Export ---

export const storageModel = new Elysia({ name: "storage.model" })
  // Enums
  .model("PlatformFileType", PlatformFileType)
  .model("PlatformFileViewerRole", PlatformFileViewerRole)
  // Data types
  .model("FileData", FileData)
  .model("FileDataWithPath", FileDataWithPath)
  .model("FileVersionData", FileVersionData)
  .model("FilePermissionData", FilePermissionData)
  // List files
  .model("ListFilesRequestQuery", ListFilesRequestQuery)
  .model("ListFilesResponse", ListFilesResponse)
  // Get file
  .model("GetFileRequestParams", GetFileRequestParams)
  .model("GetFileResponse", GetFileResponse)
  // Create file
  .model("CreateFileRequestBody", CreateFileRequestBody)
  .model("CreateFileResponse", CreateFileResponse)
  // Update file
  .model("UpdateFileRequestParams", UpdateFileRequestParams)
  .model("UpdateFileRequestBody", UpdateFileRequestBody)
  .model("UpdateFileResponse", UpdateFileResponse)
  // Delete file
  .model("DeleteFileRequestParams", DeleteFileRequestParams)
  .model("DeleteFileResponse", DeleteFileResponse)
  // Move file
  .model("MoveFileRequestParams", MoveFileRequestParams)
  .model("MoveFileRequestBody", MoveFileRequestBody)
  .model("MoveFileResponse", MoveFileResponse)
  // Copy file
  .model("CopyFileRequestParams", CopyFileRequestParams)
  .model("CopyFileRequestBody", CopyFileRequestBody)
  .model("CopyFileResponse", CopyFileResponse)
  // File versions
  .model("GetFileVersionsRequestParams", GetFileVersionsRequestParams)
  .model("GetFileVersionsResponse", GetFileVersionsResponse)
  .model("CreateFileVersionRequestParams", CreateFileVersionRequestParams)
  .model("CreateFileVersionRequestBody", CreateFileVersionRequestBody)
  .model("CreateFileVersionResponse", CreateFileVersionResponse)
  .model("DeleteFileVersionRequestParams", DeleteFileVersionRequestParams)
  .model("DeleteFileVersionResponse", DeleteFileVersionResponse)
  // File permissions
  .model("GetFilePermissionsRequestParams", GetFilePermissionsRequestParams)
  .model("GetFilePermissionsResponse", GetFilePermissionsResponse)
  .model("AddFilePermissionRequestParams", AddFilePermissionRequestParams)
  .model("AddFilePermissionRequestBody", AddFilePermissionRequestBody)
  .model("AddFilePermissionResponse", AddFilePermissionResponse)
  .model("UpdateFilePermissionRequestParams", UpdateFilePermissionRequestParams)
  .model("UpdateFilePermissionRequestBody", UpdateFilePermissionRequestBody)
  .model("UpdateFilePermissionResponse", UpdateFilePermissionResponse)
  .model("RemoveFilePermissionRequestParams", RemoveFilePermissionRequestParams)
  .model("RemoveFilePermissionResponse", RemoveFilePermissionResponse)
  // Search
  .model("SearchFilesRequestQuery", SearchFilesRequestQuery)
  .model("SearchFilesResponse", SearchFilesResponse)
  // Share
  .model("ShareFileRequestParams", ShareFileRequestParams)
  .model("ShareFileRequestBody", ShareFileRequestBody)
  .model("ShareFileResponse", ShareFileResponse)
  // Presign
  .model("PresignUploadRequestParams", PresignUploadRequestParams)
  .model("PresignUploadRequestBody", PresignUploadRequestBody)
  .model("PresignUploadResponse", PresignUploadResponse)
  .model("PresignDownloadRequestParams", PresignDownloadRequestParams)
  .model("PresignDownloadRequestQuery", PresignDownloadRequestQuery)
  .model("PresignDownloadResponse", PresignDownloadResponse)
  // Upload
  .model("UploadFileVersionRequestParams", UploadFileVersionRequestParams)
  .model("UploadFileVersionResponse", UploadFileVersionResponse);
