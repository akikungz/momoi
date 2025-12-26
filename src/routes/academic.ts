import { Elysia } from 'elysia';

import { AuthMacro } from '@momoi/auth';
import { CacheModule } from '@momoi/cache';
import { PrismaClient } from '@momoi/database';
import { academicModel } from '@momoi/model/academic';
import { AcademicService } from '@momoi/service/academic';

export const academicRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro,
) => new Elysia({ name: "academic.route", prefix: "/academic" })
  .use(auth)
  .use(academicModel)
  .guard({ auth: true })
  .onBeforeHandle(({ user, status }) => {
    if (user.role !== "ADMIN") {
      return status(403, "Forbidden: Admins only");
    }
  })
  .decorate("academicService", new AcademicService(prisma, cache))

  // Instructor mailing list
  .get("/mailing-list", async ({ academicService, query }) => {
    return academicService.getInstructorMailingList(query);
  }, {
    query: "GetInstructorMailingListQuery",
    response: "GetInstructorMailingListResponse",
  })
  .post("/mailing-list", async ({ academicService, body }) => {
    return academicService.addInstructorMailingList(body);
  }, {
    body: "AddInstructorMailingListRequestBody",
    response: "AddInstructorMailingListResponse",
  })
  .delete("/mailing-list/:mailingId", async ({ academicService, params }) => {
    return academicService.removeInstructorMailingList(params.mailingId);
  }, {
    params: "InstructorMailingListByIdRequestParams",
    response: "RemoveInstructorMailingListResponse",
  })

  // Instructors
  .get("/instructors", async ({ academicService, query }) => {
    return academicService.getInstructors(query);
  }, {
    query: "GetInstructorsRequestQuery",
    response: "GetInstructorsResponse",
  })
  .get("/instructors/:instructorId", async ({ academicService, params }) => {
    return academicService.getInstructorById(Number(params.instructorId));
  }, {
    params: "InstructorByIdRequestParams",
    response: "GetInstructorByIdResponse",
  })
  .patch("/instructors/:instructorId", async ({ academicService, params, body }) => {
    return academicService.editInstructorById(Number(params.instructorId), body);
  }, {
    params: "InstructorByIdRequestParams",
    body: "EditInstructorByIdRequestBody",
    response: "EditInstructorByIdResponse",
  })

  // Courses
  .get("/courses", async ({ academicService, query }) => {
    return academicService.getCourses(query);
  }, {
    query: "GetCoursesRequestQuery",
    response: "GetCoursesResponse",
  })
  .get("/courses/:courseId", async ({ academicService, params }) => {
    return academicService.getCourseById(params.courseId);
  }, {
    params: "CourseByIdRequestParams",
    response: "GetCourseByIdResponse",
  })
  .post("/courses", async ({ academicService, body }) => {
    return academicService.addCourse(body);
  }, {
    body: "AddCourseRequestBody",
    response: "AddCourseResponse",
  })
  .patch("/courses/:courseId", async ({ academicService, params, body }) => {
    return academicService.editCourseById(params.courseId, body);
  }, {
    params: "CourseByIdRequestParams",
    body: "EditCourseByIdRequestBody",
    response: "AddCourseResponse",
  })
  .patch("/courses/:courseId/instructors", async ({ academicService, params, body }) => {
    return academicService.editCourseInstructors(params.courseId, body);
  }, {
    params: "CourseByIdRequestParams",
    body: "EditCourseInstructorRequestBody",
    response: "EditCourseInstructorResponse",
  })
  .patch("/courses/:courseId/semesters", async ({ academicService, params, body }) => {
    return academicService.editCourseSemesters(params.courseId, body);
  }, {
    params: "CourseByIdRequestParams",
    body: "EditCourseSemesterRequestBody",
    response: "EditCourseSemesterResponse",
  })

  // Semesters
  .get("/semesters", async ({ academicService, query }) => {
    return academicService.getSemesters(query);
  }, {
    query: "GetSemestersRequestQuery",
    response: "GetSemestersResponse",
  })
  .get("/semesters/:semesterId", async ({ academicService, params }) => {
    return academicService.getSemesterById(params.semesterId);
  }, {
    params: "SemesterByIdRequestParams",
    response: "GetSemesterByIdResponse",
  })
  .post("/semesters", async ({ academicService, body }) => {
    return academicService.addSemester(body);
  }, {
    body: "AddSemesterRequestBody",
    response: "AddSemesterResponse",
  })
  .patch("/semesters/:semesterId", async ({ academicService, params, body }) => {
    return academicService.editSemesterById(params.semesterId, body);
  }, {
    params: "SemesterByIdRequestParams",
    body: "EditSemesterByIdRequestBody",
    response: "EditSemesterByIdResponse",
  })
  .patch("/semesters/:semesterId/courses", async ({ academicService, params, body }) => {
    return academicService.editSemesterCourses(params.semesterId, body);
  }, {
    params: "SemesterByIdRequestParams",
    body: "EditSemesterCourseRequestBody",
    response: "EditSemesterCourseResponse",
  })
  .delete("/semesters/:semesterId", async ({ academicService, params }) => {
    return academicService.deleteSemesterById(params.semesterId);
  }, {
    params: "SemesterByIdRequestParams",
    response: "DeleteSemesterByIdResponse",
  });
