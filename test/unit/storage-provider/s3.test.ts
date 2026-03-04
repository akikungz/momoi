import { describe, expect, it } from "bun:test";

import { S3StorageProvider } from "@momoi/storage-provider/s3";

describe("S3StorageProvider", () => {
  it("throws when required config is missing", () => {
    expect(() => new S3StorageProvider({
      endpoint: undefined,
      accessKeyId: "key",
      secretAccessKey: "secret",
      region: "us-east-1",
      bucketName: "momoi-test",
      forcePathStyle: true,
      presignExpiresSeconds: 900,
    })).toThrow("S3 provider selected but required S3 configuration is missing.");
  });

  it("creates object key with filename extension", () => {
    const provider = new S3StorageProvider({
      endpoint: "http://localhost:9000",
      accessKeyId: "key",
      secretAccessKey: "secret",
      region: "us-east-1",
      bucketName: "momoi-test",
      forcePathStyle: true,
      presignExpiresSeconds: 900,
    });

    const key = provider.createObjectKey(7, "report.pdf");

    expect(key.startsWith("user/7/objects/")).toBe(true);
    expect(key.endsWith(".pdf")).toBe(true);
  });

  it("creates object key without extension when filename omitted", () => {
    const provider = new S3StorageProvider({
      endpoint: "http://localhost:9000",
      accessKeyId: "key",
      secretAccessKey: "secret",
      region: "us-east-1",
      bucketName: "momoi-test",
      forcePathStyle: true,
      presignExpiresSeconds: 900,
    });

    const key = provider.createObjectKey(11);

    expect(key.startsWith("user/11/objects/")).toBe(true);
    expect(key.includes(".")).toBe(false);
  });
});
