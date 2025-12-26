import { Elysia, t } from 'elysia';

import { AuthMacro } from '@momoi/auth';
import { CacheModule } from '@momoi/cache';
import { PrismaClient } from '@momoi/database';
import { instanceModel } from '@momoi/model/instance';
import { InstanceService } from '@momoi/service/instance';

export const instanceRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro
) => new Elysia({ name: "instance.route", prefix: "/instances" })
  .use(auth)
  .use(instanceModel)
  .guard({ auth: true })
  .decorate("instanceService", new InstanceService(prisma, cache))
  .post(
    "/",
    async ({ instanceService, user, body, status }) => {
      if (user.role === "STUDENT") return status(403, "Forbidden: Students cannot create instances");
      return await instanceService.createInstanceByInstructor(user.id, body);
    },
    {
      body: "CreateInstanceRequestBody",
      response: {
        200: "CreateInstanceResponse",
        403: t.String({ description: "Forbidden: Students cannot create instances" }),
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
    "/instructor/:instructorId",
    async ({ instanceService, params, query }) => {
      return await instanceService.getInstancesByInstructor(params.instructorId, query);
    },
    {
      params: t.Object({
        instructorId: t.Number({ description: "Unique identifier for the instructor" }),
      }),
      query: "GetInstancesRequestQuery",
      response: "GetInstancesResponse",
      detail: {
        summary: "Get instances for a specific instructor",
        description: "Retrieve all instances created by a specific instructor",
        tags: ["Instances"],
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
  );
