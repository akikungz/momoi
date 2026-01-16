import { Static } from "elysia";

import { AutocompleteOption, AutocompleteQuery } from "@momoi/model/autocomplete";

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

type AutocompleteQueryType = Static<typeof AutocompleteQuery>;
type AutocompleteOptionType = Static<typeof AutocompleteOption>;

export class AutocompleteService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
  ) { }

  /**
   * Get course options for autocomplete
   * Label format: "[code] title"
   */
  public async getCoursesOptions(query: AutocompleteQueryType): Promise<AutocompleteOptionType[]> {
    const limit = query.limit ?? 10;
    const search = query.search;
    const cacheKey = `autocomplete:courses:search:${search ?? 'all'}:limit:${limit}`;

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

    const response = courses.map((course) => ({
      id: course.id,
      label: `[${course.code}] ${course.title}`,
    }));

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
    return response;
  }

  /**
   * Get semester options for autocomplete
   * Label format: "name"
   */
  public async getSemestersOptions(query: AutocompleteQueryType): Promise<AutocompleteOptionType[]> {
    const limit = query.limit ?? 10;
    const search = query.search;
    const cacheKey = `autocomplete:semesters:search:${search ?? 'all'}:limit:${limit}`;

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

    const response = semesters.map((semester) => ({
      id: semester.id,
      label: semester.name,
    }));

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
    return response;
  }

  /**
   * Get instructor options for autocomplete
   * Label format: "name (email)"
   */
  public async getInstructorsOptions(query: AutocompleteQueryType): Promise<AutocompleteOptionType[]> {
    const limit = query.limit ?? 10;
    const search = query.search;
    const cacheKey = `autocomplete:instructors:search:${search ?? 'all'}:limit:${limit}`;

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

    const response = instructors.map((instructor) => ({
      id: instructor.id,
      label: `${instructor.user?.name ?? "Unknown"} (${instructor.user?.email ?? "no email"})`,
    }));

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
    return response;
  }

  /**
   * Get PVE template options for autocomplete
   * Label format: "name"
   */
  public async getTemplatesOptions(query: AutocompleteQueryType): Promise<AutocompleteOptionType[]> {
    const limit = query.limit ?? 10;
    const search = query.search;
    const cacheKey = `autocomplete:templates:search:${search ?? 'all'}:limit:${limit}`;

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

    const response = templates.map((template) => ({
      id: template.id,
      label: template.name,
    }));

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
    return response;
  }

  /**
   * Get course offering options for autocomplete
   * Label format: "[course code] course title - semester"
   */
  public async getCourseOfferingsOptions(query: AutocompleteQueryType): Promise<AutocompleteOptionType[]> {
    const limit = query.limit ?? 10;
    const search = query.search;
    const cacheKey = `autocomplete:offerings:search:${search ?? 'all'}:limit:${limit}`;

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

    const response = offerings.map((offering) => ({
      id: offering.id,
      label: `[${offering.course.code}] ${offering.course.title} - ${offering.semester.name}`,
    }));

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
    return response;
  }
}
