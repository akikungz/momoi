import { PrismaClient } from "@momoi/database";
import { ServiceError } from "../../utils/error";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "../../env";

export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private prisma: PrismaClient) {
    this.bucketName = env.S3_BUCKET_NAME || "momoi-storage";
    this.s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT, // RustFS or S3 compatible endpoint
      region: env.S3_REGION || "auto",
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
      },
      forcePathStyle: true, // Often required for non-AWS S3 providers
    });
  }

  async listFiles(userId: number, parentId?: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    
    const [files, total] = await Promise.all([
      this.prisma.platformFile.findMany({
        where: {
          platformUserId: userId,
          parentId: parentId || null,
        },
        include: {
          platformFileVersions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.platformFile.count({
        where: {
          platformUserId: userId,
          parentId: parentId || null,
        },
      }),
    ]);

    return {
      data: files,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async uploadFile(userId: number, file: File, parentId?: string) {
    const fileId = crypto.randomUUID();
    const storagePath = `users/${userId}/${fileId}/${file.name}`;

    try {
      const parallelUploads3 = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: storagePath,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        },
      });

      await parallelUploads3.done();

      return await this.prisma.$transaction(async (tx) => {
        const platformFile = await tx.platformFile.create({
          data: {
            id: fileId,
            name: file.name,
            type: "FILE",
            sizeBytes: file.size,
            platformUserId: userId,
            parentId: parentId || null,
          },
        });

        await tx.platformFileVersion.create({
          data: {
            platformFileId: platformFile.id,
            versionNumber: 1,
            sizeBytes: file.size,
            storagePath: storagePath,
          },
        });

        return platformFile;
      });
    } catch (error) {
      console.error("S3 Upload Error:", error);
      throw new ServiceError(500, "Failed to upload file to storage");
    }
  }

  async deleteFile(userId: number, fileId: string) {
    const file = await this.prisma.platformFile.findUnique({
      where: { id: fileId },
      include: { platformFileVersions: true }
    });

    if (!file) throw new ServiceError(404, "File not found");
    if (file.platformUserId !== userId) throw new ServiceError(403, "Forbidden");

    try {
      // Delete all versions from S3
      for (const version of file.platformFileVersions) {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: version.storagePath,
        }));
      }

      return await this.prisma.platformFile.delete({
        where: { id: fileId },
      });
    } catch (error) {
      console.error("S3 Delete Error:", error);
      throw new ServiceError(500, "Failed to delete file from storage");
    }
  }
}
