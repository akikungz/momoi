export interface PresignedResult {
  objectKey: string;
  url: string;
  expiresAt: Date;
}

export interface ObjectStorageProvider {
  readonly kind: "database" | "s3";
  readonly enabled: boolean;
  createObjectKey(ownerId: number, filename?: string): string;
  createUploadUrl(objectKey: string, contentType?: string): Promise<PresignedResult>;
  createDownloadUrl(objectKey: string): Promise<PresignedResult>;
  deleteObject(objectKey: string): Promise<void>;
}
