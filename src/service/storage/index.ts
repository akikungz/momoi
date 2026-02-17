import { PrismaClient } from "@momoi/database";
import { ServiceError } from "../../utils/error";

export class StorageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * RustFS Integration placeholder
   * In a real implementation, this would interact with RustFS via its API or FSY
   */
  private async uploadToRustFS(file: File): Promise<string> {
    // RustFS Logic here
    const storagePath = `/rustfs/storage/${Date.now()}_${file.name}`;
    return storagePath;
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
    const storagePath = await this.uploadToRustFS(file);

    return await this.prisma.$transaction(async (tx) => {
      const platformFile = await tx.platformFile.create({
        data: {
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
  }

  async deleteFile(userId: number, fileId: string) {
    const file = await this.prisma.platformFile.findUnique({
      where: { id: fileId },
    });

    if (!file) throw new ServiceError(404, "File not found");
    if (file.platformUserId !== userId) throw new ServiceError(403, "Forbidden");

    // RustFS: In real usage, we would also trigger a deletion in RustFS here

    return await this.prisma.platformFile.delete({
      where: { id: fileId },
    });
  }
}
