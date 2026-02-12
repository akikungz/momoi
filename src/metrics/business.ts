import { Counter, Gauge, Histogram } from "prom-client";
import { metricsRegistry } from "./registry";

// ============================================================================
// Instance Metrics
// ============================================================================

/**
 * Counter for total instances created
 */
export const instancesCreatedTotal = new Counter({
  name: "momoi_instances_created_total",
  help: "Total number of instances created",
  labelNames: ["template_id", "course_code"],
  registers: [metricsRegistry],
});

/**
 * Counter for instance provisioning results
 */
export const instanceProvisioningTotal = new Counter({
  name: "momoi_instance_provisioning_total",
  help: "Total instance provisioning attempts by result",
  labelNames: ["status", "template_id"],
  registers: [metricsRegistry],
});

/**
 * Histogram for instance provisioning duration
 */
export const instanceProvisioningDuration = new Histogram({
  name: "momoi_instance_provisioning_duration_seconds",
  help: "Time taken to provision an instance",
  labelNames: ["template_id", "status"],
  buckets: [5, 10, 30, 60, 120, 300, 600, 900, 1800],
  registers: [metricsRegistry],
});

/**
 * Gauge for current instance counts by status
 */
export const instancesByStatus = new Gauge({
  name: "momoi_instances_by_status",
  help: "Current number of instances by status",
  labelNames: ["status", "provision_status"],
  registers: [metricsRegistry],
});

/**
 * Counter for instance status changes (start/stop/restart)
 */
export const instanceStatusChangesTotal = new Counter({
  name: "momoi_instance_status_changes_total",
  help: "Total instance status change operations",
  labelNames: ["action", "result"],
  registers: [metricsRegistry],
});

/**
 * Counter for instance deletions/deprovisions
 */
export const instancesDeletedTotal = new Counter({
  name: "momoi_instances_deleted_total",
  help: "Total number of instances deleted/deprovisioned",
  labelNames: ["reason"],
  registers: [metricsRegistry],
});

// ============================================================================
// Request Metrics
// ============================================================================

/**
 * Counter for requests created
 */
export const requestsCreatedTotal = new Counter({
  name: "momoi_requests_created_total",
  help: "Total number of instance requests created",
  labelNames: ["type"], // 'standard' or 'extended'
  registers: [metricsRegistry],
});

/**
 * Counter for request status updates
 */
export const requestStatusUpdatesTotal = new Counter({
  name: "momoi_request_status_updates_total",
  help: "Total request status changes by action",
  labelNames: ["type", "action"], // action: APPROVED, REJECTED, CANCELLED
  registers: [metricsRegistry],
});

/**
 * Gauge for pending requests count
 */
export const pendingRequestsCount = new Gauge({
  name: "momoi_pending_requests_count",
  help: "Current number of pending requests",
  labelNames: ["type"],
  registers: [metricsRegistry],
});

/**
 * Histogram for request approval time (time from creation to resolution)
 */
export const requestApprovalDuration = new Histogram({
  name: "momoi_request_approval_duration_seconds",
  help: "Time taken from request creation to approval/rejection",
  labelNames: ["type", "action"],
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400, 172800, 604800],
  registers: [metricsRegistry],
});

// ============================================================================
// User Activity Metrics
// ============================================================================

/**
 * Counter for user logins
 */
export const userLoginsTotal = new Counter({
  name: "momoi_user_logins_total",
  help: "Total number of user logins",
  labelNames: ["method"], // oauth, local, etc.
  registers: [metricsRegistry],
});

/**
 * Gauge for active users (users with activity in last N minutes)
 */
export const activeUsersCount = new Gauge({
  name: "momoi_active_users_count",
  help: "Number of users active in the measurement window",
  labelNames: ["role"],
  registers: [metricsRegistry],
});

/**
 * Counter for SSH key operations
 */
export const sshKeyOperationsTotal = new Counter({
  name: "momoi_ssh_key_operations_total",
  help: "Total SSH key operations",
  labelNames: ["operation"], // create, delete, update
  registers: [metricsRegistry],
});

// ============================================================================
// Queue/Job Metrics
// ============================================================================

/**
 * Gauge for queue sizes
 */
export const queueSize = new Gauge({
  name: "momoi_queue_size",
  help: "Current number of jobs in queue",
  labelNames: ["queue_name", "state"], // state: waiting, active, delayed, completed, failed
  registers: [metricsRegistry],
});

/**
 * Counter for jobs processed
 */
