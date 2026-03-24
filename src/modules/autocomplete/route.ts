import { Elysia } from "elysia";

import type { AuthMacro } from "@momoi/auth";
import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database";
import { autocompleteModel } from "@momoi/model/autocomplete";

import { createAutocompleteUseCases } from ".";

export const autocompleteRoute = (
	prisma: PrismaClient,
	cache: CacheModule,
	auth: AuthMacro,
) => {
	const useCases = createAutocompleteUseCases(prisma, cache);

	return new Elysia({ name: "autocomplete.route", prefix: "/autocomplete" })
		.use(auth)
		.use(autocompleteModel)
		.guard({ auth: true })
		.get("/courses", async ({ query }) => useCases.getCoursesOptions(query), {
			query: "AutocompleteQuery",
			response: "AutocompleteResponse",
			detail: {
				summary: "Get course options",
				description: "Get autocomplete options for courses",
				tags: ["Autocomplete"],
			},
		})
		.get(
			"/semesters",
			async ({ query }) => useCases.getSemestersOptions(query),
			{
				query: "AutocompleteQuery",
				response: "AutocompleteResponse",
				detail: {
					summary: "Get semester options",
					description: "Get autocomplete options for semesters",
					tags: ["Autocomplete"],
				},
			},
		)
		.get(
			"/instructors",
			async ({ query }) => useCases.getInstructorsOptions(query),
			{
				query: "AutocompleteQuery",
				response: "AutocompleteResponse",
				detail: {
					summary: "Get instructor options",
					description: "Get autocomplete options for instructors",
					tags: ["Autocomplete"],
				},
			},
		)
		.get(
			"/templates",
			async ({ query }) => useCases.getTemplatesOptions(query),
			{
				query: "AutocompleteQuery",
				response: "AutocompleteResponse",
				detail: {
					summary: "Get template options",
					description: "Get autocomplete options for PVE templates",
					tags: ["Autocomplete"],
				},
			},
		)
		.get(
			"/course-offerings",
			async ({ query }) => useCases.getCourseOfferingsOptions(query),
			{
				query: "AutocompleteQuery",
				response: "AutocompleteResponse",
				detail: {
					summary: "Get course offering options",
					description: "Get autocomplete options for course offerings",
					tags: ["Autocomplete"],
				},
			},
		);
};
