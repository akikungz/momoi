-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('ADMIN', 'INSTRUCTOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "PVEVMStatus" AS ENUM ('RUNNING', 'STOPPED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PVEVMType" AS ENUM ('QEMU', 'LXC');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('PENDING', 'ACTIVE', 'PROMOTED', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "InstanceProvisionStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'PROVISIONING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReverseProxyType" AS ENUM ('HTTPS', 'HTTP');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlatformFileType" AS ENUM ('FILE', 'FOLDER');

-- CreateEnum
CREATE TYPE "PlatformFileViewerRole" AS ENUM ('VIEWER', 'EDITOR', 'OWNER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_search" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "havePlatformId" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_offering" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "semesterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pve_node" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pve_node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pve_network" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "subnet" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pve_network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pve_network_ip" (
    "id" SERIAL NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "isAllocated" BOOLEAN NOT NULL DEFAULT false,
    "pveNetworkId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pve_network_ip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pve_template" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vmId" INTEGER NOT NULL,
    "type" "PVEVMType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pve_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pve_vm" (
    "id" SERIAL NOT NULL,
    "vmId" INTEGER NOT NULL,
    "hostname" TEXT NOT NULL,
    "status" "PVEVMStatus" NOT NULL DEFAULT 'STOPPED',
    "type" "PVEVMType" NOT NULL DEFAULT 'QEMU',
    "pveNodeId" INTEGER NOT NULL,
    "pveNetworkIPId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pve_vm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance" (
    "id" SERIAL NOT NULL,
    "platformUserId" INTEGER NOT NULL,
    "pveVMId" INTEGER,
    "pveTemplateId" INTEGER NOT NULL,
    "cpus" INTEGER NOT NULL,
    "memoryMB" INTEGER NOT NULL,
    "diskGB" INTEGER NOT NULL,
    "courseOfferingId" INTEGER,
    "requestId" INTEGER,
    "status" "InstanceStatus" NOT NULL DEFAULT 'PENDING',
    "provisionStatus" "InstanceProvisionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "provisionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "semesterId" INTEGER,

    CONSTRAINT "instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_reverse_proxy" (
    "id" SERIAL NOT NULL,
    "targetPort" INTEGER NOT NULL,
    "type" "ReverseProxyType" NOT NULL DEFAULT 'HTTPS',
    "description" TEXT,
    "instanceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_reverse_proxy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_audit_log" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "performedById" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "instance_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseOfferingId" INTEGER NOT NULL,
    "pveTemplateId" INTEGER NOT NULL,
    "cpus" INTEGER NOT NULL,
    "memoryMB" INTEGER NOT NULL,
    "diskGB" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "reviewerId" INTEGER,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extended_request" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetInstanceId" INTEGER NOT NULL,
    "nextSemesterId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "reviewerId" INTEGER,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extended_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_audit_log" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "action" "ApprovalStatus" NOT NULL,
    "performedById" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "request_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extended_request_audit_log" (
    "id" SERIAL NOT NULL,
    "extendedRequestId" INTEGER NOT NULL,
    "action" "ApprovalStatus" NOT NULL,
    "performedById" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "extended_request_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ssh_key" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ssh_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_file" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlatformFileType" NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "visibility" "PlatformFileViewerRole" NOT NULL DEFAULT 'OWNER',
    "parentId" TEXT,
    "platformUserId" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_file_version" (
    "id" SERIAL NOT NULL,
    "platformFileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_file_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_file_permission" (
    "id" SERIAL NOT NULL,
    "platformFileId" TEXT NOT NULL,
    "platformUserId" INTEGER NOT NULL,
    "permission" "PlatformFileViewerRole" NOT NULL DEFAULT 'VIEWER',

    CONSTRAINT "platform_file_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CourseInstructors" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CourseInstructors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_userId_key" ON "platform_user"("userId");

-- CreateIndex
CREATE INDEX "platform_user_userId_role_idx" ON "platform_user"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_search_email_key" ON "instructor_search"("email");

-- CreateIndex
CREATE UNIQUE INDEX "course_code_key" ON "course"("code");

-- CreateIndex
CREATE INDEX "course_code_isActive_idx" ON "course"("code", "isActive");

-- CreateIndex
CREATE INDEX "semester_isCurrent_idx" ON "semester"("isCurrent");

-- CreateIndex
CREATE INDEX "course_offering_courseId_semesterId_idx" ON "course_offering"("courseId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "course_offering_courseId_semesterId_key" ON "course_offering"("courseId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "pve_node_name_key" ON "pve_node"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pve_node_ipAddress_key" ON "pve_node"("ipAddress");

-- CreateIndex
CREATE INDEX "pve_node_name_idx" ON "pve_node"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pve_network_name_subnet_key" ON "pve_network"("name", "subnet");

-- CreateIndex
CREATE UNIQUE INDEX "pve_network_ip_ipAddress_key" ON "pve_network_ip"("ipAddress");

-- CreateIndex
CREATE INDEX "pve_network_ip_ipAddress_isAllocated_pveNetworkId_idx" ON "pve_network_ip"("ipAddress", "isAllocated", "pveNetworkId");

-- CreateIndex
CREATE UNIQUE INDEX "pve_template_vmId_key" ON "pve_template"("vmId");

-- CreateIndex
CREATE UNIQUE INDEX "pve_template_name_type_key" ON "pve_template"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "pve_vm_vmId_key" ON "pve_vm"("vmId");

-- CreateIndex
CREATE UNIQUE INDEX "pve_vm_hostname_key" ON "pve_vm"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "pve_vm_pveNetworkIPId_key" ON "pve_vm"("pveNetworkIPId");

-- CreateIndex
CREATE INDEX "pve_vm_pveNodeId_status_idx" ON "pve_vm"("pveNodeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "instance_requestId_key" ON "instance"("requestId");

-- CreateIndex
CREATE INDEX "instance_status_provisionStatus_platformUserId_pveTemplateI_idx" ON "instance"("status", "provisionStatus", "platformUserId", "pveTemplateId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "instance_platformUserId_courseOfferingId_key" ON "instance"("platformUserId", "courseOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "instance_reverse_proxy_instanceId_targetPort_key" ON "instance_reverse_proxy"("instanceId", "targetPort");

-- CreateIndex
CREATE INDEX "instance_audit_log_instanceId_performedById_idx" ON "instance_audit_log"("instanceId", "performedById");

-- CreateIndex
CREATE INDEX "request_requesterId_status_courseOfferingId_idx" ON "request"("requesterId", "status", "courseOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "request_requesterId_courseOfferingId_key" ON "request"("requesterId", "courseOfferingId");

-- CreateIndex
CREATE INDEX "extended_request_requesterId_status_targetInstanceId_idx" ON "extended_request"("requesterId", "status", "targetInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "extended_request_requesterId_targetInstanceId_nextSemesterI_key" ON "extended_request"("requesterId", "targetInstanceId", "nextSemesterId");

-- CreateIndex
CREATE INDEX "request_audit_log_requestId_idx" ON "request_audit_log"("requestId");

-- CreateIndex
CREATE INDEX "extended_request_audit_log_extendedRequestId_idx" ON "extended_request_audit_log"("extendedRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_ssh_key_ownerId_name_key" ON "platform_ssh_key"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_ssh_key_ownerId_publicKey_key" ON "platform_ssh_key"("ownerId", "publicKey");

-- CreateIndex
CREATE INDEX "platform_file_platformUserId_idx" ON "platform_file"("platformUserId");

-- CreateIndex
CREATE INDEX "platform_file_parentId_idx" ON "platform_file"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_file_version_platformFileId_versionNumber_key" ON "platform_file_version"("platformFileId", "versionNumber");

-- CreateIndex
CREATE INDEX "platform_file_permission_platformUserId_idx" ON "platform_file_permission"("platformUserId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_file_permission_platformFileId_platformUserId_key" ON "platform_file_permission"("platformFileId", "platformUserId");

-- CreateIndex
CREATE INDEX "_CourseInstructors_B_index" ON "_CourseInstructors"("B");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user" ADD CONSTRAINT "platform_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pve_network_ip" ADD CONSTRAINT "pve_network_ip_pveNetworkId_fkey" FOREIGN KEY ("pveNetworkId") REFERENCES "pve_network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pve_vm" ADD CONSTRAINT "pve_vm_pveNodeId_fkey" FOREIGN KEY ("pveNodeId") REFERENCES "pve_node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pve_vm" ADD CONSTRAINT "pve_vm_pveNetworkIPId_fkey" FOREIGN KEY ("pveNetworkIPId") REFERENCES "pve_network_ip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "instance_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "instance_pveVMId_fkey" FOREIGN KEY ("pveVMId") REFERENCES "pve_vm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "instance_pveTemplateId_fkey" FOREIGN KEY ("pveTemplateId") REFERENCES "pve_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "instance_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "instance_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "instance_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_reverse_proxy" ADD CONSTRAINT "instance_reverse_proxy_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_audit_log" ADD CONSTRAINT "instance_audit_log_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_audit_log" ADD CONSTRAINT "instance_audit_log_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_pveTemplateId_fkey" FOREIGN KEY ("pveTemplateId") REFERENCES "pve_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extended_request" ADD CONSTRAINT "extended_request_targetInstanceId_fkey" FOREIGN KEY ("targetInstanceId") REFERENCES "instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extended_request" ADD CONSTRAINT "extended_request_nextSemesterId_fkey" FOREIGN KEY ("nextSemesterId") REFERENCES "semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extended_request" ADD CONSTRAINT "extended_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extended_request" ADD CONSTRAINT "extended_request_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_audit_log" ADD CONSTRAINT "request_audit_log_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_audit_log" ADD CONSTRAINT "request_audit_log_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extended_request_audit_log" ADD CONSTRAINT "extended_request_audit_log_extendedRequestId_fkey" FOREIGN KEY ("extendedRequestId") REFERENCES "extended_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extended_request_audit_log" ADD CONSTRAINT "extended_request_audit_log_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ssh_key" ADD CONSTRAINT "platform_ssh_key_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_file" ADD CONSTRAINT "platform_file_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "platform_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_file" ADD CONSTRAINT "platform_file_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_file_version" ADD CONSTRAINT "platform_file_version_platformFileId_fkey" FOREIGN KEY ("platformFileId") REFERENCES "platform_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_file_permission" ADD CONSTRAINT "platform_file_permission_platformFileId_fkey" FOREIGN KEY ("platformFileId") REFERENCES "platform_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_file_permission" ADD CONSTRAINT "platform_file_permission_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseInstructors" ADD CONSTRAINT "_CourseInstructors_A_fkey" FOREIGN KEY ("A") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseInstructors" ADD CONSTRAINT "_CourseInstructors_B_fkey" FOREIGN KEY ("B") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
