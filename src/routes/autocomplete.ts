import { Elysia } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { PrismaClient } from "@momoi/database";
import { autocompleteModel } from "@momoi/model/autocomplete";
import { AutocompleteService } from "@momoi/service/autocomplete";

export const autocompleteRoute = (
  prisma: PrismaClient,
  auth: AuthMacro,
) => new Elysia({ name: "autocomplete.route", prefix: "/autocomplete" })
  .use(auth)
  .use(autocompleteModel)
  .guard({ auth: true })
  .decorate("autocompleteService", new AutocompleteService(prisma))
  .get(
    "/courses",
    async ({ autocompleteService, query }) => {
      return await autocompleteService.getCoursesOptions(query);
    },
    {
      query: "AutocompleteQuery",
      response: "AutocompleteResponse",
      detail: {
        summary: "Get course options",
        description: "Get autocomplete options for courses",
        tags: ["Autocomplete"],
      },
    }
  )
  .get(
    "/semesters",
    async ({ autocompleteService, query }) => {
      return await autocompleteService.getSemestersOptions(query);
    },
    {
      query: "AutocompleteQuery",
      response: "AutocompleteResponse",
      detail: {
        summary: "Get semester options",
        description: "Get autocomplete options for semesters",
        tags: ["Autocomplete"],
      },
    }
  )
  .get(
    "/instructors",
    async ({ autocompleteService, query }) => {
      return await autocompleteService.getInstructorsOptions(query);
    },
    {
      query: "AutocompleteQuery",
      response: "AutocompleteResponse",
      detail: {
        summary: "Get instructor options",
        description: "Get autocomplete options for instructors",
        tags: ["Autocomplete"],
      },
    }
  )
  .get(
    "/templates",
    async ({ autocompleteService, query }) => {
      return await autocompleteService.getTemplatesOptions(query);
    },
    {
      query: "AutocompleteQuery",
      response: "AutocompleteResponse",
      detail: {
        summary: "Get template options",
        description: "Get autocomplete options for PVE templates",
        tags: ["Autocomplete"],
      },
    }
  )
  .get(
    "/course-offerings",
    async ({ autocompleteService, query }) => {
      return await autocompleteService.getCourseOfferingsOptions(query);
    },
    {
      query: "AutocompleteQuery",
      response: "AutocompleteResponse",
      detail: {
        summary: "Get course offering options",
        description: "Get autocomplete options for course offerings",
        tags: ["Autocomplete"],
      },
    }
  );
