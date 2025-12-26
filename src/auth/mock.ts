import { Elysia } from 'elysia';

import { PlatformRole } from '@momoi/database/prisma/generated/browser';

export interface MockUser {
  id: number;
  role: PlatformRole;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null | undefined;
};

export const mockAdminAuth = new Elysia({ name: "auth.mock.admin" })
  .macro({
    auth: {
      resolve: async () => {
        return {
          user: {
            id: 1,
            role: "ADMIN" as PlatformRole,
            createdAt: new Date(),
            updatedAt: new Date(),
            email: "admin.t@itm.kmutnb.ac.th",
            emailVerified: true,
            name: "Admin User",
            image: null,
          },
        }
      }
    }
  });

export const mockInstructorAuth = new Elysia({ name: "auth.mock.instructor" })
  .macro({
    auth: {
      resolve: async () => {
        return {
          user: {
            id: 2,
            role: "INSTRUCTOR" as PlatformRole,
            createdAt: new Date(),
            updatedAt: new Date(),
            email: "instructor.t@itm.kmutnb.ac.th",
            emailVerified: true,
            name: "Instructor User",
            image: null,
          },
        }
      }
    }
  });

export const mockStudentAuth = new Elysia({ name: "auth.mock.student" })
  .macro({
    auth: {
      resolve: async () => {
        return {
          user: {
            id: 3,
            role: "STUDENT" as PlatformRole,
            createdAt: new Date(),
            updatedAt: new Date(),
            email: "s0006020000000@email.kmutnb.ac.th",
            emailVerified: true,
            name: "Student User",
            image: null,
          },
        }
      }
    }
  });

export const mockOtherAuth = new Elysia({ name: "auth.mock.other" })
  .macro({
    auth: {
      resolve: async ({ status }) => {
        return status(401, { status: 401, message: "Unauthorized: No active session or invalid account" });
      }
    }
  });

export type MockAuth = typeof mockAdminAuth | typeof mockInstructorAuth | typeof mockStudentAuth | typeof mockOtherAuth;
