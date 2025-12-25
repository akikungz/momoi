import { describe, it, expect } from "bun:test";

import { CacheModule } from "@momoi/cache";
import { createMockPrisma } from "@momoi/database/test";

import { UserService } from "../user";

describe("UserService", () => {
  const mockPrisma = createMockPrisma();
  const cache = new CacheModule();
  const userService = new UserService(mockPrisma, cache);

  it("add SSHKey should create a new SSH key", async () => {
    const userId = 1;
    const name = "My SSH Key";

    const publicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...";

    const data = await userService.addSSHKey(userId, name, publicKey);

    expect(mockPrisma.platformSSHKey.create).toHaveBeenCalledWith({
      data: {
        ownerId: userId,
        name,
        publicKey,
      },
    });

    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("ownerId", userId);
    expect(data).toHaveProperty("name", name);
    expect(data).toHaveProperty("publicKey", publicKey);
  });

  it("get SSHKeys should retrieve SSH keys for a user", async () => {
    const userId = 1;

    const data = await userService.getSSHKeys(userId);

    expect(mockPrisma.platformSSHKey.findMany).toHaveBeenCalledWith({
      where: { ownerId: userId },
      skip: 0,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(mockPrisma.platformSSHKey.count).toHaveBeenCalledWith({
      where: { ownerId: userId },
    });

    expect(data).toHaveProperty("values");
    expect(data).toHaveProperty("totalItems");
    expect(data).toHaveProperty("totalPages");
    expect(data).toHaveProperty("currentPage");
    expect(data).toHaveProperty("pageSize");
  });

  it("remove SSHKey should delete the specified SSH key", async () => {
    const userId = 1;
    const keyId = 42;

    const data = await userService.removeSSHKey(userId, [keyId]);

    expect(mockPrisma.platformSSHKey.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [keyId],
        },
        ownerId: userId,
      },
    });

    expect(data).toBe(1);
  });
});
