import {
	recordInstanceOperation,
	recordQueueJobEnqueued,
} from "@momoi/telemetry/runtime";

import type { InstanceTelemetryPort } from "../application/ports";

export class RuntimeInstanceTelemetry implements InstanceTelemetryPort {
	recordInstanceOperation(
		operation: string,
		attributes?: Record<string, string | boolean>,
	): void {
		recordInstanceOperation(operation, attributes);
	}

	recordQueueJobEnqueued(
		queueName: string,
		jobName: string,
		attributes?: Record<string, string>,
	): void {
		recordQueueJobEnqueued(queueName, jobName, attributes);
	}
}
