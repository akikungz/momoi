import { env } from "@momoi/env";
import { ServiceError } from "@momoi/utils/error";

import type {
	PrometheusInstantQueryParams,
	PrometheusQueryPort,
	PrometheusQueryResponse,
	PrometheusRangeQueryParams,
} from "../application/ports";

interface PrometheusMonitoringConfig {
	baseUrl?: string;
	timeoutMs: number;
	bearerToken?: string;
	username?: string;
	password?: string;
}

interface PrometheusEnvelope {
	status: string;
	data?: PrometheusQueryResponse["data"];
	errorType?: string;
	error?: string;
	warnings?: string[];
	infos?: string[];
}

export class PrometheusMonitoringClient implements PrometheusQueryPort {
	constructor(
		private readonly config: PrometheusMonitoringConfig = {
			baseUrl: env.PROMETHEUS_BASE_URL,
			timeoutMs: env.PROMETHEUS_TIMEOUT_MS,
			bearerToken: env.PROMETHEUS_BEARER_TOKEN,
			username: env.PROMETHEUS_USERNAME,
			password: env.PROMETHEUS_PASSWORD,
		},
	) {}

	public async query(
		params: PrometheusInstantQueryParams,
	): Promise<PrometheusQueryResponse> {
		return this.request("query", params);
	}

	public async queryRange(
		params: PrometheusRangeQueryParams,
	): Promise<PrometheusQueryResponse> {
		return this.request("query_range", params);
	}

	private async request(
		path: "query" | "query_range",
		params: Record<string, string | undefined>,
	): Promise<PrometheusQueryResponse> {
		if (!this.config.baseUrl) {
			throw new ServiceError("Prometheus monitoring is not configured.", 503);
		}

		const baseUrl = this.config.baseUrl.endsWith("/")
			? this.config.baseUrl
			: `${this.config.baseUrl}/`;
		const url = new URL(`api/v1/${path}`, baseUrl);

		for (const [key, value] of Object.entries(params)) {
			if (value) {
				url.searchParams.set(key, value);
			}
		}

		const abortController = new AbortController();
		const timeoutId = setTimeout(
			() => abortController.abort(),
			this.config.timeoutMs,
		);

		try {
			const response = await fetch(url, {
				method: "GET",
				headers: this.buildHeaders(),
				signal: abortController.signal,
			});

			if (!response.ok) {
				throw new ServiceError(
					`Prometheus request failed with status ${response.status}.`,
					502,
				);
			}

			const payload = (await response.json()) as PrometheusEnvelope;
			if (payload.status !== "success" || !payload.data) {
				const message = payload.error
					? `Prometheus error${payload.errorType ? ` (${payload.errorType})` : ""}: ${payload.error}`
					: "Prometheus returned an invalid response.";
				throw new ServiceError(message, 502);
			}

			return {
				status: "success",
				data: payload.data,
				...(payload.warnings ? { warnings: payload.warnings } : {}),
				...(payload.infos ? { infos: payload.infos } : {}),
			};
		} catch (error) {
			if (error instanceof ServiceError) {
				throw error;
			}

			if (error instanceof Error && error.name === "AbortError") {
				throw new ServiceError(
					"Prometheus request timed out before the upstream server responded.",
					504,
				);
			}

			throw new ServiceError(
				"Failed to connect to the Prometheus monitoring API.",
				502,
				{ cause: error },
			);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private buildHeaders() {
		const headers = new Headers({
			Accept: "application/json",
		});

		if (this.config.bearerToken) {
			headers.set("Authorization", `Bearer ${this.config.bearerToken}`);
			return headers;
		}

		if (this.config.username && this.config.password) {
			const token = btoa(`${this.config.username}:${this.config.password}`);
			headers.set("Authorization", `Basic ${token}`);
		}

		return headers;
	}
}
