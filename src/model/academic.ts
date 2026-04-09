import { Elysia, t } from "elysia";

import { PaginationRequest, PaginationResponse } from "./shared/pagination";
import { TimestampResponse } from "./shared/timestamp";
import { UserRole } from "./user";

export const InstructorMailingListValue = t.Object(
	{
		id: t.Number({
			description: "Unique identifier for the mailing list value",
		}),
		email: t.String({
			format: "email",
			description: "Email address of the instructor",
		}),
		...TimestampResponse.properties,
	},
	{ description: "Represents an entry in the instructor mailing list" },
);

export const InstructorValue = t.Object(
	{
		id: t.Number({
			description: "Unique identifier for the instructor listing",
		}),
		name: t.String({ description: "Full name of the instructor" }),
		email: t.String({
			format: "email",
			description: "Email address of the instructor",
		}),
		role: UserRole,
		...TimestampResponse.properties,
	},
	{ description: "Represents an entry in the instructor listing" },
);

export const CourseValue = t.Object(
	{
		id: t.Number({ description: "Unique identifier for the course" }),
		code: t.String({ description: "Course code" }),
		title: t.String({ description: "Title of the course" }),
		description: t.Optional(
			t.String({ description: "Description of the course" }),
		),
		isActive: t.Boolean({
			description: "Indicates if the course is currently active",
		}),
		isProjectBased: t.Boolean({
			description: "Indicates if the course is project based",
		}),
		...TimestampResponse.properties,
	},
	{ description: "Represents a course offered in the academic system" },
);

export const SemesterValue = t.Object(
	{
		id: t.Number({ description: "Unique identifier for the semester" }),
		name: t.String({ description: "Name of the semester" }),
		startDate: t.Date({ description: "Start date of the semester" }),
		endDate: t.Date({ description: "End date of the semester" }),
		isCurrent: t.Boolean({
			description: "Indicates if this semester is the current active semester",
		}),
		...TimestampResponse.properties,
	},
	{ description: "Represents a semester in the academic system" },
);

export const GetInstructorMailingListQuery = t.Object(
	{
		email: t.Optional(
			t.String({ description: "Filter by email address with partial match" }),
		),
		...PaginationRequest.properties,
	},
	{ description: "Query parameters for fetching instructor mailing list" },
);

export const GetInstructorMailingListResponse = t.Object(
	{
		values: t.Array(InstructorMailingListValue, {
			description: "List of instructor mailing list entries",
		}),
		...PaginationResponse.properties,
	},
	{ description: "Response structure for instructor mailing list" },
);

export const InstructorMailingListByIdRequestParams = t.Object(
	{
		mailingId: t.Number({
			description: "Unique identifier for the mailing list entry",
		}),
	},
	{
		description:
			"Request parameters for fetching instructor mailing list by ID",
	},
);

export const AddInstructorMailingListRequestBody = t.Object(
	{
		email: t.String({
			format: "email",
			description: "Email address of the instructor",
		}),
	},
	{ description: "Request body for adding an instructor to the mailing list" },
);

export const AddInstructorMailingListResponse = t.Object(
	{
		id: t.Number({
			description: "Unique identifier for the mailing list value",
		}),
		email: t.String({
			format: "email",
			description: "Email address of the instructor",
		}),
		...TimestampResponse.properties,
	},
	{
		description:
			"Response structure after adding an instructor to the mailing list",
	},
);

export const RemoveInstructorMailingListResponse = t.Object(
	{
		success: t.Boolean({
			description: "Indicates if the removal was successful",
		}),
	},
	{
		description:
			"Response structure after removing an instructor from the mailing list",
	},
);

export const GetInstructorsRequestQuery = t.Object(
	{
		name: t.Optional(
			t.String({ description: "Filter by instructor name with partial match" }),
		),
		email: t.Optional(
			t.String({ description: "Filter by email address with partial match" }),
		),
		...PaginationRequest.properties,
	},
	{ description: "Query parameters for fetching instructor listing" },
);

