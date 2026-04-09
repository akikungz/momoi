import type {
	AutocompleteOptionType,
	AutocompleteQueryType,
} from "@momoi/service/autocomplete/types";

import {
	mapCourseOption,
	mapInstructorOption,
	mapOfferingOption,
	mapSemesterOption,
	mapTemplateOption,
} from "@momoi/service/autocomplete/mappers";

import type { AutocompleteDataAccess, JsonCacheStore } from "./ports";
import {
	AutocompleteCacheKeys,
	DEFAULT_AUTOCOMPLETE_LIMIT,
} from "../domain/cache-keys";

export class AutocompleteUseCases {
	constructor(
		private readonly dataAccess: AutocompleteDataAccess,
		private readonly cache: JsonCacheStore,
	) {}

	public async getCoursesOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
		const search = query.search;
		const cacheKey = AutocompleteCacheKeys.courses(search, limit);
		const cached = await this.cache.get<AutocompleteOptionType[]>(cacheKey);
		if (cached) return cached;

		const courses = await this.dataAccess.prisma.course.findMany({
			where: search
				? {
						OR: [
							{ code: { contains: search, mode: "insensitive" } },
							{ title: { contains: search, mode: "insensitive" } },
						],
					}
				: undefined,
			take: limit,
			orderBy: { code: "asc" },
			select: { id: true, code: true, title: true, isProjectBased: true },
		});

		const response = courses.map(mapCourseOption);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	public async getSemestersOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
		const search = query.search;
		const cacheKey = AutocompleteCacheKeys.semesters(search, limit);
		const cached = await this.cache.get<AutocompleteOptionType[]>(cacheKey);
		if (cached) return cached;

		const semesters = await this.dataAccess.prisma.semester.findMany({
			where: search
				? { name: { contains: search, mode: "insensitive" } }
				: undefined,
			take: limit,
			orderBy: { startDate: "desc" },
			select: { id: true, name: true },
		});

		const response = semesters.map(mapSemesterOption);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	public async getInstructorsOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
		const search = query.search;
		const cacheKey = AutocompleteCacheKeys.instructors(search, limit);
		const cached = await this.cache.get<AutocompleteOptionType[]>(cacheKey);
		if (cached) return cached;

		const instructors = await this.dataAccess.prisma.platformUser.findMany({
			where: {
				role: { in: ["ADMIN", "INSTRUCTOR"] },
				...(search
					? {
							user: {
								OR: [
									{ name: { contains: search, mode: "insensitive" } },
									{ email: { contains: search, mode: "insensitive" } },
								],
							},
						}
					: {}),
			},
			take: limit,
			orderBy: { user: { name: "asc" } },
			select: {
				id: true,
				user: { select: { name: true, email: true } },
			},
		});

		const response = instructors.map(mapInstructorOption);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	public async getTemplatesOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
		const search = query.search;
		const cacheKey = AutocompleteCacheKeys.templates(search, limit);
		const cached = await this.cache.get<AutocompleteOptionType[]>(cacheKey);
		if (cached) return cached;

		const templates = await this.dataAccess.prisma.pVETemplate.findMany({
			where: search
				? { name: { contains: search, mode: "insensitive" } }
				: undefined,
			take: limit,
			orderBy: { name: "asc" },
			select: { id: true, name: true },
		});

		const response = templates.map(mapTemplateOption);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	public async getCourseOfferingsOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
		const search = query.search;
		const cacheKey = AutocompleteCacheKeys.offerings(search, limit);
		const cached = await this.cache.get<AutocompleteOptionType[]>(cacheKey);
		if (cached) return cached;

		const currentDate = new Date();

		const offerings = await this.dataAccess.prisma.courseOffering.findMany({
			where: {
				course: {
					isActive: true,
				},
				semester: {
					endDate: { gte: currentDate },
					startDate: { lte: currentDate },
				},
				...(search
					? {
							OR: [
								{ course: { code: { contains: search, mode: "insensitive" } } },
								{ course: { title: { contains: search, mode: "insensitive" } } },
								{ semester: {name: { contains: search, mode: "insensitive" } } },
							],
						}
					: {}),
			},
			take: limit,
			orderBy: { semester: { startDate: "desc" } },
			select: {
				id: true,
				course: { select: { code: true, title: true, isProjectBased: true } },
				semester: { select: { name: true } },
			},
		});

		const response = offerings.map(mapOfferingOption);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}
}
