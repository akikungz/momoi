export interface PrometheusQueryResponse {
	status: "success";
	data: {
		resultType: "matrix" | "vector" | "scalar" | "string";
		result: unknown;
	};
	warnings?: string[];
	infos?: string[];
}

export interface PrometheusInstantQueryParams {
	query: string;
	time?: string;
	timeout?: string;
}

export interface PrometheusRangeQueryParams {
	query: string;
	start: string;
	end: string;
	step: string;
	timeout?: string;
}

export interface PrometheusQueryPort {
	query(params: PrometheusInstantQueryParams): Promise<PrometheusQueryResponse>;
	queryRange(
		params: PrometheusRangeQueryParams,
	): Promise<PrometheusQueryResponse>;
}
