import z from "zod";

export const GeneralEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(3000),
});

export const SecretEnvSchema = z.object({
	JWT_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url({ pattern: /^http(?:s)?:\/\// }).optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	// Allow origins for CORS can be added here in the future
	ALLOW_CORS_ORIGINS: z
		.string()
		.transform((val) => val.split(",").map((origin) => origin.trim()))
		.default(["*"]),
});

export const DatabaseEnvSchema = z.object({
	DATABASE_URL: z.url({ pattern: /^postgres(?:ql)?:\/\// }),
	REDIS_URL: z.url({ pattern: /^redis:\/\// }).optional(),
});

export const S3EnvSchema = z.object({
	STORAGE_PROVIDER: z.enum(["database", "s3"]).default("database"),
	S3_ENDPOINT: z.url({ pattern: /^http(?:s)?:\/\// }).optional(),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
	S3_REGION: z.string().optional(),
	S3_BUCKET_NAME: z.string().optional(),
	S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
	S3_PRESIGN_EXPIRES_SECONDS: z.coerce
		.number()
		.int()
		.min(60)
		.max(604800)
		.default(900),
});

export const TelemetryEnvSchema = z.object({
	OTEL_SERVICE_NAME: z.string().default("momoi"),
	OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default("http://localhost:4317"),
	OTEL_EXPORTER_OTLP_PROTOCOL: z.enum(["grpc", "http"]).default("grpc"),
	OTEL_EXPORTER_OTLP_USERNAME: z.string().min(1).optional(),
	OTEL_EXPORTER_OTLP_PASSWORD: z.string().min(1).optional(),
	OTEL_FAIL_OPEN: z.coerce.boolean().default(true),
	OTEL_METRIC_EXPORT_INTERVAL: z.coerce
		.number()
		.int()
		.positive()
		.default(10000),
	OTEL_METRIC_EXPORT_TIMEOUT: z.coerce.number().int().positive().default(5000),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
	LOG_FORMAT: z.enum(["json", "plain"]).default("plain"),
	LOG_PRETTY: z.coerce.boolean().default(false),
});

export const EnvSchema = z.object({
	...GeneralEnvSchema.shape,
	...SecretEnvSchema.shape,
	...DatabaseEnvSchema.shape,
	...S3EnvSchema.shape,
	...TelemetryEnvSchema.shape,
});

const parsedEnv = EnvSchema.safeParse(process.env);

function getEnv(): z.infer<typeof EnvSchema> {
	if (!parsedEnv.success && process.env.NODE_ENV !== "test") {
		console.error(
			"❌ Invalid environment variables:",
			z.formatError(parsedEnv.error),
		);
		process.exit(1);
	}

	// biome-ignore lint/style/noNonNullAssertion: Checked in the if statement above, and we want to allow tests to run with partial env vars
	const parsed = parsedEnv.data!;
	process.env.LOG_PRETTY = parsed.LOG_PRETTY.toString();

	return parsed;
}

export type Env = z.infer<typeof EnvSchema>;
export const env: Env = getEnv();
