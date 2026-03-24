import {
	recordQueueJobEnqueued,
	recordRequestOperation,
} from "@momoi/telemetry/runtime";

import type { RequestTelemetryPort } from "../application/ports";

export class RuntimeRequestTelemetry implements RequestTelemetryPort {
	recordRequestOperation(
		operation: string,
		attributes?: Record<string, string>,
	): void {
		recordRequestOperation(operation, attributes);
	}

	recordQueueJobEnqueued(
		queueName: string,
		jobName: string,
		attributes?: Record<string, string>,
	): void {
		recordQueueJobEnqueued(queueName, jobName, attributes);
	}
}
