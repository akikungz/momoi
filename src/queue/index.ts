import { Queue } from 'bullmq';
import Redis from 'ioredis';

import { env } from '@momoi/env';
import type {
  ProvisionInstanceJobData,
  DeprovisionInstanceJobData,
  ProvisionInstanceJobResult,
  DeprovisionInstanceJobResult,
} from './types';

export class QueueModule {
  private redis: Redis;

  public provisionInstanceQueue: Queue<ProvisionInstanceJobData, ProvisionInstanceJobResult>;
  public deprovisionInstanceQueue: Queue<DeprovisionInstanceJobData, DeprovisionInstanceJobResult>;

  constructor() {
    // Initialize Redis connection
    if (!env.REDIS_URL) {
      throw new Error('REDIS_URL is not defined in environment variables.');
    }

    const redisUrl = new URL(env.REDIS_URL);
    const redisConfig = {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port || '6379', 10),
      password: redisUrl.password || undefined,
      db: redisUrl.pathname ? parseInt(redisUrl.pathname.slice(1), 10) : 0,
    };

    this.redis = new Redis(redisConfig);

    // Initialize queues
    this.provisionInstanceQueue = new Queue<ProvisionInstanceJobData, ProvisionInstanceJobResult>(
      'provision-instance',
      { connection: this.redis, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }
    );

    this.deprovisionInstanceQueue = new Queue<DeprovisionInstanceJobData, DeprovisionInstanceJobResult>(
      'deprovision-instance',
      { connection: this.redis, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }
    );
  }

  public async closeConnections() {
    await this.provisionInstanceQueue.close();
    await this.deprovisionInstanceQueue.close();
    await this.redis.quit();
  }
}
