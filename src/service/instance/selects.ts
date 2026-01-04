import type { Prisma } from '@momoi/database/prisma/generated/client';

/**
 * Shared select clause for course offering with nested course and semester
 */
export const COURSE_OFFERING_SELECT = {
    select: {
        course: {
            select: {
                code: true,
                title: true,
            }
        },
        semester: {
            select: {
                name: true,
            }
        }
    },
} as const;

/**
 * Shared select clause for PVE VM with network IP
 */
export const PVE_VM_SELECT = {
    select: {
        hostname: true,
        pveNetworkIP: {
            select: {
                ipAddress: true,
            }
        }
    }
} as const;

/**
 * Shared select clause for PVE template
 */
export const PVE_TEMPLATE_SELECT = {
    select: {
        name: true,
    }
} as const;

/**
 * Base select clause for instance list queries
 */
export const INSTANCE_LIST_SELECT = {
    id: true,
    courseOffering: COURSE_OFFERING_SELECT,
    status: true,
    pveVM: PVE_VM_SELECT,
    cpus: true,
    memoryMB: true,
    diskGB: true,
    pveTemplate: PVE_TEMPLATE_SELECT,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.InstanceSelect;

/**
 * Extended select clause for single instance detail (includes reverse proxies)
 */
export const INSTANCE_DETAIL_SELECT = {
    ...INSTANCE_LIST_SELECT,
    instanceReverseProxies: {
        select: {
            id: true,
            targetPort: true,
        }
    },
} satisfies Prisma.InstanceSelect;

/**
 * Select clause for instance creation response
 */
export const INSTANCE_CREATE_SELECT = {
    id: true,
    courseOffering: COURSE_OFFERING_SELECT,
    status: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.InstanceSelect;

/**
 * Type for instance list result from Prisma
 */
export type InstanceListResult = Prisma.InstanceGetPayload<{
    select: typeof INSTANCE_LIST_SELECT;
}>;

/**
 * Type for instance detail result from Prisma
 */
export type InstanceDetailResult = Prisma.InstanceGetPayload<{
    select: typeof INSTANCE_DETAIL_SELECT;
}>;

/**
 * Type for instance create result from Prisma
 */
export type InstanceCreateResult = Prisma.InstanceGetPayload<{
    select: typeof INSTANCE_CREATE_SELECT;
}>;
