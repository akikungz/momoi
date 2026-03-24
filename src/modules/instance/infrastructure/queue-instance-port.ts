import type { QueueModule } from "@momoi/queue";

import type { InstanceQueuePort } from "../application/ports";

export class QueueInstancePort implements InstanceQueuePort {
	constructor(private readonly queue: QueueModule) {}

	async enqueueProvisionInstance(
		instanceId: number,
		userId: number,
		jobId: string,
	) {
		await this.queue.provisionInstanceQueue.add(
			"provision",
			{ instanceId, userId },
			{ jobId, removeOnComplete: true, removeOnFail: false },
		);
	}

	async enqueueDeprovisionInstance(
		instanceId: number,
		userId: number,
		jobId: string,
	) {
		await this.queue.deprovisionInstanceQueue.add(
			"deprovision",
			{ instanceId, userId },
			{ jobId, removeOnComplete: true, removeOnFail: false },
		);
	}
}
