import { Static } from "elysia";

import {
    GetInstanceResponse, GetInstancesResponse, CreateInstanceResponse
} from "@momoi/model/instance";

import type { InstanceListResult, InstanceDetailResult, InstanceCreateResult } from "./selects";

/**
 * Maps course offering data to API response format
 */
function mapCourseOffering(courseOffering: {
    course: { code: string; title: string };
    semester: { name: string };
} | null): { courseCode: string; courseTitle: string; semester: string } | undefined {
    if (!courseOffering) return undefined;
    return {
        courseCode: courseOffering.course.code,
        courseTitle: courseOffering.course.title,
        semester: courseOffering.semester.name,
    };
}

/**
 * Maps VM details to API response format
 */
function mapVmDetails(
    pveVM: { hostname: string; pveNetworkIP: { ipAddress: string } | null } | null,
    pveTemplate: { name: string } | null,
    cpus: number,
    memoryMB: number,
    diskGB: number
): { hostname: string; os: string; ip: string; cpus: number; memoryMB: number; diskGB: number } | undefined {
    if (!pveVM) return undefined;
    return {
        hostname: pveVM.hostname,
        os: pveTemplate?.name ?? 'Unknown',
        ip: pveVM.pveNetworkIP?.ipAddress ?? 'N/A',
        cpus,
        memoryMB,
        diskGB,
    };
}

/**
 * Maps a single instance from Prisma result to list item response format
 */
export function mapInstanceToListItem(instance: InstanceListResult): Static<typeof GetInstancesResponse>['values'][number] {
    return {
        id: instance.id,
        courseOffering: mapCourseOffering(instance.courseOffering),
        status: instance.status,
        vmDetails: mapVmDetails(
            instance.pveVM,
            instance.pveTemplate,
            instance.cpus,
            instance.memoryMB,
            instance.diskGB
        ),
        provisionStatus: instance.provisionStatus,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
    };
}

/**
 * Maps a list of instances to response format with pagination
 */
export function mapInstancesToResponse(
    instances: InstanceListResult[],
    totalItems: number,
    page: number,
    pageSize: number
): Static<typeof GetInstancesResponse> {
    return {
        values: instances.map(mapInstanceToListItem),
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        pageSize,
    };
}

/**
 * Maps a single instance from Prisma result to detail response format
 */
export function mapInstanceToDetail(instance: InstanceDetailResult): Static<typeof GetInstanceResponse> {
    return {
        id: instance.id,
        courseOffering: mapCourseOffering(instance.courseOffering),
        status: instance.status,
        vmDetails: mapVmDetails(
            instance.pveVM,
            instance.pveTemplate,
            instance.cpus,
            instance.memoryMB,
            instance.diskGB
        ),
        provisionStatus: instance.provisionStatus,
        reverseProxy: instance.instanceReverseProxies.map(proxy => ({
            id: proxy.id,
            targetPort: proxy.targetPort,
        })),
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
    };
}

/**
 * Maps instance creation result to response format
 */
export function mapInstanceCreateToResponse(instance: InstanceCreateResult): Static<typeof CreateInstanceResponse> {
    return {
        id: instance.id,
        courseOffering: mapCourseOffering(instance.courseOffering),
        status: instance.status,
        provisionStatus: instance.provisionStatus,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
    };
}
