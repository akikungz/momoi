import { Elysia, t } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { instanceModel } from "@momoi/model/instance";
import { requestModel } from "@momoi/model/request";
import { ErrorResponse } from "@momoi/model/shared/error";
import { QueueModule } from "@momoi/queue";
import { InstanceService } from "@momoi/service/instance";
import { RequestService } from "@momoi/service/request";

export const instanceRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro,
  queue: QueueModule
) => new Elysia({ name: "instance.route", prefix: "/instances" })
  .use(auth)
  .use(instanceModel)
  .use(requestModel)
  .guard({ auth: true })
  .decorate("instanceService", new InstanceService(prisma, cache, queue))
  .decorate("requestService", new RequestService(prisma, cache, queue))
  .post(
    "/",
    async ({ instanceService, user, body, status }) => {
      if (user.role === "STUDENT") return status(403, { status: 403, message: "Forbidden: Students cannot create instances" });
      return await instanceService.createInstanceByInstructor(user.id, body);
    },
    {
      body: "CreateInstanceRequestBody",
      response: {
        200: "CreateInstanceResponse",
        403: ErrorResponse,
      },
      detail: {
        summary: "Create a new instance",
        description: "Create a new instance as an instructor",
        tags: ["Instances"],
      },
    }
  )
  .get(
    "/",
    async ({ instanceService, user, query }) => {
      return await instanceService.getInstancesByUser(user.id, query);
    },
    {
      query: "GetInstancesRequestQuery",
      response: "GetInstancesResponse",
      detail: {
        summary: "Get instances for the current user",
        description: "Retrieve all instances created by the current user",
        tags: ["Instances"],
      },
    }
  )
  .get(
    "/admin",
    async ({ instanceService, query }) => {
      return await instanceService.getInstancesByAdmin(query);
    },
    {
      query: "GetInstancesRequestQuery",
      response: "GetInstancesResponse",
      detail: {
        summary: "Get all instances (admin)",
        description: "Retrieve all instances in the system",
        tags: ["Instances"],
      },
    }
  )
  .get(
    "/instructor",
    async ({ instanceService, query, user, status }) => {
      if (user.role === "STUDENT") return status(403, { status: 403, message: "Forbidden: Students cannot view instructor instances" });

      return await instanceService.getInstancesByInstructor(user.id, query);
    },
    {
      query: "GetInstancesRequestQuery",
      response: {
        200: "GetInstancesResponse",
        403: ErrorResponse,
      },
      detail: {
        summary: "Get instances for a specific instructor",
        description: "Retrieve all instances created by a specific instructor",
        tags: ["Instances"],
      },
      guard: {
        auth: {
          roles: ["ADMIN", "INSTRUCTOR"],
        }
      },
    }
  )
  .get(
    "/:instanceId",
    async ({ instanceService, params }) => {
      return await instanceService.getInstanceById(params.instanceId);
    },
    {
      params: "GetInstanceRequestParams",
      response: "GetInstanceResponse",
      detail: {
        summary: "Get a specific instance",
        description: "Retrieve details of a specific instance by ID",
        tags: ["Instances"],
      },
    }
  )
  .delete(
    "/:instanceId",
    async ({ instanceService, params }) => {
      return await instanceService.deleteInstance(params.instanceId);
    },
    {
      params: "DeleteInstanceRequestParams",
      response: "DeleteInstanceResponse",
      detail: {
        summary: "Delete an instance",
        description: "Delete a specific instance by ID",
        tags: ["Instances"],
      },
    }
  )
  // Reverse Proxy Management
  .post(
    "/:instanceId/reverse-proxies",
    async ({ instanceService, params, body }) => {
      return await instanceService.createReverseProxy(params.instanceId, body);
    },
    {
      params: t.Object({
        instanceId: t.Number({ description: "Unique identifier for the instance" }),
      }),
      body: "CreateReverseProxyRequestBody",
      response: "CreateReverseProxyResponse",
      detail: {
        summary: "Create a reverse proxy",
        description: "Create a reverse proxy configuration for the instance",
        tags: ["Instances", "Reverse Proxy"],
      },
    }
  )
  .get(
    "/:instanceId/reverse-proxies",
    async ({ instanceService, params }) => {
      return await instanceService.getReverseProxies(params.instanceId);
    },
    {
      params: t.Object({
        instanceId: t.Number({ description: "Unique identifier for the instance" }),
      }),
      response: "GetReverseProxiesResponse",
      detail: {
        summary: "Get reverse proxies",
        description: "Retrieve all reverse proxy configurations for the instance",
        tags: ["Instances", "Reverse Proxy"],
      },
    }
  )
  .delete(
    "/:instanceId/reverse-proxies/:proxyId",
    async ({ instanceService, params }) => {
      return await instanceService.deleteReverseProxy(params.instanceId, params.proxyId);
    },
    {
      params: "DeleteReverseProxyRequestParams",
      response: "DeleteReverseProxyResponse",
      detail: {
        summary: "Delete a reverse proxy",
        description: "Delete a specific reverse proxy configuration from the instance",
        tags: ["Instances", "Reverse Proxy"],
      },
    }
  )
  // Instance Promotion
  .patch(
    "/:instanceId/promote",
    async ({ instanceService, user, params, status }) => {
      if (user.role !== "ADMIN") {
        return status(403, { status: 403, message: "Forbidden: Only admins can promote instances" });
      }

      return await instanceService.promoteInstance(params.instanceId, user.id);
    },
    {
      params: "PromoteInstanceRequestParams",
      response: {
        200: "PromoteInstanceResponse",
        403: ErrorResponse,
      },
      detail: {
        summary: "Promote instance",
        description: "Promote an instance to long-term/production status",
        tags: ["Instances"],
      },
    }
  )
  // Audit Logs
  .get(
    "/:instanceId/audit-logs",
    async ({ instanceService, params, query, user, status }) => {
      if (user.role === "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Students cannot view instance audit logs" });
      }

      return await instanceService.getInstanceAuditLogs(
        params.instanceId,
        query.page,
        query.pageSize
      );
    },
    {
      params: t.Object({
        instanceId: t.Number({ description: "Unique identifier for the instance" }),
      }),
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 10 })),
      }),
      response: {
        200: "GetInstanceAuditLogsResponse",
        403: ErrorResponse,
      },
      detail: {
        summary: "Get instance audit logs",
        description: "Retrieve audit log entries for the instance",
        tags: ["Instances", "Audit Logs"],
      },
    }
  )
  // Extended Request
  .post(
    "/:instanceId/extended-request",
    async ({ requestService, user, params, body, status }) => {
      if (user.role !== "STUDENT") {
        return status(403, { status: 403, message: "Forbidden: Only students can create extended requests" });
      }

      return await requestService.createExtendedRequest(user.id, {
        ...body,
        targetInstanceId: params.instanceId,
      });
    },
    {
      params: t.Object({
        instanceId: t.Number({ description: "Instance ID to extend" }),
      }),
      body: "CreateInstanceExtendedRequestBody",
      response: {
        200: "CreateExtendedRequestResponse",
        403: ErrorResponse,
      },
      detail: {
        summary: "Create an extended request for an instance",
        description: "Students request to extend their instance to the next semester",
        tags: ["Instances", "Extended Requests"],
      },
    }
  );
