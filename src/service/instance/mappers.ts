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
    pveVM: { hostname: string; status: string; pveNetworkIP: { ipAddress: string } | null } | null,
    pveTemplate: { name: string } | null,
    cpus: number,
    memoryMB: number,
    diskGB: number
): { hostname: string; os: string; ip: string; cpus: number; memoryMB: number; diskGB: number; vmStatus: "RUNNING" | "STOPPED" | "SUSPENDED" } | undefined {
    if (!pveVM) return undefined;
    return {
        hostname: pveVM.hostname,
        os: pveTemplate?.name ?? 'Unknown',
        ip: pveVM.pveNetworkIP?.ipAddress ?? 'N/A',
        cpus,
        memoryMB,
        diskGB,
        vmStatus: pveVM.status as "RUNNING" | "STOPPED" | "SUSPENDED",
    };
}

/**
 * Maps owner details to API response format
 */
function mapOwner(
    platformUserId: number,
    platformUser?: { id: number; user: { name: string; email: string } } | null
): { id: number; name: string; email: string } {
    return {
        id: platformUser?.id ?? platformUserId,
        name: platformUser?.user?.name ?? 'Unknown Owner',
        email: platformUser?.user?.email ?? 'unknown-owner@momoi.local',
    };
}

/**
 * Maps a single instance from Prisma result to list item response format
 */
export function mapInstanceToListItem(instance: InstanceListResult): Static<typeof GetInstancesResponse>['values'][number] {
    return {
        id: instance.id,
        owner: mapOwner(instance.platformUserId, instance.platformUser),
        courseOffering: mapCourseOffering(instance.courseOffering),
        status: instance.status,
        vmDetails: mapVmDetails(
            instance.pveVM,
            instance.pveTemplate,
            instance.cpus,
            instance.memoryMB,
            instance.diskGB,
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
        owner: mapOwner(instance.platformUserId, instance.platformUser),
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
        defaultUser: 'user',
        defaultPassword: instance.defaultPassword ?? undefined,
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
