import type { Static } from "elysia";

import type {
	CourseValue,
	GetCourseByIdResponse,
	GetCoursesResponse,
	GetCurrentSemesterResponse,
	GetInstructorByIdResponse,
	GetInstructorMailingListResponse,
	GetInstructorsResponse,
	GetSemesterByIdResponse,
	GetSemestersResponse,
	InstructorMailingListValue,
	InstructorValue,
	SemesterValue,
} from "@momoi/model/academic";
import { AcademicCacheKeys } from "@momoi/modules/academic";

// -------------------- Type exports --------------------

export type MailingListEntry = Static<typeof InstructorMailingListValue>;
export type MailingListResponse = Static<
	typeof GetInstructorMailingListResponse
>;

export type Instructor = Static<typeof InstructorValue>;
export type InstructorListResponse = Static<typeof GetInstructorsResponse>;
export type InstructorDetailResponse = Static<typeof GetInstructorByIdResponse>;

export type Course = Static<typeof CourseValue>;
export type CourseListResponse = Static<typeof GetCoursesResponse>;
export type CourseDetailResponse = Static<typeof GetCourseByIdResponse>;

export type Semester = Static<typeof SemesterValue>;
export type SemesterListResponse = Static<typeof GetSemestersResponse>;
export type SemesterDetailResponse = Static<typeof GetSemesterByIdResponse>;
export type CurrentSemesterResponse = Static<typeof GetCurrentSemesterResponse>;

export { AcademicCacheKeys };
