# Notification Analysis for Momoi API

## Summary
The API has **multiple points where notifications should be sent** but currently **lacks a notification system implementation**. There are explicit TODO comments indicating notification functionality needs to be added.

---

## Services Requiring Notification

### 1. **RequestService** (`src/service/request.ts`)

#### A. Standard Request Approval
- **Location:** Line 200 (in `updateRequestStatus` method)
- **Trigger:** When request status changes to `APPROVED`
- **TODO:** `// TODO: Trigger instance provisioning workflow`
- **Should Notify:**
  - **Requester (Student):** Request has been approved
  - **Reviewer (Instructor/Admin):** Confirmation of their approval action
  - **System:** Queue instance provisioning job

#### B. Extended Request Approval  
- **Location:** Line 358 (in `updateExtendedRequestStatus` method)
- **Trigger:** When extended request status changes to `APPROVED`
- **TODO:** `// TODO: Apply semester into the target instance`
- **Should Notify:**
  - **Requester (Student):** Extended request approved
  - **Instructor/Admin:** Confirmation of their approval action
  - **System:** Queue instance extension workflow

#### C. Request Status Changes (General)
- **Triggers:** REJECTED, CANCELLED, APPROVED statuses
- **Current Behavior:** Only cache invalidation, no notifications sent
- **Impact:** Users don't get real-time feedback on request decisions
- **Affected Users:**
  - Requester (always needs notification)
  - Reviewer (if not the same person)
  - Course instructors (if action requires their awareness)

---

### 2. **InstanceService** (`src/service/instance.ts`)

#### A. Instance Creation
- **Location:** Line 63-75 (in `createInstanceByInstructor` method)
- **Current:** Already queues provisioning job to `provisionInstanceQueue`
- **Missing:** No notification about job queuing status to the user
- **Should Notify:**
  - **User/Instructor:** Instance provisioning has been queued
  - **Status:** "Your VM provisioning request is being processed..."

#### B. Instance Deletion
- **Location:** Line 585-599 (in likely `deleteInstance` method)
- **Current:** Already queues deprovisioning job
- **Missing:** No notification about deprovisioning status
- **Should Notify:**
  - **User:** Instance is being deprovisioned
  - **Admins:** For audit/monitoring purposes

#### C. Instance Status Changes
- **Scenarios:**
  - Provisioning started/completed/failed
  - Deprovisioning started/completed/failed
  - Instance suspended/resumed
- **Current:** No notifications
- **Needed:** User feedback on infrastructure changes

---

### 3. **AcademicService** (`src/service/academic.ts`)

#### A. Mailing List Operations
- **Current Behavior:** Manages instructor mailing lists
- **Potential Notifications:**
  - When instructor is added to mailing list
  - When instructor is removed from mailing list
  - Send bulk emails to mailing list members

---

## Queue System Status

### Currently Implemented
```typescript
// From src/queue/index.ts
- provisionInstanceQueue      // Instance provisioning jobs
- deprovisionInstanceQueue    // Instance deprovisioning jobs
```

### Queue Types Defined
From `src/queue/types.ts`:
- `ProvisionInstanceJobData`
- `DeprovisionInstanceJobData`
- `ProvisionInstanceJobResult`
- `DeprovisionInstanceJobResult`

### What's Missing
- **NotificationQueue** - No dedicated queue for sending notifications
- **Notification Job Types** - No types defined for notification jobs
- **Notification Service** - No service to handle notification logic
- **Notification Workers** - No worker implementation for processing notifications

---

## Recommended Implementation Plan

### Phase 1: Create Notification Infrastructure
1. **Add notification types** to `src/queue/types.ts`:
   ```typescript
   export interface NotificationJobData {
     userId: number;
     type: 'REQUEST_APPROVED' | 'REQUEST_REJECTED' | 'INSTANCE_PROVISIONING' | 'INSTANCE_FAILED' | 'EXTENDED_REQUEST_APPROVED';
     title: string;
     message: string;
     metadata?: Record<string, any>;
   }
   ```

2. **Create notification queue** in `src/queue/index.ts`:
   ```typescript
   export const notificationQueue = new Queue<NotificationJobData>(...)
   ```

3. **Create NotificationService** in `src/service/notification.ts`

### Phase 2: Integrate Notifications into Services

1. **RequestService Updates:**
   - Add notification queue to constructor
   - Queue notifications on request status change
   - Add notifications for cancellation, rejection, approval

2. **InstanceService Updates:**
   - Add notification queue to constructor
   - Queue notifications on instance creation
   - Queue notifications on instance deletion/status changes

### Phase 3: Create Notification Worker
- Implement in worker service (separate from main API)
- Handle email sending
- Handle in-app notifications
- Handle failure retries

---

## Data Flow Overview

```
User Action (Request Approval)
    ↓
RequestService.updateRequestStatus()
    ↓
1. Update database ✓ (done)
2. Create audit log ✓ (done)
3. Invalidate cache ✓ (done)
4. Queue notification ✗ (TODO)
5. Trigger workflow ✗ (TODO)
    ↓
NotificationWorker
    ↓
Send Email/Notification to Users
```

---

## Related Code Locations

### Routes
- [Request routes](src/routes/request.ts) - API endpoints for request management
- [Instance routes](src/routes/instance.ts) - API endpoints for instance management

### Models
- [Request model](src/model/request.ts) - Request data types
- [Instance model](src/model/instance.ts) - Instance data types

### Database
- [Prisma schema](src/database/prisma/schema.prisma) - Database structure with request/instance tables

### Current Queue Implementation
- [Queue index](src/queue/index.ts) - Queue definitions
- [Queue types](src/queue/types.ts) - Job data types

---

## Priority Actions

### High Priority
1. ✅ Create notification queue and types
2. ✅ Add notifications to RequestService (approval/rejection/cancellation)
3. ✅ Create basic notification worker

### Medium Priority
1. ✅ Add notifications to InstanceService
2. ✅ Implement email notification channel
3. ✅ Add audit logging for notifications sent

### Low Priority
1. ✅ Add in-app notification system
2. ✅ Add SMS notification support
3. ✅ Advanced notification preferences management

---

## Notes
- The system already has BullMQ queue infrastructure (based on `bun add bullmq` in terminal history)
- Redis is configured as the queue backend
- Notification system follows the same pattern as the existing provisioning queues
- All services have access to a cache module for rate limiting notifications if needed
