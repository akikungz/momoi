import type { PrometheusQueryPort } from "./application/ports";
import { MonitoringUseCases } from "./application/use-cases";
import { PrometheusMonitoringClient } from "./infrastructure/prometheus-monitoring-client";

export function createMonitoringUseCases(
	queryPort: PrometheusQueryPort = new PrometheusMonitoringClient(),
) {
	return new MonitoringUseCases(queryPort);
}

export * from "./application/use-cases";
