import type { QueueModule } from "@momoi/queue";

import type { RequestQueuePort } from "../application/ports";

export class QueueRequestPort implements RequestQueuePort {
	constructor(private readonly queue: QueueModule) {}

	async enqueueProvisionInstance(
		instanceId: number,
		userId: number,
	): Promise<void> {
		await this.queue.provisionInstanceQueue.add("provision", {
			instanceId,
			userId,
		});
	}
}
