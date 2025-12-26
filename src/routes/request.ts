import { Elysia, t } from 'elysia';

import { AuthMacro } from '@momoi/auth';
import { CacheModule } from '@momoi/cache';
import { PrismaClient } from '@momoi/database';
import { requestModel } from '@momoi/model/request';
import { RequestService } from '@momoi/service/request';

export const requestRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro,
) => new Elysia({ name: "request.route" })
  .use(auth)
  .use(requestModel)
  .guard({ auth: true })
  .decorate("requestService", new RequestService(prisma, cache))

  // Standard requests
  .group("/requests", app => app
    .post("/", async ({ requestService, user, body, status }) => {
      if (user.role !== "STUDENT") {
        return status(403, "Forbidden: Only students can create requests");
      }

      return requestService.createRequest(user.id, body);
    }, {
      body: "CreateRequestRequestBody",
      response: {
        200: "CreateRequestResponse",
        403: t.String(),
      },
      detail: {
        summary: "Create a new request",
        description: "Students submit an instance request for instructor/admin review",
        tags: ["Requests"],
      }
    })
    .get("/", async ({ requestService, user, query }) => {
      return requestService.getRequests(user, query);
    }, {
      query: "GetRequestsRequestQuery",
      response: "GetRequestsResponse",
      detail: {
        summary: "List requests",
        description: "List requests visible to the current user",
        tags: ["Requests"],
      }
    })
    .patch("/:requestId/status", async ({ requestService, user, params, body }) => {
      return requestService.updateRequestStatus(user, params.requestId, body);
    }, {
      params: t.Object({ requestId: t.Number({ description: "Request ID" }) }),
      body: "UpdateRequestStatusRequestBody",
      response: {
        200: "UpdateRequestStatusResponse",
        403: t.String(),
      },
      detail: {
        summary: "Act on a request",
        description: "Approve, reject, or cancel a request depending on role",
        tags: ["Requests"],
      }
    })
  )

  // Extended requests
  .group("/extended-requests", app => app
    .post("/", async ({ requestService, user, body, status }) => {
      if (user.role !== "STUDENT") {
        return status(403, "Forbidden: Only students can create extended requests");
      }

      return requestService.createExtendedRequest(user.id, body);
    }, {
      body: "CreateExtendedRequestRequestBody",
      response: {
        200: "CreateExtendedRequestResponse",
        403: t.String(),
      },
      detail: {
        summary: "Create an extended request",
        description: "Students request changes related to an existing instance",
        tags: ["Extended Requests"],
      }
    })
    .get("/", async ({ requestService, user, query }) => {
      return requestService.getExtendedRequests(user, query);
    }, {
      query: "GetExtendedRequestsRequestQuery",
      response: "GetExtendedRequestsResponse",
      detail: {
        summary: "List extended requests",
        description: "List extended requests visible to the current user",
        tags: ["Extended Requests"],
      }
    })
    .patch("/:extendedRequestId/status", async ({ requestService, user, params, body }) => {
      return requestService.updateExtendedRequestStatus(user, params.extendedRequestId, body);
    }, {
      params: t.Object({ extendedRequestId: t.Number({ description: "Extended request ID" }) }),
      body: "UpdateExtendedRequestStatusRequestBody",
      response: {
        200: "UpdateExtendedRequestStatusResponse",
        403: t.String(),
      },
      detail: {
        summary: "Act on an extended request",
        description: "Approve, reject, or cancel an extended request depending on role",
        tags: ["Extended Requests"],
      }
    })
  );