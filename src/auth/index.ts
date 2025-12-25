import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { customSession, openAPI } from 'better-auth/plugins';
import { Elysia } from 'elysia';

import { CacheModule } from '@momoi/cache';
import { prisma } from '@momoi/database';
import { env } from '@momoi/env';
import { isInstructorEmail, isItDepartmentEmail } from '@momoi/utils/user';

import { MockAuth } from './mock';

export const auth = betterAuth({
  basePath: "/api/auth",
  database: env.NODE_ENV === "test" ? undefined : prismaAdapter(prisma, { provider: "postgresql" }),
  secret: env.JWT_SECRET,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 3, // 3 hours
      strategy: "jwt",
    },
  },
  socialProviders: {
    ...(
      env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET
        ? {
          google: {
            clientId: env.GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
            scope: ["email", "profile"],
            accessType: "offline"
          },
        }
        : {}
    ),
  },
  emailAndPassword: {
    enabled: env.NODE_ENV !== "production",
    requireEmailVerification: false,
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  plugins: [
    openAPI(),
    customSession(async ({ user, session }) => {
      if (!isItDepartmentEmail(user.email)) {
        throw new Error("Unauthorized: Email is not from IT Department");
      }

      let platfromUser = await prisma.platformUser.findUnique({
        where: { userId: user.id },
      });

      if (!platfromUser) {
        let userId = user.id;
        if (isInstructorEmail(user.email)) {
          const findMailListing = await prisma.instructorSearch.findUnique({
            where: { email: user.email },
          });

          if (!findMailListing) {
            throw new Error("Unauthorized: Instructor email not found in listing");
          }

          platfromUser = await prisma.platformUser.create({
            data: {
              userId,
              role: "INSTRUCTOR",
            },
          });
        } else {
          platfromUser = await prisma.platformUser.create({
            data: {
              userId,
              role: "STUDENT",
            },
          });
        }
      }

      return {
        user: {
          ...user,
          id: platfromUser.id,
          role: platfromUser.role,
        },
        session
      };
    }),
  ],
});

export const authHandler = new Elysia({ name: "auth.handler" })
  .mount("/auth", auth.handler);

export const authMacro = new Elysia({ name: "auth.macro" })
  .decorate("cache", new CacheModule())
  .macro({
    auth: {
      resolve: async ({ status, request: { headers }, cache }) => {
        // Try to get session from cache first
        const cacheKey = `session:${headers.get("authorization") || ""}`;
        const cachedSession = await cache.getCacheValue(cacheKey);

        if (cachedSession) {
          return JSON.parse(cachedSession);
        }

        const session = await auth.api.getSession({
          headers
        });

        if (!session) {
          return status(401, "Unauthorized: No active session or invalid account");
        }

        // Store session in cache
        await cache.createCacheKey(cacheKey, JSON.stringify(session), 3600); // Cache for 60 minutes

        return session;
      }
    }
  });

export const authGuard = (macro: typeof authMacro | MockAuth = authMacro) => new Elysia({ name: "auth.guard" })
  .use(macro)
  .guard({ auth: true })
  .macro({
    isAdmin: {
      resolve: async ({ user, status }) => {
        if (!user) return status(401, "Unauthorized: No active session or invalid account");
        if (user.role !== "ADMIN") {
          return status(403, "Forbidden: Admins only");
        }

        return { user };
      }
    },
    isInstructor: {
      resolve: async ({ user, status }) => {
        if (!user) return status(401, "Unauthorized: No active session or invalid account");
        if (user.role === "STUDENT") {
          return status(403, "Forbidden: Instructors only");
        }

        return { user };
      }
    },
    isStudent: {
      resolve: async ({ user, status }) => {
        if (!user) return status(401, "Unauthorized: No active session or invalid account");
        if (user.role !== "STUDENT") {
          return status(403, "Forbidden: Students only");
        }

        return { user };
      }
    }
  });

export type AuthMacro = typeof authMacro | MockAuth;
