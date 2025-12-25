import z from "zod";

export const GeneralEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
});

export const SecretEnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
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

const parsedEnv = EnvSchema.safeParse(process.env);

function getEnv(): z.infer<typeof EnvSchema> {
  // In test mode, provide safe defaults for missing variables
  if (process.env.NODE_ENV === "test" && !parsedEnv.success) {
    return {
      NODE_ENV: "test",
      PORT: 3000,
      OTEL_SERVICE_NAME: "momoi-test",
      LOG_LEVEL: "info",
      LOG_FORMAT: "plain",
      JWT_SECRET: process.env.JWT_SECRET || "test-secret-key-minimum-32-characters-long",
      POSTGRES_URL: process.env.POSTGRES_URL || "postgresql://test:test@localhost:5432/momoi_test",
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      REDIS_URL: process.env.REDIS_URL,
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    } as z.infer<typeof EnvSchema>;
  }

  if (!parsedEnv.success) {
    console.error("❌ Invalid environment variables:", parsedEnv.error.format());
    process.exit(1);
  }

  return parsedEnv.data!;
}

export type Env = z.infer<typeof EnvSchema>;
export const env: Env = getEnv();
