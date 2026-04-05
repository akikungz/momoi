import { DiagLogLevel, type Attributes, metrics, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter as OTLPHttpLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPMetricExporter as OTLPHttpMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter as OTLPHttpTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import {
	getCurrentSpan,
	opentelemetry,
	record,
	setAttributes,
} from "@elysiajs/opentelemetry";
import { Metadata } from "@grpc/grpc-js";
import { createRequire } from "node:module";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { env } from "@momoi/env";

type TelemetryAttributes = Attributes;
type MetricPoint = {
	attributes: TelemetryAttributes;
	value: number;
};
type MetricPointMap = Map<string, MetricPoint>;
type DurationSamplePoint = {
	attributes: TelemetryAttributes;
	values: number[];
};
type DurationSampleMap = Map<string, DurationSamplePoint>;
type CounterLike = {
	add: (value: number, attributes?: TelemetryAttributes) => void;
};
type HistogramLike = {
	record: (value: number, attributes?: TelemetryAttributes) => void;
};

type OTelCoreCompatibility = {
	baggageUtils?: {
		parseKeyPairsIntoRecord?: (value?: string) => Record<string, string>;
		parsePairKeyValue?: (value: string) => [string, string] | undefined;
	};
	parseKeyPairsIntoRecord?: (value?: string) => Record<string, string>;
	parsePairKeyValue?: (value: string) => [string, string] | undefined;
	getStringFromEnv?: (key: string) => string | undefined;
	getStringListFromEnv?: (key: string) => string[];
	getBooleanFromEnv?: (key: string) => boolean | undefined;
	getNumberFromEnv?: (key: string) => number | undefined;
	diagLogLevelFromString?: (value?: string) => DiagLogLevel | undefined;
};

const require = createRequire(import.meta.url);

const patchOpenTelemetryCoreCompatibility = () => {
	const compatibility = require("@opentelemetry/core") as OTelCoreCompatibility;

	// Bun currently resolves this package shape without promoting these helpers
	// to the top-level CJS export, but the OTLP exporters expect them there.
	if (
		compatibility.parseKeyPairsIntoRecord === undefined &&
		compatibility.baggageUtils?.parseKeyPairsIntoRecord
	) {
		Object.defineProperty(compatibility, "parseKeyPairsIntoRecord", {
			value: compatibility.baggageUtils.parseKeyPairsIntoRecord,
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	if (
		compatibility.parsePairKeyValue === undefined &&
		compatibility.baggageUtils?.parsePairKeyValue
	) {
		Object.defineProperty(compatibility, "parsePairKeyValue", {
			value: compatibility.baggageUtils.parsePairKeyValue,
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	if (compatibility.getStringFromEnv === undefined) {
		Object.defineProperty(compatibility, "getStringFromEnv", {
			value: (key: string) => {
				const value = process.env[key];
				if (value == null) {
					return undefined;
				}

				const normalized = value.trim();
				return normalized.length > 0 ? normalized : undefined;
			},
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	if (compatibility.getBooleanFromEnv === undefined) {
		Object.defineProperty(compatibility, "getBooleanFromEnv", {
			value: (key: string) => {
				const value = compatibility.getStringFromEnv?.(key);
				return value === undefined ? undefined : value.toLowerCase() === "true";
			},
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	if (compatibility.getNumberFromEnv === undefined) {
		Object.defineProperty(compatibility, "getNumberFromEnv", {
			value: (key: string) => {
				const value = compatibility.getStringFromEnv?.(key);
				if (value === undefined) {
					return undefined;
				}

				const parsed = Number(value);
				return Number.isNaN(parsed) ? undefined : parsed;
			},
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	if (compatibility.getStringListFromEnv === undefined) {
		Object.defineProperty(compatibility, "getStringListFromEnv", {
			value: (key: string) => {
				const value = compatibility.getStringFromEnv?.(key);
				return value === undefined
					? []
					: value
							.split(",")
							.map((item) => item.trim())
							.filter((item) => item.length > 0);
			},
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}

	if (compatibility.diagLogLevelFromString === undefined) {
		Object.defineProperty(compatibility, "diagLogLevelFromString", {
			value: (value?: string) => {
				if (!value) {
					return undefined;
				}

				const logLevels: Record<string, DiagLogLevel> = {
					all: DiagLogLevel.ALL,
					verbose: DiagLogLevel.VERBOSE,
					debug: DiagLogLevel.DEBUG,
					info: DiagLogLevel.INFO,
					warn: DiagLogLevel.WARN,
					error: DiagLogLevel.ERROR,
					none: DiagLogLevel.NONE,
				};

				return logLevels[value.toLowerCase()];
			},
			configurable: true,
			enumerable: true,
			writable: true,
		});
	}
};

patchOpenTelemetryCoreCompatibility();

const minimumSeverityByLogLevel = {
	debug: SeverityNumber.DEBUG,
	info: SeverityNumber.INFO,
	warn: SeverityNumber.WARN,
	error: SeverityNumber.ERROR,
} as const;

const basicAuthHeader =
	env.OTEL_EXPORTER_OTLP_USERNAME && env.OTEL_EXPORTER_OTLP_PASSWORD
		? `Basic ${Buffer.from(
				`${env.OTEL_EXPORTER_OTLP_USERNAME}:${env.OTEL_EXPORTER_OTLP_PASSWORD}`,
			).toString("base64")}`
		: undefined;

const createOtlpMetadata = () => {
	if (!basicAuthHeader) {
		return undefined;
	}

	const metadata = new Metadata();
	metadata.set("authorization", basicAuthHeader);

	return metadata;
};

const createOtlpHeaders = () =>
	basicAuthHeader ? { authorization: basicAuthHeader } : undefined;

const otlpMetadata = createOtlpMetadata();
const otlpHeaders = createOtlpHeaders();

const createTraceExporter = () => {
	if (env.OTEL_EXPORTER_OTLP_PROTOCOL === "http") {
		return new OTLPHttpTraceExporter({
			url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
			headers: otlpHeaders,
		});
	}

	return new OTLPTraceExporter({
		url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
		metadata: otlpMetadata,
	});
};

const createMetricExporter = () => {
	if (env.OTEL_EXPORTER_OTLP_PROTOCOL === "http") {
		return new OTLPHttpMetricExporter({
			url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
			headers: otlpHeaders,
		});
	}

	return new OTLPMetricExporter({
		url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
		metadata: otlpMetadata,
	});
};

const createLogExporter = () => {
	if (env.OTEL_EXPORTER_OTLP_PROTOCOL === "http") {
		return new OTLPHttpLogExporter({
			url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
			headers: otlpHeaders,
		});
	}

	return new OTLPLogExporter({
		url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
		metadata: otlpMetadata,
	});
};

const sdk = new NodeSDK({
	serviceName: env.OTEL_SERVICE_NAME,
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
		"deployment.environment": env.NODE_ENV,
	}),
	spanProcessors: [new BatchSpanProcessor(createTraceExporter())],
	metricReaders: [
		new PeriodicExportingMetricReader({
			exporter: createMetricExporter(),
			exportIntervalMillis: env.OTEL_METRIC_EXPORT_INTERVAL,
			exportTimeoutMillis: env.OTEL_METRIC_EXPORT_TIMEOUT,
		}),
	],
	logRecordProcessors: [new BatchLogRecordProcessor(createLogExporter())],
	instrumentations: [new PgInstrumentation(), new IORedisInstrumentation()],
});

const minimumSeverityNumber = minimumSeverityByLogLevel[env.LOG_LEVEL];

let telemetryStarted = false;
let telemetryShutdownPromise: Promise<void> | null = null;
let telemetryDisabled = false;
let telemetryDisableNoticeShown = false;
let runtimeMetricsRegistered = false;
const processStartedAtSeconds = Math.floor(Date.now() / 1000);

const dependencyAvailability = {
	cache: env.REDIS_URL ? 1 : 0,
	queue: env.REDIS_URL ? 1 : 0,
} as Record<string, number>;
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });

const TELEMETRY_AUTH_FAILURE_PATTERNS = [
	"WRONGPASS invalid username-password pair or user is disabled.",
	"invalid username-password pair or user is disabled",
	"wrongpass",
] as const;

const getMeter = () => metrics.getMeter(env.OTEL_SERVICE_NAME);
const getLogger = () => logs.getLogger(env.OTEL_SERVICE_NAME);
const metricInstrumentCache = new Map<string, unknown>();
const customMetricState = {
	httpRequestCount: new Map<string, MetricPoint>(),
	httpRequestDuration: new Map<string, MetricPoint>(),
	httpActiveRequests: new Map<string, MetricPoint>(),
	httpRequestErrors: new Map<string, MetricPoint>(),
	httpRequestByStatusClass: new Map<string, MetricPoint>(),
	httpRequestDurationSamples: new Map<string, DurationSamplePoint>(),
	instanceOperations: new Map<string, MetricPoint>(),
	requestOperations: new Map<string, MetricPoint>(),
	queueJobsEnqueued: new Map<string, MetricPoint>(),
	storageOperations: new Map<string, MetricPoint>(),
	storageDownloadUrlCache: new Map<string, MetricPoint>(),
	storageBytes: new Map<string, MetricPoint>(),
};
const HTTP_DURATION_SAMPLE_LIMIT = 256;
const defaultHttpCompletedAttributes = {
	"http.request.method": "GET",
	"url.path": "/api",
	"http.response.status_code": 200,
	"otel.status_code": "OK",
} satisfies TelemetryAttributes;
const defaultHttpActiveAttributes = {
	"http.request.method": "GET",
	"url.path": "/api",
} satisfies TelemetryAttributes;

const getOrCreateInstrument = <T>(name: string, factory: () => T): T => {
	const cached = metricInstrumentCache.get(name);
	if (cached) {
		return cached as T;
	}

	const created = factory();
	metricInstrumentCache.set(name, created);
	return created;
};

const normalizeAttributes = (attributes: TelemetryAttributes = {}) =>
	Object.fromEntries(
		Object.entries(attributes).sort(([left], [right]) =>
			left.localeCompare(right),
		),
	);

const getMetricPointKey = (attributes: TelemetryAttributes = {}) =>
	JSON.stringify(normalizeAttributes(attributes));

const addMetricPoint = (
	state: MetricPointMap,
	value: number,
	attributes: TelemetryAttributes = {},
) => {
	const normalizedAttributes = normalizeAttributes(attributes);
	const key = getMetricPointKey(normalizedAttributes);
	const existing = state.get(key);

	state.set(key, {
		attributes: normalizedAttributes,
		value: (existing?.value ?? 0) + value,
	});
};

const createAccumulatingCounter = (state: MetricPointMap): CounterLike => ({
	add(value, attributes = {}) {
		addMetricPoint(state, value, attributes);
	},
});

const createAccumulatingHistogram = (state: MetricPointMap): HistogramLike => ({
	record(value, attributes = {}) {
		addMetricPoint(state, value, attributes);
	},
});

const recordDurationSample = (
	state: DurationSampleMap,
	value: number,
	attributes: TelemetryAttributes = {},
) => {
	const normalizedAttributes = normalizeAttributes(attributes);
	const key = getMetricPointKey(normalizedAttributes);
	const existing = state.get(key);

	if (!existing) {
		state.set(key, {
			attributes: normalizedAttributes,
			values: [value],
		});
		return;
	}

	if (existing.values.length >= HTTP_DURATION_SAMPLE_LIMIT) {
		existing.values.shift();
	}

	existing.values.push(value);
};

const observeMetricPoints = (
	result: {
		observe: (value: number, attributes?: TelemetryAttributes) => void;
	},
	state: MetricPointMap,
) => {
	for (const point of state.values()) {
		result.observe(point.value, point.attributes);
	}
};

const observeDurationPercentiles = (
	result: {
		observe: (value: number, attributes?: TelemetryAttributes) => void;
	},
	state: DurationSampleMap,
	percentile: number,
) => {
	for (const point of state.values()) {
		const values = [...point.values].sort((left, right) => left - right);
		if (values.length === 0) {
			result.observe(0, point.attributes);
			continue;
		}

		const index = Math.min(
			values.length - 1,
			Math.max(0, Math.ceil(percentile * values.length) - 1),
		);
		result.observe(Number(values[index].toFixed(3)), point.attributes);
	}
};

const getStatusClass = (statusCode: number) =>
	`${Math.max(1, Math.min(5, Math.floor(statusCode / 100)))}xx`;

const getHttpAggregateAttributes = (
	attributes: TelemetryAttributes = {},
	statusCode?: number,
) => ({
	"http.request.method": String(attributes["http.request.method"] ?? "UNKNOWN"),
	"url.path": String(attributes["url.path"] ?? "/"),
	...(typeof statusCode === "number"
		? { "http.response.status_class": getStatusClass(statusCode) }
		: {}),
});

const seedDefaultMetricPoints = () => {
	if (customMetricState.httpRequestCount.size === 0) {
		addMetricPoint(
			customMetricState.httpRequestCount,
			0,
			defaultHttpCompletedAttributes,
		);
	}

	if (customMetricState.httpRequestDuration.size === 0) {
		addMetricPoint(
			customMetricState.httpRequestDuration,
			0,
			defaultHttpCompletedAttributes,
		);
	}

	if (customMetricState.httpActiveRequests.size === 0) {
		addMetricPoint(
			customMetricState.httpActiveRequests,
			0,
			defaultHttpActiveAttributes,
		);
	}

	if (customMetricState.httpRequestErrors.size === 0) {
		addMetricPoint(customMetricState.httpRequestErrors, 0, {
			"http.request.method": "GET",
			"url.path": "/api",
			"http.response.status_class": "5xx",
		});
	}

	if (customMetricState.httpRequestByStatusClass.size === 0) {
		addMetricPoint(customMetricState.httpRequestByStatusClass, 0, {
			"http.request.method": "GET",
			"url.path": "/api",
			"http.response.status_class": "2xx",
		});
	}

	if (customMetricState.httpRequestDurationSamples.size === 0) {
		recordDurationSample(customMetricState.httpRequestDurationSamples, 0, {
			"http.request.method": "GET",
			"url.path": "/api",
		});
	}
};

type ProcessWithInternals = NodeJS.Process & {
	_getActiveHandles?: () => unknown[];
	_getActiveRequests?: () => unknown[];
};

const processWithInternals = process as ProcessWithInternals;

export const createTelemetryPlugin = () =>
	opentelemetry({
		serviceName: env.OTEL_SERVICE_NAME,
	});

export const telemetryInfo = {
	protocol:
		env.OTEL_EXPORTER_OTLP_PROTOCOL === "http" ? "otlp/http" : "otlp/grpc",
	endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
	hasAuthentication: Boolean(basicAuthHeader),
} as const;

export const httpMetrics = {
	get requestCounter() {
		return getOrCreateInstrument("http.server.request.count", () =>
			createAccumulatingCounter(customMetricState.httpRequestCount),
		);
	},
	get requestDuration() {
		return getOrCreateInstrument("http.server.request.duration", () =>
			createAccumulatingHistogram(customMetricState.httpRequestDuration),
		);
	},
	get activeRequests() {
		return getOrCreateInstrument("http.server.active_requests", () =>
			createAccumulatingCounter(customMetricState.httpActiveRequests),
		);
	},
	recordResult(
		durationMs: number,
		statusCode: number,
		attributes: TelemetryAttributes = {},
	) {
		const durationAttributes = {
			...attributes,
			"http.response.status_code": statusCode,
			"otel.status_code": statusCode >= 500 ? "ERROR" : "OK",
		};

		this.requestCounter.add(1, durationAttributes);
		this.requestDuration.record(durationMs, durationAttributes);

		const aggregateAttributes = getHttpAggregateAttributes(
			attributes,
			statusCode,
		);
		addMetricPoint(
			customMetricState.httpRequestByStatusClass,
			1,
			aggregateAttributes,
		);
		recordDurationSample(
			customMetricState.httpRequestDurationSamples,
			durationMs,
			getHttpAggregateAttributes(attributes),
		);

		if (statusCode >= 400) {
			addMetricPoint(
				customMetricState.httpRequestErrors,
				1,
				aggregateAttributes,
			);
		}
	},
};

export const applicationMetrics = {
	get instanceOperations() {
		return getOrCreateInstrument("app.instance.operation.count", () =>
			createAccumulatingCounter(customMetricState.instanceOperations),
		);
	},
	get requestOperations() {
		return getOrCreateInstrument("app.request.operation.count", () =>
			createAccumulatingCounter(customMetricState.requestOperations),
		);
	},
	get queueJobsEnqueued() {
		return getOrCreateInstrument("app.queue.job.enqueue.count", () =>
			createAccumulatingCounter(customMetricState.queueJobsEnqueued),
		);
	},
	get storageOperations() {
		return getOrCreateInstrument("app.storage.operation.count", () =>
			createAccumulatingCounter(customMetricState.storageOperations),
		);
	},
	get storageDownloadUrlCache() {
		return getOrCreateInstrument("app.storage.download_url.cache.count", () =>
			createAccumulatingCounter(customMetricState.storageDownloadUrlCache),
		);
	},
	get storageBytes() {
		return getOrCreateInstrument("app.storage.bytes", () =>
			createAccumulatingHistogram(customMetricState.storageBytes),
		);
	},
	get processResidentMemory() {
		return getOrCreateInstrument("app.runtime.process.resident_memory", () =>
			getMeter().createObservableGauge("app.runtime.process.resident_memory", {
				description: "Resident memory used by the Node.js process",
				unit: "By",
			}),
		);
	},
	get processHeapUsed() {
		return getOrCreateInstrument("app.runtime.process.heap_used", () =>
			getMeter().createObservableGauge("app.runtime.process.heap_used", {
				description: "Heap memory currently used by the Node.js process",
				unit: "By",
			}),
		);
	},
	get processHeapTotal() {
		return getOrCreateInstrument("app.runtime.process.heap_total", () =>
			getMeter().createObservableGauge("app.runtime.process.heap_total", {
				description: "Total heap memory allocated for the Node.js process",
				unit: "By",
			}),
		);
	},
	get processUptime() {
		return getOrCreateInstrument("app.runtime.process.uptime", () =>
			getMeter().createObservableGauge("app.runtime.process.uptime", {
				description: "Process uptime in seconds",
				unit: "s",
			}),
		);
	},
	get eventLoopLag() {
		return getOrCreateInstrument("app.runtime.event_loop.lag", () =>
			getMeter().createObservableGauge("app.runtime.event_loop.lag", {
				description: "Mean event loop lag observed by the Node.js runtime",
				unit: "ms",
			}),
		);
	},
	get activeHandles() {
		return getOrCreateInstrument("app.runtime.node.active_handles", () =>
			getMeter().createObservableGauge("app.runtime.node.active_handles", {
				description: "Number of active handles held by the Node.js process",
			}),
		);
	},
	get activeRequests() {
		return getOrCreateInstrument("app.runtime.node.active_requests", () =>
			getMeter().createObservableGauge("app.runtime.node.active_requests", {
				description:
					"Number of active internal requests held by the Node.js process",
			}),
		);
	},
	get dependencyAvailability() {
		return getOrCreateInstrument("app.runtime.dependency.available", () =>
			getMeter().createObservableGauge("app.runtime.dependency.available", {
				description:
					"Availability of key app dependencies, reported as 1 for available and 0 for unavailable",
			}),
		);
	},
	get processStartTime() {
		return getOrCreateInstrument("app.runtime.process.start_time", () =>
			getMeter().createObservableGauge("app.runtime.process.start_time", {
				description: "Unix timestamp when the app process started",
				unit: "s",
			}),
		);
	},
	get heartbeatTime() {
		return getOrCreateInstrument("app.runtime.heartbeat_time", () =>
			getMeter().createObservableGauge("app.runtime.heartbeat_time", {
				description:
					"Current Unix timestamp emitted by the app telemetry heartbeat",
				unit: "s",
			}),
		);
	},
	get configInfo() {
		return getOrCreateInstrument("app.config.info", () =>
			getMeter().createObservableGauge("app.config.info", {
				description:
					"Static app configuration info exported as a marker metric",
			}),
		);
	},
	get telemetryExportInterval() {
		return getOrCreateInstrument("app.telemetry.export.interval", () =>
			getMeter().createObservableGauge("app.telemetry.export.interval", {
				description: "Configured OTEL metric export interval",
				unit: "ms",
			}),
		);
	},
	get dependencyConfigured() {
		return getOrCreateInstrument("app.dependency.configured", () =>
			getMeter().createObservableGauge("app.dependency.configured", {
				description:
					"Whether an app dependency is configured, reported as 1 for configured and 0 for not configured",
			}),
		);
	},
};

const registerRuntimeMetrics = () => {
	if (runtimeMetricsRegistered) {
		return;
	}

	eventLoopDelay.enable();
	seedDefaultMetricPoints();

	applicationMetrics.processResidentMemory.addCallback((result) => {
		result.observe(process.memoryUsage().rss);
	});

	applicationMetrics.processHeapUsed.addCallback((result) => {
		result.observe(process.memoryUsage().heapUsed);
	});

	applicationMetrics.processHeapTotal.addCallback((result) => {
		result.observe(process.memoryUsage().heapTotal);
	});

	applicationMetrics.processUptime.addCallback((result) => {
		result.observe(process.uptime());
	});

	applicationMetrics.eventLoopLag.addCallback((result) => {
		result.observe(Number((eventLoopDelay.mean / 1_000_000).toFixed(3)));
	});

	applicationMetrics.activeHandles.addCallback((result) => {
		result.observe(
			typeof processWithInternals._getActiveHandles === "function"
				? processWithInternals._getActiveHandles().length
				: 0,
		);
	});

	applicationMetrics.activeRequests.addCallback((result) => {
		result.observe(
			typeof processWithInternals._getActiveRequests === "function"
				? processWithInternals._getActiveRequests().length
				: 0,
		);
	});

	applicationMetrics.dependencyAvailability.addCallback((result) => {
		for (const [dependency, available] of Object.entries(
			dependencyAvailability,
		)) {
			result.observe(available, {
				"dependency.name": dependency,
			});
		}
	});

	applicationMetrics.processStartTime.addCallback((result) => {
		result.observe(processStartedAtSeconds);
	});

	applicationMetrics.heartbeatTime.addCallback((result) => {
		result.observe(Math.floor(Date.now() / 1000));
	});

	applicationMetrics.configInfo.addCallback((result) => {
		result.observe(1, {
			"app.node_env": env.NODE_ENV,
			"app.storage_provider": env.STORAGE_PROVIDER,
			"telemetry.protocol": env.OTEL_EXPORTER_OTLP_PROTOCOL,
			"telemetry.fail_open": String(env.OTEL_FAIL_OPEN),
		});
	});

	applicationMetrics.telemetryExportInterval.addCallback((result) => {
		result.observe(env.OTEL_METRIC_EXPORT_INTERVAL);
	});

	applicationMetrics.dependencyConfigured.addCallback((result) => {
		result.observe(1, {
			"dependency.name": "database",
			"dependency.type": "postgresql",
		});
		result.observe(env.REDIS_URL ? 1 : 0, {
			"dependency.name": "cache",
			"dependency.type": "redis",
		});
		result.observe(env.REDIS_URL ? 1 : 0, {
			"dependency.name": "queue",
			"dependency.type": "redis",
		});
		result.observe(env.STORAGE_PROVIDER === "s3" ? 1 : 0, {
			"dependency.name": "object_storage",
			"dependency.type": env.STORAGE_PROVIDER,
		});
	});

	getMeter()
		.createObservableGauge("http.server.request.count", {
			description: "Total number of HTTP requests handled by the app",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.httpRequestCount),
		);

	getMeter()
		.createObservableGauge("http.server.request.duration", {
			description: "Cumulative HTTP request duration recorded by the app",
			unit: "ms",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.httpRequestDuration),
		);

	getMeter()
		.createObservableGauge("http.server.request.errors", {
			description:
				"Total number of HTTP requests that completed with an error status",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.httpRequestErrors),
		);

	getMeter()
		.createObservableGauge("http.server.request.by_status_class", {
			description: "Total number of HTTP requests by status class",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.httpRequestByStatusClass),
		);

	getMeter()
		.createObservableGauge("http.server.request.duration.p50", {
			description: "Rolling p50 HTTP request duration",
			unit: "ms",
		})
		.addCallback((result) =>
			observeDurationPercentiles(
				result,
				customMetricState.httpRequestDurationSamples,
				0.5,
			),
		);

	getMeter()
		.createObservableGauge("http.server.request.duration.p95", {
			description: "Rolling p95 HTTP request duration",
			unit: "ms",
		})
		.addCallback((result) =>
			observeDurationPercentiles(
				result,
				customMetricState.httpRequestDurationSamples,
				0.95,
			),
		);

	getMeter()
		.createObservableGauge("http.server.request.duration.p99", {
			description: "Rolling p99 HTTP request duration",
			unit: "ms",
		})
		.addCallback((result) =>
			observeDurationPercentiles(
				result,
				customMetricState.httpRequestDurationSamples,
				0.99,
			),
		);

	getMeter()
		.createObservableGauge("http.server.active_requests", {
			description: "Current number of in-flight HTTP requests",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.httpActiveRequests),
		);

	getMeter()
		.createObservableGauge("app.instance.operation.count", {
			description: "Total instance lifecycle operations executed by the app",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.instanceOperations),
		);

	getMeter()
		.createObservableGauge("app.request.operation.count", {
			description: "Total request workflow operations executed by the app",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.requestOperations),
		);

	getMeter()
		.createObservableGauge("app.queue.job.enqueue.count", {
			description: "Total queue jobs enqueued by the app",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.queueJobsEnqueued),
		);

	getMeter()
		.createObservableGauge("app.storage.operation.count", {
			description: "Total storage operations executed by the app",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.storageOperations),
		);

	getMeter()
		.createObservableGauge("app.storage.download_url.cache.count", {
			description: "Total storage download URL cache hits and misses",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.storageDownloadUrlCache),
		);

	getMeter()
		.createObservableGauge("app.storage.bytes", {
			description: "Cumulative storage payload bytes handled by the app",
			unit: "By",
		})
		.addCallback((result) =>
			observeMetricPoints(result, customMetricState.storageBytes),
		);

	runtimeMetricsRegistered = true;
};

const getErrorMessage = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}

	return typeof error === "string" ? error : JSON.stringify(error);
};

const isTelemetryAuthError = (error: unknown) => {
	const message = getErrorMessage(error).toLowerCase();
	return TELEMETRY_AUTH_FAILURE_PATTERNS.some((pattern) =>
		message.includes(pattern.toLowerCase()),
	);
};

const disableTelemetry = async (reason: string, error?: unknown) => {
	if (telemetryDisabled) {
		return;
	}

	telemetryDisabled = true;

	if (!telemetryDisableNoticeShown) {
		telemetryDisableNoticeShown = true;
		console.warn("Telemetry disabled; continuing without OTLP export.", {
			reason,
			error: error ? getErrorDetails(error) : undefined,
		});
	}

	if (!telemetryStarted) {
		return;
	}

	try {
		await sdk.shutdown();
	} catch {
		// Ignore exporter shutdown failures once telemetry has been tripped open.
	} finally {
		telemetryStarted = false;
		telemetryShutdownPromise = null;
	}
};

export const handleTelemetryRuntimeError = async (error: unknown) => {
	if (!env.OTEL_FAIL_OPEN) {
		return false;
	}

	if (!isTelemetryAuthError(error)) {
		return false;
	}

	await disableTelemetry("otlp_auth_failed", error);
	return true;
};

export const startTelemetry = async () => {
	if (telemetryStarted || telemetryDisabled) {
		return;
	}

	try {
		sdk.start();
		registerRuntimeMetrics();
		telemetryStarted = true;
	} catch (error) {
		if (env.OTEL_FAIL_OPEN) {
			await disableTelemetry("telemetry_start_failed", error);
			return;
		}

		throw error;
	}
};

export const shutdownTelemetry = async () => {
	if (!telemetryStarted || telemetryDisabled) {
		return;
	}

	telemetryShutdownPromise ??= sdk.shutdown().finally(() => {
		telemetryStarted = false;
		telemetryShutdownPromise = null;
	});

	await telemetryShutdownPromise;
};

export const getErrorDetails = (error: unknown) => {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
			stack: error.stack,
		};
	}

	return {
		message: typeof error === "string" ? error : "Unknown error",
		name: "Error",
		stack: undefined,
	};
};

export const emitLog = (
	severityNumber: SeverityNumber,
	severityText: string,
	body: string,
	attributes: TelemetryAttributes = {},
) => {
	if (severityNumber < minimumSeverityNumber || telemetryDisabled) {
		return;
	}

	const spanContext = trace.getActiveSpan()?.spanContext();
	try {
		getLogger().emit({
			severityNumber,
			severityText,
			body,
			attributes: {
				"service.name": env.OTEL_SERVICE_NAME,
				...attributes,
				...(spanContext
					? {
							"trace.id": spanContext.traceId,
							"span.id": spanContext.spanId,
							"trace.flags": spanContext.traceFlags,
						}
					: {}),
			},
		});
	} catch (error) {
		void handleTelemetryRuntimeError(error);
	}
};

export const getCurrentTraceId = () =>
	getCurrentSpan()?.spanContext().traceId ?? null;

export const recordInstanceOperation = (
	operation: string,
	attributes: TelemetryAttributes = {},
) => {
	applicationMetrics.instanceOperations.add(1, {
		"app.domain": "instance",
		"app.operation": operation,
		...attributes,
	});
};

export const recordRequestOperation = (
	operation: string,
	attributes: TelemetryAttributes = {},
) => {
	applicationMetrics.requestOperations.add(1, {
		"app.domain": "request",
		"app.operation": operation,
		...attributes,
	});
};

export const recordQueueJobEnqueued = (
	queueName: string,
	jobName: string,
	attributes: TelemetryAttributes = {},
) => {
	applicationMetrics.queueJobsEnqueued.add(1, {
		"queue.name": queueName,
		"queue.job.name": jobName,
		...attributes,
	});
};

export const recordStorageOperation = (
	operation: string,
	attributes: TelemetryAttributes = {},
) => {
	applicationMetrics.storageOperations.add(1, {
		"app.domain": "storage",
		"app.operation": operation,
		...attributes,
	});
};

export const recordStorageDownloadUrlCacheResult = (
	result: "hit" | "miss",
	attributes: TelemetryAttributes = {},
) => {
	applicationMetrics.storageDownloadUrlCache.add(1, {
		"cache.name": "storage.download_url",
		"cache.result": result,
		...attributes,
	});
};

export const recordStorageBytes = (
	bytes: number,
	attributes: TelemetryAttributes = {},
) => {
	applicationMetrics.storageBytes.record(bytes, attributes);
};

export const setDependencyAvailability = (
	dependency: "cache" | "queue",
	available: boolean,
) => {
	dependencyAvailability[dependency] = available ? 1 : 0;
};

export const recordSpan: typeof record = record;
export const setSpanAttributes: typeof setAttributes = setAttributes;
export { SeverityNumber };
