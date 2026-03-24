import type { Static } from "elysia";

import type {
	MonitoringInstantQueryRequestQuery,
	MonitoringProxmoxOverviewRequestQuery,
	MonitoringProxmoxOverviewResponse,
	MonitoringQueryResponse,
	MonitoringRangeQueryRequestQuery,
} from "@momoi/model/monitoring";
import { ServiceError } from "@momoi/utils/error";

import type { PrometheusQueryPort } from "./ports";

export class MonitoringUseCases {
	constructor(private readonly prometheus: PrometheusQueryPort) {}

	public async query(
		query: Static<typeof MonitoringInstantQueryRequestQuery>,
	): Promise<Static<typeof MonitoringQueryResponse>> {
		return this.prometheus.query({
			query: this.requirePromQl(query.query),
			time: this.normalizeOptionalTime(query.time, "time"),
			timeout: this.normalizeOptionalText(query.timeout),
		});
	}

	public async queryRange(
		query: Static<typeof MonitoringRangeQueryRequestQuery>,
	): Promise<Static<typeof MonitoringQueryResponse>> {
		const start = this.normalizeTime(query.start, "start");
		const end = this.normalizeTime(query.end, "end");

		if (this.compareTimes(start, end) > 0) {
			throw new ServiceError(
				"The monitoring query start time must be before the end time.",
				400,
			);
		}

		return this.prometheus.queryRange({
			query: this.requirePromQl(query.query),
			start,
			end,
			step: this.normalizeOptionalText(query.step) ?? "1m",
			timeout: this.normalizeOptionalText(query.timeout),
		});
	}

	public async getProxmoxOverview(
		query: Static<typeof MonitoringProxmoxOverviewRequestQuery>,
	): Promise<Static<typeof MonitoringProxmoxOverviewResponse>> {
		const time = this.normalizeOptionalTime(query.time, "time");
		const timeout = this.normalizeOptionalText(query.timeout);
		const overviewQueries = {
			nodeCount: "count(otelcol_proxmox_node_uptime_seconds)",
			guestCount: "count(otelcol_proxmox_vm_uptime_seconds)",
			guestTypeCounts: "count by (type) (otelcol_proxmox_vm_uptime_seconds)",
			nodeMemoryTotalBytes: "sum(otelcol_proxmox_node_memory_memtotal_bytes)",
			nodeMemoryUsedBytes: "sum(otelcol_proxmox_node_memory_memused_bytes)",
			nodeMemoryAvailableBytes:
				"sum(otelcol_proxmox_node_memory_memavailable_bytes)",
			guestMemoryUsedBytes: "sum(otelcol_proxmox_vm_mem_bytes)",
			guestMemoryCapacityBytes: "sum(otelcol_proxmox_vm_maxmem_bytes)",
			nodeStorageTotalBytes: "sum(otelcol_proxmox_node_blockstat_blocks_bytes)",
			nodeStorageUsedBytes: "sum(otelcol_proxmox_node_blockstat_used_bytes)",
			nodeStorageAvailableBytes:
				"sum(otelcol_proxmox_node_blockstat_bavail_bytes)",
			averageNodeCpuPercent: "avg(otelcol_proxmox_node_cpustat_cpu_percent)",
			averageGuestCpuPercent: "avg(otelcol_proxmox_vm_cpu_percent)",
			nodeUptimeSeconds: "otelcol_proxmox_node_uptime_seconds",
			nodeCpuPercent: "otelcol_proxmox_node_cpustat_cpu_percent",
			nodeMemoryAvailableVector:
				"otelcol_proxmox_node_memory_memavailable_bytes",
			nodeMemoryUsedVector: "otelcol_proxmox_node_memory_memused_bytes",
			guestCountByNode: "count by (node) (otelcol_proxmox_vm_uptime_seconds)",
			guestMemoryByNode: "sum by (node) (otelcol_proxmox_vm_mem_bytes)",
		} as const;

		const results = Object.fromEntries(
			await Promise.all(
				Object.entries(overviewQueries).map(async ([key, promql]) => [
					key,
					await this.prometheus.query({ query: promql, time, timeout }),
				]),
			),
		) as Record<
			keyof typeof overviewQueries,
			Static<typeof MonitoringQueryResponse>
		>;

		const countsByType = Object.fromEntries(
			this.extractVectorSamples(results.guestTypeCounts).map((sample) => [
				sample.metric.type ?? "unknown",
				sample.value ?? 0,
			]),
		);

		return {
			generatedAt: time ?? new Date().toISOString(),
			summary: {
				nodeCount: this.extractSingleValue(results.nodeCount),
				guestCount: this.extractSingleValue(results.guestCount),
				vmCount: countsByType.qemu ?? countsByType.vm ?? 0,
				lxcCount: countsByType.lxc ?? countsByType.container ?? 0,
				nodeMemoryUsedBytes: this.extractSingleValue(
					results.nodeMemoryUsedBytes,
				),
				nodeMemoryAvailableBytes: this.extractSingleValue(
					results.nodeMemoryAvailableBytes,
				),
				nodeMemoryTotalBytes: this.extractSingleValue(
					results.nodeMemoryTotalBytes,
				),
				guestMemoryUsedBytes: this.extractSingleValue(
					results.guestMemoryUsedBytes,
				),
				guestMemoryCapacityBytes: this.extractSingleValue(
					results.guestMemoryCapacityBytes,
				),
				nodeStorageUsedBytes: this.extractSingleValue(
					results.nodeStorageUsedBytes,
				),
				nodeStorageAvailableBytes: this.extractSingleValue(
					results.nodeStorageAvailableBytes,
				),
				nodeStorageTotalBytes: this.extractSingleValue(
					results.nodeStorageTotalBytes,
				),
				averageNodeCpuPercent: this.extractSingleValue(
					results.averageNodeCpuPercent,
				),
				averageGuestCpuPercent: this.extractSingleValue(
					results.averageGuestCpuPercent,
				),
			},
			countsByType,
			queries: overviewQueries,
			details: {
				guestTypeCounts: results.guestTypeCounts.data.result,
				nodeUptimeSeconds: results.nodeUptimeSeconds.data.result,
				nodeCpuPercent: results.nodeCpuPercent.data.result,
				nodeMemoryAvailableBytes: results.nodeMemoryAvailableVector.data.result,
				nodeMemoryUsedBytes: results.nodeMemoryUsedVector.data.result,
				guestCountByNode: results.guestCountByNode.data.result,
				guestMemoryByNode: results.guestMemoryByNode.data.result,
			},
		};
	}

