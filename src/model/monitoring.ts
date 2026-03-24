import { Elysia, t } from "elysia";

const PrometheusResultType = t.Union(
	[
		t.Literal("matrix"),
		t.Literal("vector"),
		t.Literal("scalar"),
		t.Literal("string"),
	],
	{ description: "Prometheus result type" },
);

export const MonitoringInstantQueryRequestQuery = t.Object({
	query: t.String({
		description: "PromQL expression to execute as an instant query",
		minLength: 1,
	}),
	time: t.Optional(
		t.String({
			description: "Evaluation timestamp in RFC3339 or Unix timestamp format",
		}),
	),
	timeout: t.Optional(
		t.String({
			description: "Prometheus query timeout duration such as 30s or 1m",
		}),
	),
});

export const MonitoringRangeQueryRequestQuery = t.Object({
	query: t.String({
		description: "PromQL expression to execute as a range query",
		minLength: 1,
	}),
	start: t.String({
		description: "Range start in RFC3339 or Unix timestamp format",
		minLength: 1,
	}),
	end: t.String({
		description: "Range end in RFC3339 or Unix timestamp format",
		minLength: 1,
	}),
	step: t.Optional(
		t.String({
			description: "Query resolution step such as 30s, 1m, or 300",
		}),
	),
	timeout: t.Optional(
		t.String({
			description: "Prometheus query timeout duration such as 30s or 1m",
		}),
	),
});

export const MonitoringProxmoxOverviewRequestQuery = t.Object({
	time: t.Optional(
		t.String({
			description: "Evaluation timestamp in RFC3339 or Unix timestamp format",
		}),
	),
	timeout: t.Optional(
		t.String({
			description: "Prometheus query timeout duration such as 30s or 1m",
		}),
	),
});

export const MonitoringQueryResponse = t.Object({
	status: t.Literal("success"),
	data: t.Object({
		resultType: PrometheusResultType,
		result: t.Any({
			description: "Raw Prometheus query result payload",
		}),
	}),
	warnings: t.Optional(
		t.Array(t.String(), {
			description: "Prometheus warnings for the executed query",
		}),
	),
	infos: t.Optional(
		t.Array(t.String(), {
			description: "Prometheus informational messages for the executed query",
		}),
	),
});

const NullableNumber = t.Union([t.Number(), t.Null()]);

export const MonitoringProxmoxOverviewResponse = t.Object({
	generatedAt: t.String({
		description: "Timestamp used for the Prometheus instant queries",
	}),
	summary: t.Object({
		nodeCount: NullableNumber,
		guestCount: NullableNumber,
		vmCount: NullableNumber,
		lxcCount: NullableNumber,
		nodeMemoryUsedBytes: NullableNumber,
		nodeMemoryAvailableBytes: NullableNumber,
		nodeMemoryTotalBytes: NullableNumber,
		guestMemoryUsedBytes: NullableNumber,
		guestMemoryCapacityBytes: NullableNumber,
		nodeStorageUsedBytes: NullableNumber,
		nodeStorageAvailableBytes: NullableNumber,
		nodeStorageTotalBytes: NullableNumber,
		averageNodeCpuPercent: NullableNumber,
		averageGuestCpuPercent: NullableNumber,
	}),
	countsByType: t.Record(
		t.String(),
		t.Number({
			description: "Count of guests grouped by Prometheus type label",
		}),
	),
	queries: t.Record(
		t.String(),
		t.String({
			description: "PromQL used for each aggregated field",
		}),
	),
	details: t.Record(
		t.String(),
		t.Any({
			description: "Raw vector results for per-node or per-type inspection",
		}),
	),
});

export const monitoringModel = new Elysia({ name: "monitoring.model" })
	.model(
		"MonitoringInstantQueryRequestQuery",
		MonitoringInstantQueryRequestQuery,
	)
	.model("MonitoringRangeQueryRequestQuery", MonitoringRangeQueryRequestQuery)
	.model(
		"MonitoringProxmoxOverviewRequestQuery",
		MonitoringProxmoxOverviewRequestQuery,
	)
	.model("MonitoringQueryResponse", MonitoringQueryResponse)
	.model(
		"MonitoringProxmoxOverviewResponse",
		MonitoringProxmoxOverviewResponse,
	);
