import { mock } from "bun:test";

/**
 * Mock Queue Module for testing.
 * Provides mock implementations of the QueueModule for e2e tests.
 */
export class MockQueueModule {
  provisionInstanceQueue = {
    add: mock(async (name: string, data: any, opts?: any) => ({
      id: `mock-job-${Date.now()}`,
      name,
      data,
    })),
    getJob: mock(async () => null),
    getJobs: mock(async () => []),
    close: mock(async () => { }),
  };

  deprovisionInstanceQueue = {
    add: mock(async (name: string, data: any, opts?: any) => ({
      id: `mock-job-${Date.now()}`,
      name,
      data,
    })),
    getJob: mock(async () => null),
    getJobs: mock(async () => []),
    close: mock(async () => { }),
  };

  async closeConnections() {
    await this.provisionInstanceQueue.close();
    await this.deprovisionInstanceQueue.close();
  }
}