	private requirePromQl(input: string) {
		const query = input.trim();
		if (!query) {
			throw new ServiceError("A Prometheus query expression is required.", 400);
		}

		return query;
	}

	private normalizeOptionalText(input?: string) {
		const value = input?.trim();
		return value && value.length > 0 ? value : undefined;
	}

	private normalizeOptionalTime(input: string | undefined, fieldName: string) {
		return input ? this.normalizeTime(input, fieldName) : undefined;
	}

	private normalizeTime(input: string, fieldName: string) {
		const value = input.trim();
		if (!value) {
			throw new ServiceError(
				`The monitoring query ${fieldName} parameter is required.`,
				400,
			);
		}

		if (/^\d+(?:\.\d+)?$/.test(value)) {
			return value;
		}

		const parsedDate = new Date(value);
		if (Number.isNaN(parsedDate.getTime())) {
			throw new ServiceError(
				`The monitoring query ${fieldName} parameter must be a valid RFC3339 date or Unix timestamp.`,
				400,
			);
		}

		return parsedDate.toISOString();
	}

	private compareTimes(left: string, right: string) {
		if (/^\d+(?:\.\d+)?$/.test(left) && /^\d+(?:\.\d+)?$/.test(right)) {
			return Number(left) - Number(right);
		}

		return new Date(left).getTime() - new Date(right).getTime();
	}

	private extractSingleValue(
		response: Static<typeof MonitoringQueryResponse>,
	): number | null {
		if (response.data.resultType === "scalar" || response.data.resultType === "string") {
			return this.parseSampleValue(response.data.result);
		}

		if (response.data.resultType === "vector") {
			const [firstItem] = this.extractVectorSamples(response);
			return firstItem?.value ?? null;
		}

		return null;
	}

	private extractVectorSamples(response: Static<typeof MonitoringQueryResponse>) {
		if (response.data.resultType !== "vector" || !Array.isArray(response.data.result)) {
			return [] as Array<{
				metric: Record<string, string>;
				value: number | null;
			}>;
		}

		return response.data.result.map((item) => {
			if (
				typeof item !== "object" ||
				item === null ||
				!("metric" in item) ||
				!("value" in item)
			) {
				return {
					metric: {},
					value: null,
				};
			}

			const metric =
				typeof item.metric === "object" && item.metric !== null
					? (item.metric as Record<string, string>)
					: {};

			return {
				metric,
				value: this.parseSampleValue(item.value),
			};
		});
	}

	private parseSampleValue(value: unknown): number | null {
		if (Array.isArray(value) && value.length >= 2) {
			return this.parseNumber(value[1]);
		}

		return this.parseNumber(value);
	}

	private parseNumber(value: unknown): number | null {
		if (typeof value === "number") {
			return Number.isFinite(value) ? value : null;
		}

		if (typeof value === "string") {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}

		return null;
	}
}
