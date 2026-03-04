import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ObjectStorageProvider, PresignedResult } from "./types.ts";

type S3StorageProviderConfig = {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
  forcePathStyle: boolean;
  presignExpiresSeconds: number;
};

export class S3StorageProvider implements ObjectStorageProvider {
  public readonly kind = "s3" as const;
  public readonly enabled: boolean;

  private readonly bucketName: string;
  private readonly presignExpiresSeconds: number;
  private readonly client: S3Client;

  constructor(config: S3StorageProviderConfig) {
    this.enabled = Boolean(
      config.endpoint &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.region &&
      config.bucketName,
    );

    if (!this.enabled) {
      throw new Error("S3 provider selected but required S3 configuration is missing.");
    }

    this.bucketName = config.bucketName!;
    this.presignExpiresSeconds = config.presignExpiresSeconds;

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });
  }

  createObjectKey(ownerId: number, filename?: string): string {
    const ext = filename?.includes(".") ? `.${filename.split(".").pop()}` : "";
    return `user/${ownerId}/objects/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
  }

  async createUploadUrl(objectKey: string, contentType?: string): Promise<PresignedResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.presignExpiresSeconds,
    });

    return {
      objectKey,
      url,
      expiresAt: new Date(Date.now() + this.presignExpiresSeconds * 1000),
    };
  }

  async createDownloadUrl(objectKey: string): Promise<PresignedResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.presignExpiresSeconds,
    });

    return {
      objectKey,
      url,
      expiresAt: new Date(Date.now() + this.presignExpiresSeconds * 1000),
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    }));
  }
}
