import { describe, expect, it } from "bun:test";

import {
  DatabaseEnvSchema,
  EnvSchema,
  GeneralEnvSchema,
  SecretEnvSchema,
  TelemetryEnvSchema,
} from "..";

describe("GeneralEnvSchema", () => {
  it("should accept valid NODE_ENV values", () => {
    const result = GeneralEnvSchema.safeParse({
      NODE_ENV: "production",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("production");
    }
  });

  it("should use development as default NODE_ENV", () => {
    const result = GeneralEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("should reject invalid NODE_ENV values", () => {
    const result = GeneralEnvSchema.safeParse({
      NODE_ENV: "staging",
    });
    expect(result.success).toBe(false);
  });

  it("should coerce PORT string to number", () => {
    const result = GeneralEnvSchema.safeParse({
      PORT: "8080",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8080);
      expect(typeof result.data.PORT).toBe("number");
    }
  });

  it("should use 3000 as default PORT", () => {
    const result = GeneralEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  it("should reject non-numeric PORT", () => {
    const result = GeneralEnvSchema.safeParse({
      PORT: "not-a-number",
    });
    expect(result.success).toBe(false);
  });
});

describe("SecretEnvSchema", () => {
  it("should require JWT_SECRET with at least 32 characters", () => {
    const result = SecretEnvSchema.safeParse({
      JWT_SECRET: "a".repeat(32),
    });
    expect(result.success).toBe(true);
  });

  it("should reject JWT_SECRET shorter than 32 characters", () => {
    const result = SecretEnvSchema.safeParse({
      JWT_SECRET: "short-secret",
    });
    expect(result.success).toBe(false);
  });

  it("should require JWT_SECRET", () => {
    const result = SecretEnvSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should accept optional GOOGLE_OAUTH_CLIENT_ID", () => {
    const result = SecretEnvSchema.safeParse({
      JWT_SECRET: "a".repeat(32),
      GOOGLE_OAUTH_CLIENT_ID: "client-id-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GOOGLE_OAUTH_CLIENT_ID).toBe("client-id-123");
    }
  });

  it("should accept optional GOOGLE_OAUTH_CLIENT_SECRET", () => {
    const result = SecretEnvSchema.safeParse({
      JWT_SECRET: "a".repeat(32),
      GOOGLE_OAUTH_CLIENT_SECRET: "secret-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GOOGLE_OAUTH_CLIENT_SECRET).toBe("secret-123");
    }
  });

  it("should allow both optional fields to be undefined", () => {
    const result = SecretEnvSchema.safeParse({
      JWT_SECRET: "a".repeat(32),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GOOGLE_OAUTH_CLIENT_ID).toBeUndefined();
      expect(result.data.GOOGLE_OAUTH_CLIENT_SECRET).toBeUndefined();
    }
  });
});

describe("DatabaseEnvSchema", () => {
  it("should accept valid postgres URL", () => {
    const result = DatabaseEnvSchema.safeParse({
      POSTGRES_URL: "postgres://user:password@localhost:5432/dbname",
    });
    expect(result.success).toBe(true);
  });

  it("should accept postgresql URL variant", () => {
    const result = DatabaseEnvSchema.safeParse({
      POSTGRES_URL: "postgresql://user:password@localhost:5432/dbname",
    });
    expect(result.success).toBe(true);
  });

  it("should require POSTGRES_URL", () => {
    const result = DatabaseEnvSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject invalid URL format for POSTGRES_URL", () => {
    const result = DatabaseEnvSchema.safeParse({
      POSTGRES_URL: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional REDIS_URL", () => {
    const result = DatabaseEnvSchema.safeParse({
      POSTGRES_URL: "postgres://localhost/db",
      REDIS_URL: "redis://localhost:6379",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REDIS_URL).toBe("redis://localhost:6379");
    }
  });

  it("should allow REDIS_URL to be undefined", () => {
    const result = DatabaseEnvSchema.safeParse({
      POSTGRES_URL: "postgres://localhost/db",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REDIS_URL).toBeUndefined();
    }
  });

  it("should reject invalid URL format for REDIS_URL", () => {
    const result = DatabaseEnvSchema.safeParse({
      POSTGRES_URL: "postgres://localhost/db",
      REDIS_URL: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("TelemetryEnvSchema", () => {
  it("should use momoi as default OTEL_SERVICE_NAME", () => {
    const result = TelemetryEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OTEL_SERVICE_NAME).toBe("momoi");
    }
  });

  it("should accept custom OTEL_SERVICE_NAME", () => {
    const result = TelemetryEnvSchema.safeParse({
      OTEL_SERVICE_NAME: "my-service",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OTEL_SERVICE_NAME).toBe("my-service");
    }
  });

  it("should accept optional OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    const result = TelemetryEnvSchema.safeParse({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OTEL_EXPORTER_OTLP_ENDPOINT).toBe("http://localhost:4317");
    }
  });

  it("should use info as default LOG_LEVEL", () => {
    const result = TelemetryEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe("info");
    }
  });

  it("should accept valid LOG_LEVEL values", () => {
    const levels = ["debug", "info", "warn", "error"];
    levels.forEach((level) => {
      const result = TelemetryEnvSchema.safeParse({
        LOG_LEVEL: level,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.LOG_LEVEL).toBe(level as typeof result.data.LOG_LEVEL);
      }
    });
  });

  it("should reject invalid LOG_LEVEL", () => {
    const result = TelemetryEnvSchema.safeParse({
      LOG_LEVEL: "verbose",
    });
    expect(result.success).toBe(false);
  });

  it("should use plain as default LOG_FORMAT", () => {
    const result = TelemetryEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_FORMAT).toBe("plain");
    }
  });

  it("should accept valid LOG_FORMAT values", () => {
    const formats = ["json", "plain"];
    formats.forEach((format) => {
      const result = TelemetryEnvSchema.safeParse({
        LOG_FORMAT: format,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.LOG_FORMAT).toBe(format as typeof result.data.LOG_FORMAT);
      }
    });
  });

  it("should reject invalid LOG_FORMAT", () => {
    const result = TelemetryEnvSchema.safeParse({
      LOG_FORMAT: "xml",
    });
    expect(result.success).toBe(false);
  });
});

describe("EnvSchema", () => {
  it("should validate complete valid environment", () => {
    const result = EnvSchema.safeParse({
      NODE_ENV: "development",
      PORT: "3000",
      JWT_SECRET: "a".repeat(32),
      POSTGRES_URL: "postgres://localhost/db",
      OTEL_SERVICE_NAME: "momoi",
      LOG_LEVEL: "info",
      LOG_FORMAT: "plain",
    });
    expect(result.success).toBe(true);
  });

  it("should apply all defaults", () => {
    const result = EnvSchema.safeParse({
      JWT_SECRET: "a".repeat(32),
      POSTGRES_URL: "postgres://localhost/db",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
      expect(result.data.PORT).toBe(3000);
      expect(result.data.OTEL_SERVICE_NAME).toBe("momoi");
      expect(result.data.LOG_LEVEL).toBe("info");
      expect(result.data.LOG_FORMAT).toBe("plain");
    }
  });

  it("should reject missing required JWT_SECRET", () => {
    const result = EnvSchema.safeParse({
      POSTGRES_URL: "postgres://localhost/db",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing required POSTGRES_URL", () => {
    const result = EnvSchema.safeParse({
      JWT_SECRET: "a".repeat(32),
    });
    expect(result.success).toBe(false);
  });

  it("should accept all optional fields", () => {
    const result = EnvSchema.safeParse({
      NODE_ENV: "production",
      PORT: 8080,
      JWT_SECRET: "a".repeat(32),
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      POSTGRES_URL: "postgres://localhost/db",
      REDIS_URL: "redis://localhost:6379",
      OTEL_SERVICE_NAME: "custom-service",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4317",
      LOG_LEVEL: "debug",
      LOG_FORMAT: "json",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GOOGLE_OAUTH_CLIENT_ID).toBe("client-id");
      expect(result.data.GOOGLE_OAUTH_CLIENT_SECRET).toBe("secret");
      expect(result.data.REDIS_URL).toBe("redis://localhost:6379");
      expect(result.data.OTEL_EXPORTER_OTLP_ENDPOINT).toBe("http://localhost:4317");
    }
  });
});
