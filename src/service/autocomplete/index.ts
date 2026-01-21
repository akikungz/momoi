import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import {
    mapCourseOption,
    mapInstructorOption,
    mapOfferingOption,
    mapSemesterOption,
    mapTemplateOption,
} from "./mappers";
import {
    AutocompleteCacheKeys,
    AutocompleteOptionType,
    AutocompleteQueryType,
    DEFAULT_AUTOCOMPLETE_LIMIT,
} from "./types";

export class AutocompleteService {
    constructor(
        private prisma: PrismaClient,
        private cache: CacheModule
    ) { }

    /**
     * Get course options for autocomplete
     * Label format: "[code] title"
     */
    public async getCoursesOptions(
        query: AutocompleteQueryType
    ): Promise<AutocompleteOptionType[]> {
        const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
        const search = query.search;
        const cacheKey = AutocompleteCacheKeys.courses(search, limit);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const courses = await this.prisma.course.findMany({
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
            select: { id: true, code: true, title: true },
        });

        const response = courses.map(mapCourseOption);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    /**
     * Get semester options for autocomplete
     * Label format: "name"
     */
    public async getSemestersOptions(
        query: AutocompleteQueryType
    ): Promise<AutocompleteOptionType[]> {
        const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
        const search = query.search;
        const cacheKey = AutocompleteCacheKeys.semesters(search, limit);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const semesters = await this.prisma.semester.findMany({
            where: search
                ? { name: { contains: search, mode: "insensitive" } }
                : undefined,
            take: limit,
            orderBy: { startDate: "desc" },
            select: { id: true, name: true },
        });

        const response = semesters.map(mapSemesterOption);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    /**
     * Get instructor options for autocomplete
     * Label format: "name (email)"
     */
    public async getInstructorsOptions(
        query: AutocompleteQueryType
    ): Promise<AutocompleteOptionType[]> {
        const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
        const search = query.search;
        const cacheKey = AutocompleteCacheKeys.instructors(search, limit);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const instructors = await this.prisma.platformUser.findMany({
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
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    /**
     * Get PVE template options for autocomplete
     * Label format: "name"
     */
    public async getTemplatesOptions(
        query: AutocompleteQueryType
    ): Promise<AutocompleteOptionType[]> {
        const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
        const search = query.search;
        const cacheKey = AutocompleteCacheKeys.templates(search, limit);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const templates = await this.prisma.pVETemplate.findMany({
            where: search
                ? { name: { contains: search, mode: "insensitive" } }
                : undefined,
            take: limit,
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        });

        const response = templates.map(mapTemplateOption);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    /**
     * Get course offering options for autocomplete
     * Label format: "[course code] course title - semester"
     */
    public async getCourseOfferingsOptions(
        query: AutocompleteQueryType
    ): Promise<AutocompleteOptionType[]> {
        const limit = query.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT;
        const search = query.search;
        const cacheKey = AutocompleteCacheKeys.offerings(search, limit);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const offerings = await this.prisma.courseOffering.findMany({
            where: search
                ? {
                    OR: [
                        { course: { code: { contains: search, mode: "insensitive" } } },
                        { course: { title: { contains: search, mode: "insensitive" } } },
                        { semester: { name: { contains: search, mode: "insensitive" } } },
                    ],
                }
                : undefined,
            take: limit,
            orderBy: { semester: { startDate: "desc" } },
            select: {
                id: true,
                course: { select: { code: true, title: true } },
                semester: { select: { name: true } },
            },
        });

        const response = offerings.map(mapOfferingOption);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }
}

// Re-export for convenience
export * from "./mappers";
export * from "./types";
