import { Elysia, t } from "elysia";

import { PaginationRequest, PaginationResponse } from "./shared/pagination";
import { TimestampResponse } from "./shared/timestamp";

export const InstanceStatus = t.Union([
  t.Literal("PENDING", { description: "Instance is being set up" }),
  t.Literal("ACTIVE", { description: "Instance is active" }),
  t.Literal("PROMOTED", { description: "Instance has been promoted to long-term or production" }),
  t.Literal("INACTIVE", { description: "Instance is inactive" }),
  t.Literal("DELETED", { description: "Instance has been deleted" })
], { description: "Status of the instance" });

export const courseOfferingDetails = t.Object({
  courseCode: t.String({ description: "Course code associated with the offering" }),
  courseTitle: t.String({ description: "Title of the course" }),
  semester: t.String({ description: "Semester in which the course is offered" }),
}, { description: "Details of the course offering associated with the instance" });

export const VMDetails = t.Object({
  hostname: t.String({ description: "Hostname of the virtual machine" }),
  os: t.String({ description: "Operating system installed on the virtual machine" }),
  ip: t.String({ description: "IP address of the virtual machine" }),
  cpus: t.Number({ description: "Number of CPUs allocated to the virtual machine" }),
  memoryMB: t.Number({ description: "Amount of memory (in MB) allocated to the virtual machine" }),
  diskGB: t.Number({ description: "Disk size (in GB) of the virtual machine" }),
}, { description: "Details about the virtual machine hosting the instance if available" });

export const InstancesData = t.Object({
  id: t.Number({ description: "Unique identifier for the instance" }),
  courseOffering: t.Optional(courseOfferingDetails),
  status: InstanceStatus,
  vmDetails: t.Optional(VMDetails),
  ...TimestampResponse.properties
}, { description: "Data structure representing an instance" });

export const GetInstanceRequestParams = t.Object({
  instanceId: t.Number({ description: "Unique identifier for the instance" }),
});

export const GetInstancesRequestQuery = t.Object({
  ...PaginationRequest.properties,
  courseId: t.Optional(
    t.Number({ description: "Filter instances by course ID" })
  ),
  semesterId: t.Optional(
    t.Number({ description: "Filter instances by semester ID" })
  ),
});

export const GetInstancesResponse = t.Object({
  values: t.Array(InstancesData, { description: "List of instances" }),
  ...PaginationResponse.properties
});

export const GetInstanceResponse = t.Object({
  ...InstancesData.properties,
  reverseProxy: t.Array(
    t.Object({
      id: t.Number({ description: "Unique identifier for the reverse proxy configuration" }),
      targetPort: t.Number({ description: "Target port on the instance" }),
    }, { description: "Details about the reverse proxy configuration for the instance" }),
    { description: "List of reverse proxy configurations associated with the instance" }
  )
});

export const CreateInstanceRequestBody = t.Object({
  pveTemplateId: t.Number({ description: "Unique identifier for the PVE template to be used" }),
  courseOfferingId: t.Optional(
    t.Number({ description: "Unique identifier for the course offering associated with the instance" })
  ),
  cpus: t.Number({ description: "Number of CPUs to allocate to the instance" }),
  memoryMB: t.Number({ description: "Amount of memory (in MB) to allocate to the instance" }),
  diskGB: t.Number({ description: "Disk size (in GB) to allocate to the instance" }),
});

export const CreateInstanceResponse = t.Object({
  id: t.Number({ description: "Unique identifier for the newly created instance" }),
  courseOffering: t.Optional(courseOfferingDetails),
  status: InstanceStatus,
  vmDetails: t.Optional(VMDetails),
  ...TimestampResponse.properties
});

export const DeleteInstanceRequestParams = t.Object({
  instanceId: t.Number({ description: "Unique identifier for the instance to be deleted" }),
});

export const DeleteInstanceResponse = t.Object({
  success: t.Boolean({ description: "Indicates whether the deletion was successful" }),
});

export const instanceModel = new Elysia({ name: "instance.model" })
  .model("GetInstancesRequestQuery", GetInstancesRequestQuery)
  .model("GetInstancesResponse", GetInstancesResponse)
  .model("GetInstanceRequestParams", GetInstanceRequestParams)
  .model("GetInstanceResponse", GetInstanceResponse)
  .model("CreateInstanceRequestBody", CreateInstanceRequestBody)
  .model("CreateInstanceResponse", CreateInstanceResponse)
  .model("DeleteInstanceRequestParams", DeleteInstanceRequestParams)
  .model("DeleteInstanceResponse", DeleteInstanceResponse);
