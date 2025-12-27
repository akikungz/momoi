# Worker Implementation Guide

This document describes what the worker microservice needs to implement to consume the queue triggers from the Momoi API.

## Queue Setup in Worker Repository

The worker repository should:

1. **Connect to the same Redis instance** using `REDIS_URL` environment variable
2. **Import types** from this queue package (or replicate them)
3. **Create workers** that listen to queue names

## Implementation Template

### Provision Instance Worker

```typescript
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import type { ProvisionInstanceJobData, ProvisionInstanceJobResult } from '@momoi/queue';

const redis = new Redis(process.env.REDIS_URL);

export const provisionInstanceWorker = new Worker<
  ProvisionInstanceJobData,
  ProvisionInstanceJobResult
>(
  'provision-instance',
  async (job) => {
    const { instanceId, userId } = job.data;
    
    // 1. Query database for full instance details
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        platformUserId: true,
        cpus: true,
        memoryMB: true,
        diskGB: true,
        pveTemplateId: true,
        courseOfferingId: true,
        courseOffering: { select: { course: { select: { code: true } } } },
        pveTemplate: { select: { name: true } },
      },
    });

    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    if (instance.platformUserId !== userId) throw new Error('Unauthorized');

    // 2. Call Proxmox VE API to create VM
    const vm = await proxmox.createVM({
      template: instance.pveTemplate.name,
      cpus: instance.cpus,
      memory: instance.memoryMB,
      disk: instance.diskGB,
    });

    // 3. Update database with VM details
    await prisma.instance.update({
      where: { id: instanceId },
      data: {
        status: 'ACTIVE',
        pveVM: {
          create: {
            hostname: vm.hostname,
            vmType: vm.type,
            pveNodeId: vm.nodeId,
            pveNetworkIP: {
              create: {
                ipAddress: vm.ipAddress,
              },
            },
          },
        },
      },
    });

    // 4. Create audit log
    await prisma.instanceAuditLog.create({
      data: {
        instanceId,
        action: 'PROVISIONED',
        performedById: userId,
        notes: `VM provisioned: ${vm.hostname}`,
      },
    });

    return {
      instanceId,
      status: 'success',
      message: 'Instance provisioned successfully',
    };
  },
  { connection: redis, concurrency: 2 }
);
```

### Deprovision Instance Worker

```typescript
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import type { DeprovisionInstanceJobData, DeprovisionInstanceJobResult } from '@momoi/queue';

const redis = new Redis(process.env.REDIS_URL);

export const deprovisionInstanceWorker = new Worker<
  DeprovisionInstanceJobData,
  DeprovisionInstanceJobResult
>(
  'deprovision-instance',
  async (job) => {
    const { instanceId, userId } = job.data;

    // 1. Query database for instance and VM details
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: {
        platformUserId: true,
        pveVM: { select: { id: true, hostname: true } },
      },
    });

    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    if (instance.platformUserId !== userId) throw new Error('Unauthorized');

    // 2. Delete VM from Proxmox VE
    if (instance.pveVM) {
      await proxmox.deleteVM(instance.pveVM.hostname);
    }

    // 3. Update instance status
    await prisma.instance.update({
      where: { id: instanceId },
      data: { status: 'INACTIVE' },
    });

    // 4. Create audit log
    await prisma.instanceAuditLog.create({
      data: {
        instanceId,
        action: 'DEPROVISIONED',
        performedById: userId,
        notes: 'VM deprovisioned successfully',
      },
    });

    return {
      instanceId,
      status: 'success',
      message: 'Instance deprovisioned successfully',
    };
  },
  { connection: redis, concurrency: 2 }
);
```

## Key Points

1. **Queue Names** must match exactly:
   - `provision-instance`
   - `deprovision-instance`

2. **Data Shape** - receive minimal trigger data:
   - Provision: `{ instanceId, userId }`
   - Deprovision: `{ instanceId, userId }`

3. **Database Query** - always fetch fresh data before processing

4. **Error Handling**:
   - Throw errors to trigger automatic retries
   - Jobs retry up to 3 times with exponential backoff
   - Failed jobs remain in queue for investigation

5. **Concurrency**:
   - Set to 2 to prevent resource exhaustion
   - Adjust based on infrastructure capacity

6. **Return Values**:
   ```typescript
   {
     instanceId: number,
     status: 'success' | 'failed',
     message: string
   }
   ```

## Testing

### Start Worker

```bash
bun run start:worker
```

### Test Provision Job

```bash
# Via API
curl -X POST http://localhost:3000/api/instances \
  -H "Content-Type: application/json" \
  -d '{
    "pveTemplateId": 1,
    "courseOfferingId": 1,
    "cpus": 2,
    "memoryMB": 2048,
    "diskGB": 50
  }'

# Monitor in Redis
redis-cli
> MONITOR
```

### Debug Failed Jobs

```bash
redis-cli
> KEYS "bull:provision-instance:*:failed"
> GET "bull:provision-instance:failed"
```

## Environment Variables

Worker needs:
```env
# Database
DATABASE_URL=postgresql://...

# Redis (shared with API)
REDIS_URL=redis://localhost:6379/0

# Proxmox VE
PROXMOX_HOST=pve.example.com
PROXMOX_USER=root@pam
PROXMOX_PASSWORD=...
```

## References

- [BullMQ Workers](https://docs.bullmq.io/guide/workers)
- [BullMQ Best Practices](https://docs.bullmq.io/guide/best-practices)
- Momoi API Queue: [src/queue/index.ts](src/queue/index.ts)
