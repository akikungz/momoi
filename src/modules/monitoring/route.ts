import { Elysia } from "elysia";

import type { AuthMacro } from "@momoi/auth";
import { ErrorResponse } from "@momoi/model/shared/error";
import { monitoringModel } from "@momoi/model/monitoring";

import { createMonitoringUseCases } from ".";
import type { PrometheusQueryPort } from "./application/ports";

export const monitoringRoute = (
	auth: AuthMacro,
	queryPort?: PrometheusQueryPort,
) => {
	const monitoringUseCases = createMonitoringUseCases(queryPort);

	return new Elysia({ name: "monitoring.route", prefix: "/monitoring" })
		.use(auth)
		.use(monitoringModel)
		.guard({ auth: true })
		.get(
			"/query",
			async ({ query }) => monitoringUseCases.query(query),
			{
				query: "MonitoringInstantQueryRequestQuery",
				response: {
					200: "MonitoringQueryResponse",
					400: ErrorResponse,
					403: ErrorResponse,
					502: ErrorResponse,
					503: ErrorResponse,
					504: ErrorResponse,
				},
				detail: {
					summary: "Run an instant Prometheus query",
					description:
						"Executes a PromQL instant query against the configured Prometheus API.",
					tags: ["Monitoring"],
					hidden: true, // This endpoint is primarily for internal use and may be subject to change, so we hide it from the public API documentation.
				},
			},
		)
		.get(
			"/query-range",
			async ({ query }) => monitoringUseCases.queryRange(query),
			{
				query: "MonitoringRangeQueryRequestQuery",
				response: {
					200: "MonitoringQueryResponse",
					400: ErrorResponse,
					403: ErrorResponse,
					502: ErrorResponse,
					503: ErrorResponse,
					504: ErrorResponse,
				},
				detail: {
					summary: "Run a range Prometheus query",
					description:
						"Executes a PromQL range query against the configured Prometheus API.",
					tags: ["Monitoring"],
					hidden: true, // This endpoint is primarily for internal use and may be subject to change, so we hide it from the public API documentation.
				},
			},
		)
		.get(
			"/proxmox/overview",
			async ({ query }) => monitoringUseCases.getProxmoxOverview(query),
			{
				query: "MonitoringProxmoxOverviewRequestQuery",
				response: {
					200: "MonitoringProxmoxOverviewResponse",
					400: ErrorResponse,
					403: ErrorResponse,
					502: ErrorResponse,
					503: ErrorResponse,
					504: ErrorResponse,
				},
				detail: {
					summary: "Get a Proxmox monitoring overview",
					description:
						"Returns a curated Proxmox cluster summary built from the otelcol_proxmox_node_* and otelcol_proxmox_vm_* metrics available in Prometheus.",
					tags: ["Monitoring"],
				},
			},
		);
};
