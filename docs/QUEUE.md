# Queue System - Job Triggers for Async Processing

## Overview

This package contains the BullMQ queue configuration for triggering async background jobs. The actual job workers are implemented in a separate **worker microservice repository** to enable independent scaling and deployment.

**Architecture:**
- **This Repository (Momoi API)**: Job producers - sends triggers to Redis queue
- **Worker Repository**: Job consumers - listens and processes triggers
- **Shared Redis**: Message broker connecting producers and consumers

## Components

### 1. Queue Configuration ([src/queue/index.ts](src/queue/index.ts))

Initializes and exports queue instances:

```typescript
export const provisionInstanceQueue = new Queue<ProvisionInstanceJobData, ProvisionInstanceJobResult>(
  'provision-instance',
  { connection: redis, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }
);

export const deprovisionInstanceQueue = new Queue<DeprovisionInstanceJobData, DeprovisionInstanceJobResult>(
  'deprovision-instance',
  { connection: redis, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }
);
```

**Features:**
- Redis connection management (via `REDIS_URL` env var)
- Automatic retry with exponential backoff (3 attempts)
- Graceful shutdown support

### 2. Type Definitions ([src/queue/types.ts](src/queue/types.ts))

Shared TypeScript interfaces for type-safe job handling:

```typescript
export interface ProvisionInstanceJobData {
  instanceId: number;
  userId: number;
}

export interface DeprovisionInstanceJobData {
  instanceId: number;
  userId: number;
}
```

**Design Pattern:** Minimal trigger data - workers query database for full details

### 3. Service Integration ([src/service/instance.ts](src/service/instance.ts))

Service layer dispatches triggers to queue:

```typescript
// Provision trigger
await provisionInstanceQueue.add(
  'provision',
  { instanceId, userId },
  { jobId: `provision-${instanceId}`, removeOnComplete: true }
);

// Deprovision trigger
await deprovisionInstanceQueue.add(
  'deprovision',
  { instanceId, userId },
  { jobId: `deprovision-${instanceId}`, removeOnComplete: true }
);
```

## Job Flow

### Provision Instance Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Momoi API Service                         │
├─────────────────────────────────────────────────────────────┤
│  1. Create instance in database (status: PENDING)            │
│  2. Queue trigger: { instanceId, userId }                    │
│  3. Return response to client                                │
└─────────────────────┬───────────────────────────────────────┘
                      │ Redis Queue: provision-instance
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                  Worker Microservice                         │
├─────────────────────────────────────────────────────────────┤
│  1. Receive trigger: { instanceId, userId }                  │
│  2. Query database for full instance details                 │
│  3. Call Proxmox VE API to create VM                         │
│  4. Configure networking & allocate resources                │
│  5. Update instance status to ACTIVE                         │
│  6. Create audit log                                         │
└─────────────────────────────────────────────────────────────┘
```

### Deprovision Instance Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Momoi API Service                         │
├─────────────────────────────────────────────────────────────┤
│  1. Delete instance from database                            │
│  2. Queue trigger: { instanceId, userId }                    │
│  3. Return success response                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ Redis Queue: deprovision-instance
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                  Worker Microservice                         │
├─────────────────────────────────────────────────────────────┤
│  1. Receive trigger: { instanceId, userId }                  │
│  2. Query database for VM details                            │
│  3. Call Proxmox VE API to delete VM                         │
│  4. Release IP addresses & resources                         │
│  5. Update instance status to INACTIVE                       │
│  6. Create audit log                                         │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Add to `.env`:
```env
REDIS_URL=redis://localhost:6379/0
```

If not set, defaults to `localhost:6379`

### Queue Options

Both queues configured with:
- **Attempts**: 3 retries on failure
- **Backoff**: Exponential with 2-second initial delay
- **Cleanup**: Remove successful jobs from queue

## Job Data Structures

### Provision Instance

```typescript
{
  instanceId: number;    // ID of instance to provision
  userId: number;        // User who owns the instance
}
```

Worker will query database to get:
- PVE template details
- Resource configuration (CPU, memory, disk)
- Course/semester information
- Network configuration

### Deprovision Instance

```typescript
{
  instanceId: number;    // ID of instance to deprovision
  userId: number;        // User who owns the instance
}
```

Worker will query database to get:
- VM details for deletion
- Associated IP addresses
- Audit information

## Benefits of This Architecture

✅ **Decoupled Services**: API and workers can scale independently  
✅ **Resilient**: Failed jobs retry automatically  
✅ **Non-blocking**: API returns immediately, processing happens async  
✅ **Fresh Data**: Workers always query latest database state  
✅ **Minimal Payloads**: Only IDs transmitted via queue  
✅ **Flexible**: Changes to data don't require queue schema updates  
✅ **Auditable**: All operations logged in database  

## Integration Points

### Creating an Instance

**API Request:**
```bash
POST /api/instances
{
  "pveTemplateId": 1,
  "courseOfferingId": 1,
  "cpus": 2,
  "memoryMB": 2048,
  "diskGB": 50
}
```

**Response (Immediate):**
```json
{
  "id": 123,
  "status": "PENDING",
  "courseOffering": {...},
  "createdAt": "2025-12-26T...",
  "updatedAt": "2025-12-26T..."
}
```

**Background Processing:**
- Job queued to `provision-instance` queue
- Worker processes asynchronously
- Instance status updates from PENDING → ACTIVE
- Audit logs created

### Deleting an Instance

**API Request:**
```bash
DELETE /api/instances/123
```

**Response (Immediate):**
```json
{
  "success": true
}
```

**Background Processing:**
- Job queued to `deprovision-instance` queue
- Worker processes asynchronously
- VM deleted from infrastructure
- Instance marked INACTIVE
- Audit logs created

## Monitoring

### Queue Status

Check Redis for pending jobs:
```bash
redis-cli
> KEYS "bull:provision-instance:*"
> LRANGE "bull:provision-instance:* 0 -1"
```

### Audit Logs

All operations logged in `InstanceAuditLog` table:
- `action`: PROVISIONED, PROVISION_FAILED, DEPROVISIONED, DEPROVISION_FAILED
- `performedById`: User who triggered operation
- `notes`: Details (VM ID, hostname, error messages)
- `timestamp`: When operation occurred

## Worker Implementation

The worker microservice implements:

1. **Provision Instance Worker**
   - Listens to `provision-instance` queue
   - Queries database for instance details
   - Creates VM on Proxmox VE
   - Updates instance status and records audit logs
   - Retries on failure

2. **Deprovision Instance Worker**
   - Listens to `deprovision-instance` queue
   - Queries database for VM details
   - Deletes VM from Proxmox VE
   - Releases resources
   - Records audit logs
   - Retries on failure

**See**: Worker microservice repository for implementation details

## Error Handling

### Job Failures

Jobs automatically retry up to 3 times with exponential backoff:
- 1st attempt: Immediate
- 2nd attempt: After 2 seconds
- 3rd attempt: After 4 seconds
- Final failure: Job moved to failed queue

Failed jobs are **retained** in Redis for debugging. Manual intervention may be required.

### Database Consistency

Workers query database before processing:
- Always work with latest state
- Respects database constraints
- Maintains referential integrity
- All changes audited

## Future Queue Jobs

The same pattern can be used for other async operations:

1. **process-approved-request**: Handle approved instance requests
2. **process-extended-request**: Handle semester extension approvals
3. **configure-reverse-proxy**: Setup proxy configurations
4. **deploy-ssh-keys**: Sync SSH keys to instances
5. **email-notifications**: Send user notifications

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- Worker Repository: [Link to worker microservice]