export const GetInstructorsResponse = t.Object(
	{
		values: t.Array(InstructorValue, { description: "List of instructors" }),
		...PaginationResponse.properties,
	},
	{ description: "Response structure for instructor listing" },
);

export const InstructorByIdRequestParams = t.Object(
	{
		instructorId: t.Number({
			description: "Unique identifier for the instructor",
		}),
	},
	{ description: "Request parameters for fetching instructor by ID" },
);

export const GetInstructorByIdResponse = t.Object(
	{
		...InstructorValue.properties,
		courses: t.Array(CourseValue, {
			description: "List of courses taught by the instructor",
		}),
		...TimestampResponse.properties,
	},
	{ description: "Response structure for fetching instructor by ID" },
);

export const EditInstructorByIdRequestBody = t.Object(
	{
		role: t.Optional(t.Union([t.Literal("ADMIN"), t.Literal("INSTRUCTOR")])),
		courseIds: t.Optional(
			t.Array(t.Number({ description: "Unique identifier for the course" }), {
				description: "List of course IDs to be associated with the instructor",
			}),
		),
	},
	{ description: "Request body for editing instructor details" },
);

export const EditInstructorByIdResponse = t.Object(
	{
		...InstructorValue.properties,
		courses: t.Array(CourseValue, {
			description: "List of courses taught by the instructor",
		}),
	},
	{ description: "Response structure after editing instructor details" },
);

export const DeleteInstructorByIdResponse = t.Object(
	{
		success: t.Boolean({
			description: "Indicates if the deletion was successful",
		}),
	},
	{ description: "Response structure after deleting an instructor by ID" },
);

export const GetCoursesRequestQuery = t.Object(
	{
		code: t.Optional(
			t.String({ description: "Filter by course code with partial match" }),
		),
		title: t.Optional(
			t.String({ description: "Filter by course title with partial match" }),
		),
		...PaginationRequest.properties,
	},
	{ description: "Query parameters for fetching course listing" },
);

export const GetCoursesResponse = t.Object(
	{
		values: t.Array(CourseValue, { description: "List of courses" }),
		...PaginationResponse.properties,
	},
	{ description: "Response structure for course listing" },
);

export const CourseByIdRequestParams = t.Object(
	{
		courseId: t.Number({ description: "Unique identifier for the course" }),
	},
	{ description: "Request parameters for fetching course by ID" },
);

export const GetCourseByIdResponse = t.Object(
	{
		id: t.Number({ description: "Unique identifier for the course" }),
		code: t.String({ description: "Course code" }),
		title: t.String({ description: "Title of the course" }),
		description: t.Optional(
			t.String({ description: "Description of the course" }),
		),
		isActive: t.Boolean({
			description: "Indicates if the course is currently active",
		}),
		isProjectBased: t.Boolean({
			description: "Indicates if the course is project based",
		}),
		instructors: t.Array(InstructorValue, {
			description: "List of instructors teaching the course",
		}),
		semesters: t.Array(SemesterValue, {
			description: "List of semesters when the course is offered",
		}),
		...TimestampResponse.properties,
	},
	{ description: "Response structure for fetching course by ID" },
);

export const AddCourseRequestBody = t.Object(
	{
		code: t.String({ description: "Course code" }),
		title: t.String({ description: "Title of the course" }),
		description: t.Optional(
			t.String({ description: "Description of the course" }),
		),
		isProjectBased: t.Optional(
			t.Boolean({ description: "Indicates if the course is project based" }),
		),
	},
	{ description: "Request body for adding a new course" },
);

export const AddCourseResponse = t.Object(CourseValue.properties, {
	description: "Response structure after adding a new course",
});

