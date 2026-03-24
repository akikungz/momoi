export const AutocompleteCacheKeys = {
	courses: (search?: string, limit?: number) =>
		`autocomplete:courses:search:${search ?? "all"}:limit:${limit ?? 10}`,
	semesters: (search?: string, limit?: number) =>
		`autocomplete:semesters:search:${search ?? "all"}:limit:${limit ?? 10}`,
	instructors: (search?: string, limit?: number) =>
		`autocomplete:instructors:search:${search ?? "all"}:limit:${limit ?? 10}`,
	templates: (search?: string, limit?: number) =>
		`autocomplete:templates:search:${search ?? "all"}:limit:${limit ?? 10}`,
	offerings: (search?: string, limit?: number) =>
		`autocomplete:offerings:search:${search ?? "all"}:limit:${limit ?? 10}`,
} as const;

export const DEFAULT_AUTOCOMPLETE_LIMIT = 10;
