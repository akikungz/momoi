import z from "zod";

export const GeneralEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
});

export const SecretEnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
});

export const DatabaseEnvSchema = z.object({
  POSTGRES_URL: z.url({ pattern: /^postgres(?:ql)?:\/\// }),
  REDIS_URL: z.url().optional(),
});

export const TelemetryEnvSchema = z.object({
  OTEL_SERVICE_NAME: z.string().default("momoi"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
  LOG_FORMAT: z.enum(["json", "plain"]).default("plain"),
});

export const EnvSchema = z.object({
  ...GeneralEnvSchema.shape,
  ...SecretEnvSchema.shape,
  ...DatabaseEnvSchema.shape,
  ...TelemetryEnvSchema.shape,
});

export type Env = z.infer<typeof EnvSchema>;

const parsedEnv = EnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", z.formatError(parsedEnv.error));
  process.exit(1);
}

export const env: Env = parsedEnv.data;
