import { S3Client } from "bun";
import { env } from "@momoi/env";

export type PresignOptions = {
  expiresIn?: number; // seconds
  acl?:
  | "public-read"
  | "private"
  | "public-read-write"
  | "authenticated-read"
  | "aws-exec-read"
  | "bucket-owner-read"
  | "bucket-owner-full-control"
  | "log-delivery-write";
  method?: "GET" | "PUT" | "DELETE";
  type?: string; // content-type
};

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (client) return client;

  // Validate required S3 configuration
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
    const missing = [];
    if (!env.S3_ENDPOINT) missing.push("S3_ENDPOINT");
    if (!env.S3_ACCESS_KEY_ID) missing.push("S3_ACCESS_KEY_ID");
    if (!env.S3_SECRET_ACCESS_KEY) missing.push("S3_SECRET_ACCESS_KEY");
    if (!env.S3_REGION) missing.push("S3_REGION");
    if (!env.S3_BUCKET_NAME) missing.push("S3_BUCKET_NAME");

    console.error("[S3] Missing required environment variables:", missing.join(", "));
    throw new Error(`S3 configuration incomplete. Missing: ${missing.join(", ")}`);
  }

  console.log("[S3] Initializing S3Client with config:", {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET_NAME,
    hasAccessKey: !!env.S3_ACCESS_KEY_ID,
    hasSecretKey: !!env.S3_SECRET_ACCESS_KEY,
  });

  try {
    client = new S3Client({
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET_NAME,
    });
    console.log("[S3] S3Client initialized successfully");
    return client;
  } catch (error) {
    console.error("[S3] Failed to initialize S3Client:", error);
    throw error;
  }
}

export function presignUpload(key: string, opts: PresignOptions = {}): string {
  console.log("[S3] Presigning upload:", { key, opts });
  const s3 = getS3Client();
  const url = s3.presign(key, {
    expiresIn: opts.expiresIn ?? 60 * 60 * 24, // default 24h
    method: opts.method ?? "PUT",
    acl: opts.acl,
    type: opts.type,
  });
  console.log("[S3] Presigned upload URL generated:", { key, url: url.substring(0, 100) + "..." });
  return url;
}

export function presignDownload(key: string, opts: PresignOptions = {}): string {
  console.log("[S3] Presigning download:", { key, opts });
  const s3 = getS3Client();
  const url = s3.presign(key, {
    expiresIn: opts.expiresIn ?? 60 * 60 * 24,
    method: opts.method ?? "GET",
  });
  console.log("[S3] Presigned download URL generated:", { key, url: url.substring(0, 100) + "..." });
  return url;
}

export async function exists(key: string): Promise<boolean> {
  console.log("[S3] Checking existence:", { key });
  const s3 = getS3Client();
  const result = await s3.exists(key);
  console.log("[S3] Existence check result:", { key, exists: result });
  return result;
}

export async function stat(key: string) {
  console.log("[S3] Getting stat:", { key });
  const s3 = getS3Client();
  const result = await s3.stat(key);
  console.log("[S3] Stat result:", { key, size: result.size, etag: result.etag });
  return result;
}

export async function deleteObject(key: string) {
  console.log("[S3] Deleting object:", { key });
  const s3 = getS3Client();
  try {
    const result = await s3.delete(key);
    console.log("[S3] Delete successful:", { key });
    return result;
  } catch (error) {
    console.error("[S3] Delete failed:", { key, error });
    throw error;
  }
}

export async function upload(key: string, data: Blob | ArrayBuffer | string, contentType?: string) {
  console.log("[S3] Uploading object:", { key, size: data instanceof Blob ? data.size : (data instanceof ArrayBuffer ? data.byteLength : data.length), contentType });
  const s3 = getS3Client();
  try {
    await s3.write(key, data, { type: contentType });
    console.log("[S3] Upload successful:", { key });
  } catch (error) {
    console.error("[S3] Upload failed:", { key, error });
    throw error;
  }
}