export const jobsProcessedTotal = new Counter({
  name: "momoi_jobs_processed_total",
  help: "Total number of jobs processed",
  labelNames: ["queue_name", "status"], // status: success, failed
  registers: [metricsRegistry],
});

/**
 * Histogram for job processing duration
 */
export const jobProcessingDuration = new Histogram({
  name: "momoi_job_processing_duration_seconds",
  help: "Time taken to process jobs",
  labelNames: ["queue_name", "job_type"],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

/**
 * Counter for job retries
 */
export const jobRetriesTotal = new Counter({
  name: "momoi_job_retries_total",
  help: "Total number of job retry attempts",
  labelNames: ["queue_name", "job_type"],
  registers: [metricsRegistry],
});

// ============================================================================
// Resource Metrics
// ============================================================================

/**
 * Gauge for total allocated resources
 */
export const allocatedResources = new Gauge({
  name: "momoi_allocated_resources",
  help: "Total allocated resources across all instances",
  labelNames: ["resource_type"], // cpu, memory_mb, disk_gb
  registers: [metricsRegistry],
});

/**
 * Gauge for resources by course
 */
export const resourcesByCourse = new Gauge({
  name: "momoi_resources_by_course",
  help: "Allocated resources per course",
  labelNames: ["course_code", "resource_type"],
  registers: [metricsRegistry],
});

// ============================================================================
// Reverse Proxy Metrics
// ============================================================================

/**
 * Counter for reverse proxy operations
 */
export const reverseProxyOperationsTotal = new Counter({
  name: "momoi_reverse_proxy_operations_total",
  help: "Total reverse proxy configuration operations",
  labelNames: ["operation"], // create, delete, update
  registers: [metricsRegistry],
});

/**
 * Gauge for active reverse proxy count
 */
export const activeReverseProxiesCount = new Gauge({
  name: "momoi_active_reverse_proxies_count",
  help: "Current number of active reverse proxy configurations",
  registers: [metricsRegistry],
});

// ============================================================================
// Academic Metrics
// ============================================================================

/**
 * Gauge for active courses count
 */
export const activeCoursesCount = new Gauge({
  name: "momoi_active_courses_count",
  help: "Number of active course offerings",
  labelNames: ["semester"],
  registers: [metricsRegistry],
});

/**
 * Gauge for instances per course
 */
export const instancesPerCourse = new Gauge({
  name: "momoi_instances_per_course",
  help: "Number of instances per course offering",
  labelNames: ["course_code", "semester"],
  registers: [metricsRegistry],
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record an instance creation event
 */
export function recordInstanceCreated(templateId: number, courseCode?: string) {
  instancesCreatedTotal
    .labels(String(templateId), courseCode || "unknown")
    .inc();
}

/**
 * Record a provisioning result
 */
export function recordProvisioningResult(
  status: "success" | "failed",
  templateId: number,
  durationSeconds?: number
) {
  instanceProvisioningTotal.labels(status, String(templateId)).inc();
  if (durationSeconds !== undefined) {
    instanceProvisioningDuration
      .labels(String(templateId), status)
      .observe(durationSeconds);
  }
}

/**
 * Record a request creation
 */
export function recordRequestCreated(type: "standard" | "extended") {
  requestsCreatedTotal.labels(type).inc();
}

/**
 * Record a request status update
 */
export function recordRequestStatusUpdate(
  type: "standard" | "extended",
  action: "APPROVED" | "REJECTED" | "CANCELLED",
  durationSeconds?: number
) {
  requestStatusUpdatesTotal.labels(type, action).inc();
  if (durationSeconds !== undefined) {
    requestApprovalDuration.labels(type, action).observe(durationSeconds);
  }
}

/**
 * Record a job processing result
 */
export function recordJobProcessed(
  queueName: string,
  status: "success" | "failed",
  jobType: string,
  durationSeconds?: number
) {
  jobsProcessedTotal.labels(queueName, status).inc();
  if (durationSeconds !== undefined) {
    jobProcessingDuration.labels(queueName, jobType).observe(durationSeconds);
  }
}

/**
 * Update queue size gauge
 */
export function updateQueueSize(
  queueName: string,
  state: "waiting" | "active" | "delayed" | "completed" | "failed",
  count: number
) {
  queueSize.labels(queueName, state).set(count);
}

/**
 * Update allocated resources gauge
 */
export function updateAllocatedResources(
  cpuTotal: number,
  memoryMBTotal: number,
  diskGBTotal: number
) {
  allocatedResources.labels("cpu").set(cpuTotal);
  allocatedResources.labels("memory_mb").set(memoryMBTotal);
  allocatedResources.labels("disk_gb").set(diskGBTotal);
}
