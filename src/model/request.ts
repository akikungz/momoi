import { Elysia, t } from "elysia";

import { PaginationRequest, PaginationResponse } from "./shared/pagination";
import { TimestampResponse } from "./shared/timestamp";

const STUDENT_REQUEST_CPU_MAX = 4;
const STUDENT_REQUEST_MEMORY_MB_MAX = 2048;
const STUDENT_REQUEST_DISK_GB_MAX = 8;

export const ApprovalStatus = t.Union(
	[
		t.Literal("PENDING", { description: "Waiting for review" }),
		t.Literal("APPROVED", { description: "Approved by reviewer" }),
		t.Literal("REJECTED", { description: "Rejected by reviewer" }),
		t.Literal("CANCELLED", { description: "Cancelled by requester" }),
	],
	{ description: "Approval status" },
);

export const ApprovalActionStatus = t.Union(
	[t.Literal("APPROVED"), t.Literal("REJECTED"), t.Literal("CANCELLED")],
	{ description: "Statuses allowed when acting on a request" },
);

export const CourseOfferingSummary = t.Object(
	{
		courseCode: t.String({ description: "Course code" }),
		courseTitle: t.String({ description: "Course title" }),
		semester: t.String({ description: "Semester name" }),
	},
	{ description: "Summary of a course offering" },
);

export const SemesterSummary = t.Object(
	{
		id: t.Number({ description: "Semester ID" }),
		name: t.String({ description: "Semester name" }),
		startDate: t.Date({ description: "Semester start date" }),
		endDate: t.Date({ description: "Semester end date" }),
	},
	{ description: "Summary of a semester" },
);

export const RequestSpecs = t.Object({
	cpus: t.Number({
		description: "Number of CPUs requested",
		maximum: STUDENT_REQUEST_CPU_MAX,
	}),
	memoryMB: t.Number({
		description: "Memory requested in MB",
		maximum: STUDENT_REQUEST_MEMORY_MB_MAX,
	}),
	diskGB: t.Number({
		description: "Disk size requested in GB",
		maximum: STUDENT_REQUEST_DISK_GB_MAX,
	}),
});

export const RequestItem = t.Object(
	{
		id: t.Number({ description: "Request ID" }),
		title: t.String({ description: "Request title" }),
		description: t.Optional(t.String({ description: "Request description" })),
		status: ApprovalStatus,
		reason: t.Optional(t.String({ description: "Reviewer or requester note" })),
		courseOffering: t.Optional(CourseOfferingSummary),
		specs: RequestSpecs,
		templateName: t.Optional(t.String({ description: "Chosen template name" })),
		requesterId: t.Number({ description: "Requester platform user ID" }),
		reviewerId: t.Optional(
			t.Number({ description: "Reviewer platform user ID" }),
		),
		...TimestampResponse.properties,
	},
	{ description: "Request data" },
);

export const GetRequestsRequestQuery = t.Object({
	...PaginationRequest.properties,
	status: t.Optional(ApprovalStatus),
	courseId: t.Optional(t.Number({ description: "Filter by course ID" })),
	semesterId: t.Optional(t.Number({ description: "Filter by semester ID" })),
});

export const GetRequestsResponse = t.Object({
	values: t.Array(RequestItem),
	...PaginationResponse.properties,
});

export const CreateRequestRequestBody = t.Object({
	title: t.String({ description: "Request title" }),
	description: t.Optional(t.String({ description: "Request description" })),
	courseOfferingId: t.Number({ description: "Course offering ID" }),
	pveTemplateId: t.Number({ description: "Template ID" }),
	...RequestSpecs.properties,
});

export const CreateRequestResponse = RequestItem;

export const UpdateRequestStatusRequestBody = t.Object({
	status: ApprovalActionStatus,
	reason: t.Optional(t.String({ description: "Reason for the action" })),
});

export const UpdateRequestStatusResponse = RequestItem;

// Extended Request
export const ExtendedRequestItem = t.Object(
	{
		id: t.Number({ description: "Extended request ID" }),
		title: t.String({ description: "Extended request title" }),
		description: t.Optional(
			t.String({ description: "Extended request description" }),
		),
		status: ApprovalStatus,
		reason: t.Optional(t.String({ description: "Reviewer or requester note" })),
		targetInstanceId: t.Number({ description: "Target instance ID" }),
		courseOffering: t.Optional(CourseOfferingSummary),
		nextSemester: t.Optional(SemesterSummary),
		requesterId: t.Number({ description: "Requester platform user ID" }),
		reviewerId: t.Optional(
			t.Number({ description: "Reviewer platform user ID" }),
		),
		...TimestampResponse.properties,
	},
	{ description: "Extended request data" },
);

