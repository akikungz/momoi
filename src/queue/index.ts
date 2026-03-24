import { Queue } from "bullmq";
import Redis from "ioredis";

import { env } from "@momoi/env";
import { setDependencyAvailability } from "../telemetry/runtime";

import type {
  ProvisionInstanceJobData,
  DeprovisionInstanceJobData,
  ProvisionInstanceJobResult,
  DeprovisionInstanceJobResult,
  ToggleInstanceStatusJobData,
  ToggleInstanceStatusJobResult
} from './types';

export class QueueModule {
  public provisionInstanceQueue: Queue<ProvisionInstanceJobData, ProvisionInstanceJobResult>;
  public deprovisionInstanceQueue: Queue<DeprovisionInstanceJobData, DeprovisionInstanceJobResult>;
  public toggleInstanceStatusQueue: Queue<ToggleInstanceStatusJobData, ToggleInstanceStatusJobResult>;

  constructor(base_key: string = env.NODE_ENV) {
    // Initialize Redis connection
    if (!env.REDIS_URL) {
      setDependencyAvailability("queue", false);
      throw new Error("REDIS_URL is not defined in environment variables");
    }

    const redisUrl = new URL(env.REDIS_URL);
    const redisConfig = {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port || '6379', 10),
      password: redisUrl.password || undefined,
      db: redisUrl.pathname ? parseInt(redisUrl.pathname.slice(1), 10) : 0,
    };

    // Initialize queues
    this.provisionInstanceQueue = new Queue<ProvisionInstanceJobData, ProvisionInstanceJobResult, string, ProvisionInstanceJobData, ProvisionInstanceJobResult, string>(
      `${base_key}_provision-instance`,
      { connection: redisConfig, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }
    );

    this.deprovisionInstanceQueue = new Queue<DeprovisionInstanceJobData, DeprovisionInstanceJobResult, string, DeprovisionInstanceJobData, DeprovisionInstanceJobResult, string>(
      `${base_key}_deprovision-instance`,
      { connection: redisConfig, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }
    );

    this.toggleInstanceStatusQueue = new Queue<ToggleInstanceStatusJobData, ToggleInstanceStatusJobResult, string, ToggleInstanceStatusJobData, ToggleInstanceStatusJobResult, string>(
      `${base_key}_toggle-instance-status`,
      { connection: redisConfig, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }
    );

    setDependencyAvailability("queue", true);
  }

  public async closeConnections() {
    await this.provisionInstanceQueue.close();
    await this.deprovisionInstanceQueue.close();
    await this.toggleInstanceStatusQueue.close();
    setDependencyAvailability("queue", false);
  }
}
