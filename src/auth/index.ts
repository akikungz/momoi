import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession, openAPI } from "better-auth/plugins";
import { Elysia, type Context } from "elysia";

import { CacheModule } from "@momoi/cache";
import { prisma } from "@momoi/database";
import { env } from "@momoi/env";
import { logger } from "@momoi/logger";
import { isInstructorEmail, isItDepartmentEmail } from "@momoi/utils/user";

import { MockAuth } from "./mock";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
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
  trustedOrigins: env.ALLOW_CORS_ORIGINS,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
      scope: ["email", "profile"],
      accessType: "offline",
      prompt: "select_account",
      redirectURI: env.BETTER_AUTH_URL ? `${env.BETTER_AUTH_URL}/api/auth/callback/google` : undefined,
    },
  },
  emailAndPassword: {
    enabled: env.NODE_ENV !== "production",
    requireEmailVerification: false,
  },
  advanced: {
    disableCSRFCheck: true,
    trustedProxyHeaders: true,
    ...(
      env.NODE_ENV === "production"
        ? {
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: true,
            path: "/",
          },
          useSecureCookies: true,
        } : {
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: env.BETTER_AUTH_URL?.startsWith("https://") || false,
            path: "/",
          },
          useSecureCookies: env.BETTER_AUTH_URL?.startsWith("https://") || false,
        }
    )
  },
  logger: {
    disabled: false,
    level: "debug",
    log: (level, message, ...args) => {
      switch (level) {
        case "debug":
          logger.debug(message, ...args);
          break;
        case "info":
          logger.info(message, ...args);
          break;
        case "warn":
          logger.warn(message, ...args);
          break;
        case "error":
          logger.error(message, ...args);
          break;
        default:
          logger.info(message, ...args);
      }
    },
  },
  plugins: [
    openAPI(),
    customSession(async ({ user, session }) => {
      // Production: require IT department email
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
            where: {
              email: user.email,
              havePlatformId: false
            },
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

          await prisma.instructorSearch.update({
            where: { email: user.email },
            data: { havePlatformId: true },
          });

          // Clear cache for mailing list
          const cache = new CacheModule();
          await cache.deleteCacheByPattern("academic:mailing:*");
          cache.closeClient();
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

export const authHandler = new Elysia({ name: "auth.handler", prefix: "/auth" })
  .mount(auth.handler)

export const authOpenAPI = async (_auth: typeof auth = auth) => {
  let _schema: ReturnType<typeof _auth.api.generateOpenAPISchema>;
  const getSchema = async () => (_schema ??= _auth.api.generateOpenAPISchema());

  const OpenAPI = {
    getPaths: (prefix = '/api/auth') =>
      getSchema().then(({ paths }) => {
        const reference: typeof paths = Object.create(null)

        for (const path of Object.keys(paths)) {
          const key = prefix + path
          reference[key] = paths[path]

          for (const method of Object.keys(paths[path])) {
            const operation = (reference[key] as any)[method]

            operation.tags = ['Better Auth']
          }
        }

        return reference
      }) as Promise<any>,
    components: getSchema().then(({ components }) => components) as Promise<any>
  } as const;

  return {
    components: await OpenAPI.components,
    paths: await OpenAPI.getPaths(),
  }
}

export const authMacro = new Elysia({ name: "auth.macro" })
  .decorate("cache", new CacheModule())
  .macro({
    auth: {
      resolve: async ({ status, request: { headers }, cache, cookie }) => {
        // Try to get session from cache first
        const cookie_token = env.BETTER_AUTH_URL?.startsWith("https://") ? cookie["__Secure-better-auth.session_token"] : cookie["better-auth.session_token"];
        const cacheKey = `session:${cookie_token}`;
        const cachedSession = await cache.getCacheValue(cacheKey);

        if (cachedSession) {
          return JSON.parse(cachedSession);
        }

        const session = await auth.api.getSession({ headers });

        if (!session) {
          return status(401, { status: 401, message: "Unauthorized: No active session or invalid account" });
        }

        // Store session in cache
        await cache.createCacheKey(cacheKey, JSON.stringify(session), 3600); // Cache for 60 minutes

        return {
          user: session.user,
          session: session.session,
        }
      }
    }
  });

export const authGuard = (macro: typeof authMacro | MockAuth = authMacro) => new Elysia({ name: "auth.guard" })
  .use(macro)
  .guard({ auth: true })
  .macro({
    isAdmin: {
      resolve: async ({ user, status }) => {
        if (!user) return status(401, { status: 401, message: "Unauthorized: No active session or invalid account" });
        if (user.role !== "ADMIN") {
          return status(403, { status: 403, message: "Forbidden: Admins only" });
        }

        return { user };
      }
    },
    isInstructor: {
      resolve: async ({ user, status }) => {
        if (!user) return status(401, { status: 401, message: "Unauthorized: No active session or invalid account" });
        if (user.role === "STUDENT") {
          return status(403, { status: 403, message: "Forbidden: Instructors and Admins only" });
        }

        return { user };
      }
    },
    isStudent: {
      resolve: async ({ user, status }) => {
        if (!user) return status(401, { status: 401, message: "Unauthorized: No active session or invalid account" });
        if (user.role !== "STUDENT") {
          return status(403, { status: 403, message: "Forbidden: Students only" });
        }

        return { user };
      }
    }
  });

export type AuthMacro = typeof authMacro | MockAuth;
