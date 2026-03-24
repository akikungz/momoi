import { describe, expect, it } from "bun:test";

import { MonitoringUseCases } from "@momoi/modules/monitoring/application/use-cases";
import { ServiceError } from "@momoi/utils/error";

describe("MonitoringUseCases", () => {
	it("should normalize instant query timestamps", async () => {
		const useCases = new MonitoringUseCases({
			query: async (params) => ({
				status: "success",
				data: {
					resultType: "vector",
					result: params,
				},
			}),
			queryRange: async () => ({
				status: "success",
				data: {
					resultType: "matrix",
					result: [],
				},
			}),
		});

		const response = await useCases.query({
			query: "up",
			time: "2026-03-25T07:00:00+07:00",
			timeout: "30s",
		});

		expect(response.data.result).toEqual({
			query: "up",
			time: "2026-03-25T00:00:00.000Z",
			timeout: "30s",
		});
	});

	it("should reject range queries where start is after end", async () => {
		const useCases = new MonitoringUseCases({
			query: async () => ({
				status: "success",
				data: {
					resultType: "vector",
					result: [],
				},
			}),
			queryRange: async () => ({
				status: "success",
				data: {
					resultType: "matrix",
					result: [],
				},
			}),
		});

		expect(
			useCases.queryRange({
				query: "up",
				start: "2026-03-25T01:00:00.000Z",
				end: "2026-03-25T00:00:00.000Z",
				step: "1m",
			}),
		).rejects.toBeInstanceOf(ServiceError);
	});

	it("should build a proxmox overview from curated otelcol metrics", async () => {
		const useCases = new MonitoringUseCases({
			query: async ({ query }) => {
				const scalar = (value: string) => ({
					status: "success" as const,
					data: {
						resultType: "vector" as const,
						result: [{ metric: {}, value: [1742870400, value] }],
					},
				});

				if (query === "count(otelcol_proxmox_node_uptime_seconds)") {
					return scalar("3");
				}

				if (query === "count(otelcol_proxmox_vm_uptime_seconds)") {
					return scalar("10");
				}

				if (query === "count by (type) (otelcol_proxmox_vm_uptime_seconds)") {
					return {
						status: "success" as const,
						data: {
							resultType: "vector" as const,
							result: [
								{ metric: { type: "qemu" }, value: [1742870400, "7"] },
								{ metric: { type: "lxc" }, value: [1742870400, "3"] },
							],
						},
					};
				}

				if (query === "sum(otelcol_proxmox_node_memory_memavailable_bytes)") {
					return scalar("2147483648");
				}

				if (query === "sum(otelcol_proxmox_node_memory_memtotal_bytes)") {
					return scalar("4294967296");
				}

				return scalar("0");
			},
			queryRange: async () => ({
				status: "success",
				data: {
					resultType: "matrix",
					result: [],
				},
			}),
		});

		const response = await useCases.getProxmoxOverview({
			time: "2026-03-25T00:00:00.000Z",
		});

		expect(response.generatedAt).toBe("2026-03-25T00:00:00.000Z");
		expect(response.summary.nodeCount).toBe(3);
		expect(response.summary.guestCount).toBe(10);
		expect(response.summary.vmCount).toBe(7);
		expect(response.summary.lxcCount).toBe(3);
		expect(response.summary.nodeMemoryAvailableBytes).toBe(2147483648);
		expect(response.summary.nodeMemoryTotalBytes).toBe(4294967296);
		expect(response.countsByType).toEqual({ qemu: 7, lxc: 3 });
		expect(response.queries.nodeCount).toContain("otelcol_proxmox_node_uptime_seconds");
	});
});
