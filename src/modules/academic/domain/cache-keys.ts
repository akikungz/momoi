export const AcademicCacheKeys = {
	mailingList: (page: number, pageSize: number, email?: string) =>
		`academic:mailing:page:${page}:size:${pageSize}:email:${email ?? "all"}`,
	mailingListPattern: () => "academic:mailing:*",

	instructorList: (
		page: number,
		pageSize: number,
		name?: string,
		email?: string,
	) =>
		`academic:instructors:page:${page}:size:${pageSize}:name:${name ?? "all"}:email:${email ?? "all"}`,
	instructorDetail: (id: number) => `academic:instructor:${id}`,
	instructorListPattern: () => "academic:instructors:*",

	courseList: (page: number, pageSize: number, code?: string, title?: string) =>
		`academic:courses:page:${page}:size:${pageSize}:code:${code ?? "all"}:title:${title ?? "all"}`,
	courseDetail: (id: number) => `academic:course:${id}`,
	courseListPattern: () => "academic:courses:*",

	semesterList: (
		page: number,
		pageSize: number,
		name?: string,
		dateFrom?: Date,
		dateTo?: Date,
	) =>
		`academic:semesters:page:${page}:size:${pageSize}:name:${name ?? "all"}:from:${dateFrom ?? "none"}:to:${dateTo ?? "none"}`,
	semesterDetail: (id: number) => `academic:semester:${id}`,
	semesterCurrent: () => "academic:semester:current",
	semesterNext: () => "academic:semester:next",
	semesterListPattern: () => "academic:semesters:*",

	autocompleteInstructors: () => "autocomplete:instructors:*",
	autocompleteCourses: () => "autocomplete:courses:*",
	autocompleteSemesters: () => "autocomplete:semesters:*",
	autocompleteOfferings: () => "autocomplete:offerings:*",
} as const;