export const EditCourseByIdRequestBody = t.Object(
	{
		code: t.Optional(t.String({ description: "Course code" })),
		title: t.Optional(t.String({ description: "Title of the course" })),
		description: t.Optional(
			t.String({ description: "Description of the course" }),
		),
		isActive: t.Optional(
			t.Boolean({ description: "Indicates if the course is currently active" }),
		),
		isProjectBased: t.Optional(
			t.Boolean({ description: "Indicates if the course is project based" }),
		),
	},
	{ description: "Request body for editing course details" },
);

export const EditCourseInstructorRequestBody = t.Object(
	{
		instructorIds: t.Array(
			t.Number({ description: "Unique identifier for the instructor" }),
			{
				description: "List of instructor IDs to be associated with the course",
			},
		),
	},
	{ description: "Request body for associating an instructor with a course" },
);

export const EditCourseInstructorResponse = t.Object(
	{
		instructors: t.Array(InstructorValue, {
			description: "List of instructors associated with the course",
		}),
	},
	{
		description:
			"Response structure after associating an instructor with a course",
	},
);

export const EditCourseSemesterRequestBody = t.Object(
	{
		semesterIds: t.Array(
			t.Number({ description: "Unique identifier for the semester" }),
			{ description: "List of semester IDs to be associated with the course" },
		),
	},
	{ description: "Request body for associating a semester with a course" },
);

export const EditCourseSemesterResponse = t.Object(
	{
		semesters: t.Array(SemesterValue, {
			description: "List of semesters associated with the course",
		}),
	},
	{
		description:
			"Response structure after associating a semester with a course",
	},
);

export const GetSemestersRequestQuery = t.Object(
	{
		name: t.Optional(
			t.String({ description: "Filter by semester name with partial match" }),
		),
		dateFrom: t.Optional(
			t.Date({ description: "Filter semesters starting from this date" }),
		),
		dateTo: t.Optional(
			t.Date({ description: "Filter semesters ending by this date" }),
		),
		...PaginationRequest.properties,
	},
	{ description: "Query parameters for fetching semester listing" },
);

export const GetSemestersResponse = t.Object(
	{
		values: t.Array(SemesterValue, { description: "List of semesters" }),
		...PaginationResponse.properties,
	},
	{ description: "Response structure for semester listing" },
);

export const SemesterByIdRequestParams = t.Object(
	{
		semesterId: t.Number({ description: "Unique identifier for the semester" }),
	},
	{ description: "Request parameters for fetching semester by ID" },
);

export const GetSemesterByIdResponse = t.Object(
	{
		...SemesterValue.properties,
		courses: t.Array(CourseValue, {
			description: "List of courses offered in the semester",
		}),
	},
	{ description: "Response structure for fetching semester by ID" },
);

export const GetCurrentSemesterResponse = t.Union([SemesterValue, t.Null()], {
	description:
		"Response structure for fetching the current active semester, returns null if no current semester exists",
});

export const GetNextSemesterResponse = t.Union([SemesterValue, t.Null()], {
	description:
		"Response structure for fetching the next upcoming semester, returns null if no upcoming semester exists",
});

export const AddSemesterRequestBody = t.Object(
	{
		name: t.String({ description: "Name of the semester" }),
		startDate: t.Date({ description: "Start date of the semester" }),
		endDate: t.Date({ description: "End date of the semester" }),
	},
	{ description: "Request body for adding a new semester" },
);

export const AddSemesterResponse = t.Object(SemesterValue.properties, {
	description: "Response structure after adding a new semester",
});

export const EditSemesterByIdRequestBody = t.Object(
	{
		name: t.Optional(t.String({ description: "Name of the semester" })),
		startDate: t.Optional(
			t.Date({ description: "Start date of the semester" }),
		),
		endDate: t.Optional(t.Date({ description: "End date of the semester" })),
		isCurrent: t.Optional(
			t.Boolean({
				description:
					"Indicates if this semester is the current active semester",
			}),
		),
	},
	{ description: "Request body for editing semester details" },
);

export const EditSemesterByIdResponse = t.Object(SemesterValue.properties, {
	description: "Response structure after editing semester details",
});

