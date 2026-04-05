import { Elysia, t } from "elysia";

import { PaginationRequest, PaginationResponse } from "./shared/pagination";
import { TimestampResponse } from "./shared/timestamp";

const INSTANCE_CREATE_CPU_MAX = 8;

export const InstanceStatus = t.Union(
	[
		t.Literal("PENDING", { description: "Instance is being set up" }),
		t.Literal("ACTIVE", { description: "Instance is active" }),
		t.Literal("PROMOTED", {
			description: "Instance has been promoted to long-term or production",
		}),
		t.Literal("INACTIVE", { description: "Instance is inactive" }),
		t.Literal("DELETED", { description: "Instance has been deleted" }),
	],
	{ description: "Status of the instance" },
);

export const InstanceProvisionStatus = t.Union(
	[
		t.Literal("NOT_STARTED", {
			description: "Provisioning has not started yet",
		}),
		t.Literal("QUEUED", { description: "Provisioning is queued" }),
		t.Literal("PROVISIONING", { description: "Provisioning is in progress" }),
		t.Literal("COMPLETED", { description: "Provisioning is completed" }),
		t.Literal("FAILED", { description: "Provisioning has failed" }),
	],
	{ description: "Provisioning status of the instance" },
);

export const courseOfferingDetails = t.Object(
	{
		courseCode: t.String({
			description: "Course code associated with the offering",
		}),
		courseTitle: t.String({ description: "Title of the course" }),
		semester: t.String({
			description: "Semester in which the course is offered",
		}),
	},
	{
		description: "Details of the course offering associated with the instance",
	},
);

export const VMStatus = t.Union(
	[
		t.Literal("RUNNING", { description: "VM is running" }),
		t.Literal("STOPPED", { description: "VM is stopped" }),
		t.Literal("SUSPENDED", { description: "VM is suspended" }),
	],
	{ description: "Status of the virtual machine" },
);

export const VMDetails = t.Object(
	{
		hostname: t.String({ description: "Hostname of the virtual machine" }),
		os: t.String({
			description: "Operating system installed on the virtual machine",
		}),
		ip: t.String({ description: "IP address of the virtual machine" }),
		cpus: t.Number({
			description: "Number of CPUs allocated to the virtual machine",
		}),
		memoryMB: t.Number({
			description: "Amount of memory (in MB) allocated to the virtual machine",
		}),
		diskGB: t.Number({
			description: "Disk size (in GB) of the virtual machine",
		}),
		vmStatus: VMStatus,
	},
	{
		description:
			"Details about the virtual machine hosting the instance if available",
	},
);

export const InstancesData = t.Object(
	{
		id: t.Number({ description: "Unique identifier for the instance" }),
		owner: t.Object(
			{
				id: t.Number({ description: "Platform user ID of the instance owner" }),
				name: t.String({ description: "Name of the instance owner" }),
				email: t.String({ description: "Email of the instance owner" }),
			},
			{ description: "Details of the instance owner" },
		),
		courseOffering: t.Optional(courseOfferingDetails),
		status: InstanceStatus,
		vmDetails: t.Optional(VMDetails),
		provisionStatus: InstanceProvisionStatus,
		semester: t.Optional(t.String({ description: "Semester of the instance" })),
		...TimestampResponse.properties,
	},
	{ description: "Data structure representing an instance" },
);

export const GetInstanceRequestParams = t.Object({
	instanceId: t.Number({ description: "Unique identifier for the instance" }),
});

export const GetInstancesRequestQuery = t.Object({
	...PaginationRequest.properties,
	courseId: t.Optional(
		t.Number({ description: "Filter instances by course ID" }),
	),
	semesterId: t.Optional(
		t.Number({ description: "Filter instances by semester ID" }),
	),
});

export const GetInstancesResponse = t.Object({
	values: t.Array(InstancesData, { description: "List of instances" }),
	...PaginationResponse.properties,
});

export const GetInstanceResponse = t.Object({
	...InstancesData.properties,
	defaultUser: t.String({ description: "Default username for instance login" }),
	defaultPassword: t.Optional(
		t.String({ description: "Default password generated during provisioning" }),
	),
	reverseProxy: t.Array(
		t.Object(
			{
				id: t.Number({
					description: "Unique identifier for the reverse proxy configuration",
				}),
				targetPort: t.Number({ description: "Target port on the instance" }),
			},
			{
				description:
					"Details about the reverse proxy configuration for the instance",
			},
		),
		{
			description:
				"List of reverse proxy configurations associated with the instance",
		},
	),
});

export const CreateInstanceRequestBody = t.Object({
	pveTemplateId: t.Number({
		description: "Unique identifier for the PVE template to be used",
	}),
	courseOfferingId: t.Optional(
		t.Number({
			description:
				"Unique identifier for the course offering associated with the instance",
		}),
	),
	cpus: t.Number({
		description: "Number of CPUs to allocate to the instance",
		maximum: INSTANCE_CREATE_CPU_MAX,
	}),
	memoryMB: t.Number({
		description: "Amount of memory (in MB) to allocate to the instance",
	}),
	diskGB: t.Number({
		description: "Disk size (in GB) to allocate to the instance",
	}),
});

export const CreateInstanceResponse = t.Object({
	id: t.Number({
		description: "Unique identifier for the newly created instance",
	}),
	courseOffering: t.Optional(courseOfferingDetails),
	status: InstanceStatus,
	provisionStatus: InstanceProvisionStatus,
	vmDetails: t.Optional(VMDetails),
	...TimestampResponse.properties,
});

