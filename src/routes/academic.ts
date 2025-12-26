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
    detail: {
      summary: "Get instructor mailing list",
      description: "Retrieve the list of instructor email addresses for mailing purposes",
    },
  })
  .post("/mailing-list", async ({ academicService, body }) => {
    return academicService.addInstructorMailingList(body);
  }, {
    body: "AddInstructorMailingListRequestBody",
    response: "AddInstructorMailingListResponse",
    detail: {
      summary: "Add instructor to mailing list",
      description: "Add a new instructor email address to the mailing list",
    },
  })
  .delete("/mailing-list/:mailingId", async ({ academicService, params }) => {
    return academicService.removeInstructorMailingList(params.mailingId);
  }, {
    params: "InstructorMailingListByIdRequestParams",
    response: "RemoveInstructorMailingListResponse",
    detail: {
      summary: "Remove instructor from mailing list",
      description: "Remove an instructor email address from the mailing list by ID",
    },
  })

  // Instructors
  .get("/instructors", async ({ academicService, query }) => {
    return academicService.getInstructors(query);
  }, {
    query: "GetInstructorsRequestQuery",
    response: "GetInstructorsResponse",
    detail: {
      summary: "Get all instructors",
      description: "Retrieve a paginated list of all instructors in the system",
    },
  })
  .get("/instructors/:instructorId", async ({ academicService, params }) => {
    return academicService.getInstructorById(Number(params.instructorId));
  }, {
    params: "InstructorByIdRequestParams",
    response: "GetInstructorByIdResponse",
    detail: {
      summary: "Get instructor by ID",
      description: "Retrieve detailed information about a specific instructor",
    },
  })
  .patch("/instructors/:instructorId", async ({ academicService, params, body }) => {
    return academicService.editInstructorById(Number(params.instructorId), body);
  }, {
    params: "InstructorByIdRequestParams",
    body: "EditInstructorByIdRequestBody",
    response: "EditInstructorByIdResponse",
    detail: {
      summary: "Update instructor",
      description: "Update the information of a specific instructor by ID",
    },
  })

  // Courses
  .get("/courses", async ({ academicService, query }) => {
    return academicService.getCourses(query);
  }, {
    query: "GetCoursesRequestQuery",
    response: "GetCoursesResponse",
    detail: {
      summary: "Get all courses",
      description: "Retrieve a paginated list of all courses in the system",
    },
  })
  .get("/courses/:courseId", async ({ academicService, params }) => {
    return academicService.getCourseById(params.courseId);
  }, {
    params: "CourseByIdRequestParams",
    response: "GetCourseByIdResponse",
    detail: {
      summary: "Get course by ID",
      description: "Retrieve detailed information about a specific course",
    },
  })
  .post("/courses", async ({ academicService, body }) => {
    return academicService.addCourse(body);
  }, {
    body: "AddCourseRequestBody",
    response: "AddCourseResponse",
    detail: {
      summary: "Create a new course",
      description: "Add a new course to the system",
    },
  })
  .patch("/courses/:courseId", async ({ academicService, params, body }) => {
    return academicService.editCourseById(params.courseId, body);
  }, {
    params: "CourseByIdRequestParams",
    body: "EditCourseByIdRequestBody",
    response: "AddCourseResponse",
    detail: {
      summary: "Update course",
      description: "Update the information of a specific course by ID",
    },
  })
  .patch("/courses/:courseId/instructors", async ({ academicService, params, body }) => {
    return academicService.editCourseInstructors(params.courseId, body);
  }, {
    params: "CourseByIdRequestParams",
    body: "EditCourseInstructorRequestBody",
    response: "EditCourseInstructorResponse",
    detail: {
      summary: "Update course instructors",
      description: "Assign or update instructors for a specific course",
    },
  })
  .patch("/courses/:courseId/semesters", async ({ academicService, params, body }) => {
    return academicService.editCourseSemesters(params.courseId, body);
  }, {
    params: "CourseByIdRequestParams",
    body: "EditCourseSemesterRequestBody",
    response: "EditCourseSemesterResponse",
    detail: {
      summary: "Update course semesters",
      description: "Assign or update semesters for a specific course",
    },
  })

  // Semesters
  .get("/semesters", async ({ academicService, query }) => {
    return academicService.getSemesters(query);
  }, {
    query: "GetSemestersRequestQuery",
    response: "GetSemestersResponse",
    detail: {
      summary: "Get all semesters",
      description: "Retrieve a paginated list of all semesters in the system",
    },
  })
  .get("/semesters/:semesterId", async ({ academicService, params }) => {
    return academicService.getSemesterById(params.semesterId);
  }, {
    params: "SemesterByIdRequestParams",
    response: "GetSemesterByIdResponse",
    detail: {
      summary: "Get semester by ID",
      description: "Retrieve detailed information about a specific semester",
    },
  })
  .post("/semesters", async ({ academicService, body }) => {
    return academicService.addSemester(body);
  }, {
    body: "AddSemesterRequestBody",
    response: "AddSemesterResponse",
    detail: {
      summary: "Create a new semester",
      description: "Add a new semester to the system",
    },
  })
  .patch("/semesters/:semesterId", async ({ academicService, params, body }) => {
    return academicService.editSemesterById(params.semesterId, body);
  }, {
    params: "SemesterByIdRequestParams",
    body: "EditSemesterByIdRequestBody",
    response: "EditSemesterByIdResponse",
    detail: {
      summary: "Update semester",
      description: "Update the information of a specific semester by ID",
    },
  })
  .patch("/semesters/:semesterId/courses", async ({ academicService, params, body }) => {
    return academicService.editSemesterCourses(params.semesterId, body);
  }, {
    params: "SemesterByIdRequestParams",
    body: "EditSemesterCourseRequestBody",
    response: "EditSemesterCourseResponse",
    detail: {
      summary: "Update semester courses",
      description: "Assign or update courses for a specific semester",
    },
  })
  .delete("/semesters/:semesterId", async ({ academicService, params }) => {
    return academicService.deleteSemesterById(params.semesterId);
  }, {
    params: "SemesterByIdRequestParams",
    response: "DeleteSemesterByIdResponse",
    detail: {
      summary: "Delete semester",
      description: "Delete a specific semester from the system by ID",
    },
  });