export const EditSemesterCourseRequestBody = t.Object(
	{
		courseIds: t.Array(
			t.Number({ description: "Unique identifier for the course" }),
			{ description: "List of course IDs to be associated with the semester" },
		),
	},
	{ description: "Request body for associating a course with a semester" },
);

export const EditSemesterCourseResponse = t.Object(
	{
		courses: t.Array(CourseValue, {
			description: "List of courses associated with the semester",
		}),
	},
	{
		description:
			"Response structure after associating a course with a semester",
	},
);

export const DeleteSemesterByIdResponse = t.Object(
	{
		success: t.Boolean({
			description: "Indicates if the deletion was successful",
		}),
	},
	{ description: "Response structure after deleting a semester by ID" },
);

export const academicModel = new Elysia({ name: "academic.model" })
	.model("InstructorMailingListValue", InstructorMailingListValue)
	.model("InstructorValue", InstructorValue)
	.model("CourseValue", CourseValue)
	.model("SemesterValue", SemesterValue)
	.model("GetInstructorMailingListQuery", GetInstructorMailingListQuery)
	.model("GetInstructorMailingListResponse", GetInstructorMailingListResponse)
	.model(
		"InstructorMailingListByIdRequestParams",
		InstructorMailingListByIdRequestParams,
	)
	.model(
		"AddInstructorMailingListRequestBody",
		AddInstructorMailingListRequestBody,
	)
	.model("AddInstructorMailingListResponse", AddInstructorMailingListResponse)
	.model(
		"RemoveInstructorMailingListResponse",
		RemoveInstructorMailingListResponse,
	)
	.model("GetInstructorsRequestQuery", GetInstructorsRequestQuery)
	.model("GetInstructorsResponse", GetInstructorsResponse)
	.model("InstructorByIdRequestParams", InstructorByIdRequestParams)
	.model("GetInstructorByIdResponse", GetInstructorByIdResponse)
	.model("EditInstructorByIdRequestBody", EditInstructorByIdRequestBody)
	.model("EditInstructorByIdResponse", EditInstructorByIdResponse)
	.model("DeleteInstructorByIdResponse", DeleteInstructorByIdResponse)
	.model("GetCoursesRequestQuery", GetCoursesRequestQuery)
	.model("GetCoursesResponse", GetCoursesResponse)
	.model("CourseByIdRequestParams", CourseByIdRequestParams)
	.model("GetCourseByIdResponse", GetCourseByIdResponse)
	.model("AddCourseRequestBody", AddCourseRequestBody)
	.model("AddCourseResponse", AddCourseResponse)
	.model("EditCourseByIdRequestBody", EditCourseByIdRequestBody)
	.model("EditCourseInstructorRequestBody", EditCourseInstructorRequestBody)
	.model("EditCourseInstructorResponse", EditCourseInstructorResponse)
	.model("EditCourseSemesterRequestBody", EditCourseSemesterRequestBody)
	.model("EditCourseSemesterResponse", EditCourseSemesterResponse)
	.model("GetSemestersRequestQuery", GetSemestersRequestQuery)
	.model("GetSemestersResponse", GetSemestersResponse)
	.model("SemesterByIdRequestParams", SemesterByIdRequestParams)
	.model("GetSemesterByIdResponse", GetSemesterByIdResponse)
	.model("GetCurrentSemesterResponse", GetCurrentSemesterResponse)
	.model("GetNextSemesterResponse", GetNextSemesterResponse)
	.model("AddSemesterRequestBody", AddSemesterRequestBody)
	.model("AddSemesterResponse", AddSemesterResponse)
	.model("EditSemesterByIdRequestBody", EditSemesterByIdRequestBody)
	.model("EditSemesterByIdResponse", EditSemesterByIdResponse)
	.model("EditSemesterCourseRequestBody", EditSemesterCourseRequestBody)
	.model("EditSemesterCourseResponse", EditSemesterCourseResponse)
	.model("DeleteSemesterByIdResponse", DeleteSemesterByIdResponse);
