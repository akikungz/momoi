import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import { createAutocompleteUseCases } from "@momoi/modules/autocomplete";

import type { AutocompleteOptionType, AutocompleteQueryType } from "./types";

export class AutocompleteService {
	private readonly useCases;

	constructor(prisma: PrismaClient, cache: CacheModule) {
		this.useCases = createAutocompleteUseCases(prisma, cache);
	}

	public async getCoursesOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		return this.useCases.getCoursesOptions(query);
	}

	public async getSemestersOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		return this.useCases.getSemestersOptions(query);
	}

	public async getInstructorsOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		return this.useCases.getInstructorsOptions(query);
	}

	public async getTemplatesOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		return this.useCases.getTemplatesOptions(query);
	}

	public async getCourseOfferingsOptions(
		query: AutocompleteQueryType,
	): Promise<AutocompleteOptionType[]> {
		return this.useCases.getCourseOfferingsOptions(query);
	}
}

export * from "./mappers";
export * from "./types";
