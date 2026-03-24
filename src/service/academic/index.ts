import type { Static } from "elysia";

import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import type {
	AddCourseRequestBody,
	AddInstructorMailingListRequestBody,
	AddSemesterRequestBody,
	AddSemesterResponse,
	EditCourseByIdRequestBody,
	EditCourseInstructorRequestBody,
	EditCourseInstructorResponse,
	EditCourseSemesterRequestBody,
	EditCourseSemesterResponse,
	EditInstructorByIdRequestBody,
	EditSemesterByIdRequestBody,
	EditSemesterCourseRequestBody,
	EditSemesterCourseResponse,
	GetCoursesRequestQuery,
	GetInstructorMailingListQuery,
	GetInstructorsRequestQuery,
	GetSemestersRequestQuery,
} from "@momoi/model/academic";
import { createAcademicUseCases } from "@momoi/modules/academic";

import type { Course, MailingListEntry, Semester } from "./types";

export class AcademicService {
	private readonly useCases;

	constructor(prisma: PrismaClient, cache: CacheModule) {
		this.useCases = createAcademicUseCases(prisma, cache);
	}

	public async getInstructorMailingList(
		query: Static<typeof GetInstructorMailingListQuery>,
	) {
		return this.useCases.getInstructorMailingList(query);
	}

	public async addInstructorMailingList(
		body: Static<typeof AddInstructorMailingListRequestBody>,
	): Promise<MailingListEntry> {
		return this.useCases.addInstructorMailingList(body);
	}

	public async removeInstructorMailingList(
		mailingId: number,
	): Promise<{ success: boolean }> {
		return this.useCases.removeInstructorMailingList(mailingId);
	}

	public async getInstructors(
		query: Static<typeof GetInstructorsRequestQuery>,
	) {
		return this.useCases.getInstructors(query);
	}

	public async getInstructorById(instructorId: number) {
		return this.useCases.getInstructorById(instructorId);
	}

	public async editInstructorById(
		instructorId: number,
		body: Static<typeof EditInstructorByIdRequestBody>,
	) {
		return this.useCases.editInstructorById(instructorId, body);
	}

	public async getCourses(query: Static<typeof GetCoursesRequestQuery>) {
		return this.useCases.getCourses(query);
	}

	public async getCourseById(courseId: number) {
		return this.useCases.getCourseById(courseId);
	}

	public async addCourse(
		body: Static<typeof AddCourseRequestBody>,
	): Promise<Course> {
		return this.useCases.addCourse(body);
	}

	public async editCourseById(
		courseId: number,
		body: Static<typeof EditCourseByIdRequestBody>,
	): Promise<Course> {
		return this.useCases.editCourseById(courseId, body);
	}

	public async editCourseInstructors(
		courseId: number,
		body: Static<typeof EditCourseInstructorRequestBody>,
	): Promise<Static<typeof EditCourseInstructorResponse>> {
		return this.useCases.editCourseInstructors(courseId, body);
	}

	public async editCourseSemesters(
		courseId: number,
		body: Static<typeof EditCourseSemesterRequestBody>,
	): Promise<Static<typeof EditCourseSemesterResponse>> {
		return this.useCases.editCourseSemesters(courseId, body);
	}

	public async getSemesters(query: Static<typeof GetSemestersRequestQuery>) {
		return this.useCases.getSemesters(query);
	}

	public async getSemesterById(semesterId: number) {
		return this.useCases.getSemesterById(semesterId);
	}

	public async getCurrentSemester() {
		return this.useCases.getCurrentSemester();
	}

	public async addSemester(
		body: Static<typeof AddSemesterRequestBody>,
	): Promise<Static<typeof AddSemesterResponse>> {
		return this.useCases.addSemester(body);
	}

	public async editSemesterById(
		semesterId: number,
		body: Static<typeof EditSemesterByIdRequestBody>,
	): Promise<Semester> {
		return this.useCases.editSemesterById(semesterId, body);
	}

	public async editSemesterCourses(
		semesterId: number,
		body: Static<typeof EditSemesterCourseRequestBody>,
	): Promise<Static<typeof EditSemesterCourseResponse>> {
		return this.useCases.editSemesterCourses(semesterId, body);
	}

	public async deleteSemesterById(
		semesterId: number,
	): Promise<{ success: boolean }> {
		return this.useCases.deleteSemesterById(semesterId);
	}
}

export * from "./selects";
export * from "./mappers";
export * from "./types";
