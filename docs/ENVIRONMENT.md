# Environment Variables

This project uses a `.env` file for local configuration. The `.env.example` file provides the full set of supported variables and commented examples.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in the values for your environment.
3. Restart the server so changes take effect.

## Variables

### Core

- `NODE_ENV` — Runtime environment name.
  - Example: `development`
- `PORT` — HTTP server port.
  - Example: `3000`

### Security

- `JWT_SECRET` — Secret used for signing JSON Web Tokens. Use a strong random value (32+ characters).
  - Example: `changeme_change_to_a_32_char_secret`

### Database

- `DATABASE_URL` — PostgreSQL connection string.
  - Example: `postgresql://USER:PASSWORD@HOST:5432/DATABASE`

### Cache

- `REDIS_URL` — Redis connection string.
  - Example: `redis://:PASSWORD@HOST:6379`

### Auth

- `BETTER_AUTH_URL` — Base URL used by the auth layer.
  - Example: `http://localhost:3000`

### Telemetry

- `OTEL_SERVICE_NAME` — Service name for OpenTelemetry resources.
  - Example: `momoi`
- `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP exporter endpoint.
  - Example: `http://localhost:4317`
- `LOKI_URL` — Loki endpoint for log shipping.
  - Example: `http://localhost:3100`
- `LOG_LEVEL` — Logging level.
  - Example: `info`
- `LOG_FORMAT` — Log output format.
  - Example: `json`
- `LOG_PRETTY` — Pretty-print logs when `true`.
  - Example: `false`

## Notes

- Keep `.env` out of version control.
- For production, use your platform’s secret manager instead of a local `.env` file.
