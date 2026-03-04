import { randomUUID } from "node:crypto";

import { env } from "@momoi/env";

import { S3StorageProvider } from "./s3.ts";
import type { ObjectStorageProvider, PresignedResult } from "./types.ts";

export type { ObjectStorageProvider, PresignedResult } from "./types.ts";

class DatabaseStorageProvider implements ObjectStorageProvider {
  public readonly kind = "database" as const;
  public readonly enabled = false;

  createObjectKey(ownerId: number, filename?: string): string {
    const ext = filename?.includes(".") ? `.${filename.split(".").pop()}` : "";
    return `user/${ownerId}/objects/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
  }

  async createUploadUrl(): Promise<PresignedResult> {
    throw new Error("S3 storage provider is not enabled.");
  }

  async createDownloadUrl(): Promise<PresignedResult> {
    throw new Error("S3 storage provider is not enabled.");
  }

  async deleteObject(): Promise<void> {
    return;
  }
}

export function createObjectStorageProvider(): ObjectStorageProvider {
  if (env.STORAGE_PROVIDER === "s3") {
    return new S3StorageProvider({
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION,
      bucketName: env.S3_BUCKET_NAME,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      presignExpiresSeconds: env.S3_PRESIGN_EXPIRES_SECONDS,
    });
  }

  return new DatabaseStorageProvider();
}