export const GetExtendedRequestsRequestQuery = t.Object({
	...PaginationRequest.properties,
	status: t.Optional(ApprovalStatus),
	courseId: t.Optional(t.Number({ description: "Filter by course ID" })),
	semesterId: t.Optional(t.Number({ description: "Filter by semester ID" })),
	instanceId: t.Optional(t.Number({ description: "Filter by instance ID" })),
});

export const GetExtendedRequestsResponse = t.Object({
	values: t.Array(ExtendedRequestItem),
	...PaginationResponse.properties,
});

export const CreateExtendedRequestRequestBody = t.Object({
	title: t.String({ description: "Extended request title" }),
	description: t.Optional(
		t.String({ description: "Extended request description" }),
	),
	targetInstanceId: t.Number({ description: "Instance to be extended" }),
});

// Body for creating extended request via /instances/:instanceId/extended-request
export const CreateInstanceExtendedRequestBody = t.Object({
	title: t.String({ description: "Extended request title" }),
	description: t.Optional(
		t.String({ description: "Extended request description" }),
	),
});

export const CreateExtendedRequestResponse = ExtendedRequestItem;

export const UpdateExtendedRequestStatusRequestBody =
	UpdateRequestStatusRequestBody;
export const UpdateExtendedRequestStatusResponse = ExtendedRequestItem;

export const RequestAuditLogItem = t.Object(
	{
		id: t.Number({ description: "Audit log entry ID" }),
		action: ApprovalStatus,
		performedBy: t.Object({
			id: t.Number({ description: "Platform user ID" }),
			name: t.String({ description: "User name" }),
			email: t.String({ description: "User email" }),
		}),
		timestamp: t.Date({ description: "When the action was performed" }),
		notes: t.Optional(
			t.String({ description: "Additional notes about the action" }),
		),
	},
	{ description: "Request audit log entry" },
);

export const ExtendedRequestAuditLogItem = t.Object(
	{
		id: t.Number({ description: "Audit log entry ID" }),
		action: ApprovalStatus,
		performedBy: t.Object({
			id: t.Number({ description: "Platform user ID" }),
			name: t.String({ description: "User name" }),
			email: t.String({ description: "User email" }),
		}),
		timestamp: t.Date({ description: "When the action was performed" }),
		notes: t.Optional(
			t.String({ description: "Additional notes about the action" }),
		),
	},
	{ description: "Extended request audit log entry" },
);

export const GetRequestAuditLogsResponse = t.Object({
	values: t.Array(RequestAuditLogItem, {
		description: "List of request audit log entries",
	}),
	...PaginationResponse.properties,
});

export const GetExtendedRequestAuditLogsResponse = t.Object({
	values: t.Array(ExtendedRequestAuditLogItem, {
		description: "List of extended request audit log entries",
	}),
	...PaginationResponse.properties,
});

export const requestModel = new Elysia({ name: "request.model" })
	.model("ApprovalStatus", ApprovalStatus)
	.model("RequestItem", RequestItem)
	.model("ExtendedRequestItem", ExtendedRequestItem)
	.model("CreateRequestRequestBody", CreateRequestRequestBody)
	.model("CreateRequestResponse", CreateRequestResponse)
	.model("GetRequestsRequestQuery", GetRequestsRequestQuery)
	.model("GetRequestsResponse", GetRequestsResponse)
	.model("UpdateRequestStatusRequestBody", UpdateRequestStatusRequestBody)
	.model("UpdateRequestStatusResponse", UpdateRequestStatusResponse)
	.model("CreateExtendedRequestRequestBody", CreateExtendedRequestRequestBody)
	.model("CreateInstanceExtendedRequestBody", CreateInstanceExtendedRequestBody)
	.model("CreateExtendedRequestResponse", CreateExtendedRequestResponse)
	.model("GetExtendedRequestsRequestQuery", GetExtendedRequestsRequestQuery)
	.model("GetExtendedRequestsResponse", GetExtendedRequestsResponse)
	.model(
		"UpdateExtendedRequestStatusRequestBody",
		UpdateExtendedRequestStatusRequestBody,
	)
	.model(
		"UpdateExtendedRequestStatusResponse",
		UpdateExtendedRequestStatusResponse,
	)
	.model("GetRequestAuditLogsResponse", GetRequestAuditLogsResponse)
	.model(
		"GetExtendedRequestAuditLogsResponse",
		GetExtendedRequestAuditLogsResponse,
	);