export const DeleteInstanceRequestParams = t.Object({
	instanceId: t.Number({
		description: "Unique identifier for the instance to be deleted",
	}),
});

export const DeleteInstanceResponse = t.Object({
	success: t.Boolean({
		description: "Indicates whether the deletion was successful",
	}),
});

export const ReverseProxyType = t.Union(
	[
		t.Literal("HTTPS", { description: "HTTPS reverse proxy" }),
		t.Literal("HTTP", { description: "HTTP reverse proxy" }),
		t.Literal("TCP", { description: "TCP reverse proxy" }),
	],
	{ description: "Type of reverse proxy" },
);

export const ReverseProxyItem = t.Object(
	{
		id: t.Number({ description: "Unique identifier for the reverse proxy" }),
		targetPort: t.Number({ description: "Target port on the instance" }),
		type: ReverseProxyType,
		description: t.Optional(
			t.String({ description: "Description of the reverse proxy" }),
		),
		...TimestampResponse.properties,
	},
	{ description: "Reverse proxy configuration" },
);

export const CreateReverseProxyRequestBody = t.Object({
	targetPort: t.Number({
		description: "Target port on the instance",
		minimum: 1,
		maximum: 65535,
	}),
	type: ReverseProxyType,
	description: t.Optional(
		t.String({ description: "Description of the reverse proxy" }),
	),
});

export const CreateReverseProxyResponse = ReverseProxyItem;

export const GetReverseProxiesResponse = t.Array(ReverseProxyItem, {
	description: "List of reverse proxy configurations",
});

export const DeleteReverseProxyRequestParams = t.Object({
	instanceId: t.Number({ description: "Unique identifier for the instance" }),
	proxyId: t.Number({
		description: "Unique identifier for the reverse proxy to delete",
	}),
});

export const DeleteReverseProxyResponse = t.Object({
	success: t.Boolean({
		description: "Indicates whether the deletion was successful",
	}),
});

export const PromoteInstanceRequestParams = t.Object({
	instanceId: t.Number({
		description: "Unique identifier for the instance to promote",
	}),
});

export const PromoteInstanceResponse = t.Object({
	id: t.Number({ description: "Unique identifier for the promoted instance" }),
	status: InstanceStatus,
	message: t.String({ description: "Success message" }),
});

export const InstanceAuditLogItem = t.Object(
	{
		id: t.Number({ description: "Unique identifier for the audit log entry" }),
		action: t.String({ description: "Action performed on the instance" }),
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
	{ description: "Instance audit log entry" },
);

export const GetInstanceAuditLogsResponse = t.Object({
	values: t.Array(InstanceAuditLogItem, {
		description: "List of audit log entries",
	}),
	...PaginationResponse.properties,
});

export const ReprovisionInstanceRequestParams = t.Object({
	instanceId: t.Number({
		description: "Unique identifier for the instance to re-provision",
	}),
});

export const ReprovisionInstanceResponse = t.Object({
	id: t.Number({ description: "Unique identifier for the instance" }),
	provisionStatus: t.String({ description: "New provisioning status" }),
	message: t.String({ description: "Success message" }),
});

// Common params for routes that only need instanceId
export const InstanceIdParams = t.Object({
	instanceId: t.Number({ description: "Unique identifier for the instance" }),
});

// Query params for audit logs
export const AuditLogsQuery = t.Object({
	page: t.Optional(t.Number({ minimum: 1, default: 1 })),
	pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 10 })),
});

// Params for extended request with instanceId
export const InstanceExtendedRequestParams = t.Object({
	instanceId: t.Number({
		description: "Instance ID to get extended requests for",
	}),
});

export const instanceModel = new Elysia({ name: "instance.model" })
	.model("GetInstancesRequestQuery", GetInstancesRequestQuery)
	.model("GetInstancesResponse", GetInstancesResponse)
	.model("GetInstanceRequestParams", GetInstanceRequestParams)
	.model("GetInstanceResponse", GetInstanceResponse)
	.model("CreateInstanceRequestBody", CreateInstanceRequestBody)
	.model("CreateInstanceResponse", CreateInstanceResponse)
	.model("DeleteInstanceRequestParams", DeleteInstanceRequestParams)
	.model("DeleteInstanceResponse", DeleteInstanceResponse)
	.model("CreateReverseProxyRequestBody", CreateReverseProxyRequestBody)
	.model("CreateReverseProxyResponse", CreateReverseProxyResponse)
	.model("GetReverseProxiesResponse", GetReverseProxiesResponse)
	.model("DeleteReverseProxyRequestParams", DeleteReverseProxyRequestParams)
	.model("DeleteReverseProxyResponse", DeleteReverseProxyResponse)
	.model("PromoteInstanceRequestParams", PromoteInstanceRequestParams)
	.model("PromoteInstanceResponse", PromoteInstanceResponse)
	.model("GetInstanceAuditLogsResponse", GetInstanceAuditLogsResponse)
	.model("ReprovisionInstanceRequestParams", ReprovisionInstanceRequestParams)
	.model("ReprovisionInstanceResponse", ReprovisionInstanceResponse)
	.model("InstanceIdParams", InstanceIdParams)
	.model("AuditLogsQuery", AuditLogsQuery)
	.model("InstanceExtendedRequestParams", InstanceExtendedRequestParams);
