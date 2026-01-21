import { Static } from "elysia";

import {
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

// -------------------- Type exports --------------------

export type MailingListEntry = Static<typeof InstructorMailingListValue>;
export type MailingListResponse = Static<typeof GetInstructorMailingListResponse>;

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

// -------------------- Cache key builders --------------------

export const AcademicCacheKeys = {
    // Mailing list
    mailingList: (page: number, pageSize: number, email?: string) =>
        `academic:mailing:page:${page}:size:${pageSize}:email:${email ?? "all"}`,
    mailingListPattern: () => "academic:mailing:*",

    // Instructors
    instructorList: (page: number, pageSize: number, name?: string, email?: string) =>
        `academic:instructors:page:${page}:size:${pageSize}:name:${name ?? "all"}:email:${email ?? "all"}`,
    instructorDetail: (id: number) => `academic:instructor:${id}`,
    instructorListPattern: () => "academic:instructors:*",

    // Courses
    courseList: (page: number, pageSize: number, code?: string, title?: string) =>
        `academic:courses:page:${page}:size:${pageSize}:code:${code ?? "all"}:title:${title ?? "all"}`,
    courseDetail: (id: number) => `academic:course:${id}`,
    courseListPattern: () => "academic:courses:*",

    // Semesters
    semesterList: (page: number, pageSize: number, name?: string, dateFrom?: Date, dateTo?: Date) =>
        `academic:semesters:page:${page}:size:${pageSize}:name:${name ?? "all"}:from:${dateFrom ?? "none"}:to:${dateTo ?? "none"}`,
    semesterDetail: (id: number) => `academic:semester:${id}`,
    semesterCurrent: () => "academic:semester:current",
    semesterListPattern: () => "academic:semesters:*",

    // Autocomplete patterns
    autocompleteInstructors: () => "autocomplete:instructors:*",
    autocompleteCourses: () => "autocomplete:courses:*",
    autocompleteSemesters: () => "autocomplete:semesters:*",
    autocompleteOfferings: () => "autocomplete:offerings:*",
} as const;
