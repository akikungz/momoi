import { beforeEach, describe, expect, it, mock } from "bun:test";

import { treaty } from "@elysiajs/eden";
import {
	mockAdminAuth,
	mockOtherAuth,
	mockStudentAuth,
} from "@momoi/auth/mock";

import { monitoringRoute } from "@momoi/routes/monitoring";

describe("Monitoring Route", () => {
	const query = mock(async () => ({
		status: "success" as const,
		data: {
			resultType: "vector" as const,
			result: [
				{
					metric: { __name__: "up", instance: "demo:9090" },
					value: [1742870400, "1"],
				},
			],
		},
	}));
	const queryRange = mock(async () => ({
		status: "success" as const,
		data: {
			resultType: "matrix" as const,
			result: [
				{
					metric: { __name__: "up", instance: "demo:9090" },
					values: [[1742870400, "1"]],
				},
			],
		},
	}));

	beforeEach(() => {
		query.mockClear();
		queryRange.mockClear();
	});

	it("should run an instant Prometheus query for admins", async () => {
		const client = treaty(
			monitoringRoute(mockAdminAuth, {
				query,
				queryRange,
			}),
		);

		const response = await client.monitoring.query.get({
			query: {
				query: "up",
				time: "2026-03-25T00:00:00.000Z",
			},
		});

		expect(response.status).toBe(200);
		expect(response.data?.status).toBe("success");
		expect(response.data?.data.resultType).toBe("vector");
		expect(query).toHaveBeenCalledWith({
			query: "up",
			time: "2026-03-25T00:00:00.000Z",
			timeout: undefined,
		});
	});

	it("should run a range Prometheus query for admins", async () => {
		const client = treaty(
			monitoringRoute(mockAdminAuth, {
				query,
				queryRange,
			}),
		);

		const response = await client.monitoring["query-range"].get({
			query: {
				query: "up",
				start: "2026-03-25T00:00:00.000Z",
				end: "2026-03-25T01:00:00.000Z",
				step: "5m",
			},
		});

		expect(response.status).toBe(200);
		expect(response.data?.data.resultType).toBe("matrix");
		expect(queryRange).toHaveBeenCalledWith({
			query: "up",
			start: "2026-03-25T00:00:00.000Z",
			end: "2026-03-25T01:00:00.000Z",
			step: "5m",
			timeout: undefined,
		});
	});

	it("should reject non-admin users", async () => {
		const client = treaty(
			monitoringRoute(mockStudentAuth, {
				query,
				queryRange,
			}),
		);

		const response = await client.monitoring.query.get({
			query: {
				query: "up",
			},
		});

		expect(response.status).toBe(403);
		expect(query).not.toHaveBeenCalled();
	});

	it("should reject unauthenticated users", async () => {
		const client = treaty(
			monitoringRoute(mockOtherAuth, {
				query,
				queryRange,
			}),
		);

		const response = await client.monitoring.query.get({
			query: {
				query: "up",
			},
		});

		expect(response.status).toBe(401);
	});

	it("should return a proxmox overview for admins", async () => {
		const proxmoxQuery = mock(async ({ query: promql }: { query: string }) => {
			if (promql === "count(otelcol_proxmox_node_uptime_seconds)") {
				return {
					status: "success" as const,
					data: { resultType: "vector" as const, result: [{ metric: {}, value: [1, "2"] }] },
				};
			}

			if (promql === "count(otelcol_proxmox_vm_uptime_seconds)") {
				return {
					status: "success" as const,
					data: { resultType: "vector" as const, result: [{ metric: {}, value: [1, "6"] }] },
				};
			}

			if (promql === "count by (type) (otelcol_proxmox_vm_uptime_seconds)") {
				return {
					status: "success" as const,
					data: {
						resultType: "vector" as const,
						result: [
							{ metric: { type: "qemu" }, value: [1, "4"] },
							{ metric: { type: "lxc" }, value: [1, "2"] },
						],
					},
				};
			}

			return {
				status: "success" as const,
				data: { resultType: "vector" as const, result: [{ metric: {}, value: [1, "0"] }] },
			};
		});

		const client = treaty(
			monitoringRoute(mockAdminAuth, {
				query: proxmoxQuery,
				queryRange,
			}),
		);

		const response = await client.monitoring.proxmox.overview.get();

		expect(response.status).toBe(200);
		expect(response.data?.summary.nodeCount).toBe(2);
		expect(response.data?.summary.guestCount).toBe(6);
		expect(response.data?.summary.vmCount).toBe(4);
		expect(response.data?.summary.lxcCount).toBe(2);
		expect(response.data?.countsByType).toEqual({ qemu: 4, lxc: 2 });
	});
});
