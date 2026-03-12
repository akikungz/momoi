# Momoi API

**Version:** 1.0.50  
**Runtime:** Bun 1.3  
**Framework:** ElysiaJS

Momoi is a cloud-based platform API for managing academic course instances, user requests, SSH keys, and file storage. It is purpose-built for educational environments where students request virtual machine (VM) instances provisioned on a Proxmox VE (PVE) cluster, and instructors/admins review and manage those resources.

---

## Table of Contents

- [Momoi API](#momoi-api)
  - [Table of Contents](#table-of-contents)
  - [Architecture Overview](#architecture-overview)
  - [Tech Stack](#tech-stack)
  - [Project Structure](#project-structure)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Environment Variables](#environment-variables)
    - [Running Locally](#running-locally)
    - [Docker](#docker)
  - [Database](#database)
    - [Schema Overview](#schema-overview)
      - [Authentication Tables (managed by better-auth)](#authentication-tables-managed-by-better-auth)
      - [Platform Tables](#platform-tables)
      - [Proxmox VE Infrastructure](#proxmox-ve-infrastructure)
      - [Instance \& Lifecycle](#instance--lifecycle)
      - [Request \& Approval Workflow](#request--approval-workflow)
      - [SSH Keys \& File Storage](#ssh-keys--file-storage)
    - [Key Enums](#key-enums)
    - [Database Commands](#database-commands)
  - [Authentication](#authentication)
  - [Authorization — Role-Based Access Control](#authorization--role-based-access-control)
  - [API Reference](#api-reference)
    - [Base URL](#base-url)
    - [Route Modules](#route-modules)
      - [`GET /api/user/me`](#get-apiuserme)
      - [SSH Keys — `/api/user/ssh-keys`](#ssh-keys--apiuserssh-keys)
      - [Instances — `/api/instances`](#instances--apiinstances)
      - [Requests — `/api/requests`](#requests--apirequests)
      - [Academic — `/api/academic`](#academic--apiacademic)
      - [Storage — `/api/storage`](#storage--apistorage)
      - [Autocomplete — `/api/autocomplete`](#autocomplete--apiautocomplete)
      - [Auth — `/api/auth/*`](#auth--apiauth)
      - [Metrics — `GET /metrics`](#metrics--get-metrics)
  - [Queue System](#queue-system)
  - [Storage Provider](#storage-provider)
  - [Observability](#observability)
    - [Metrics](#metrics)
    - [Traces](#traces)
    - [Logs](#logs)
  - [Testing](#testing)
  - [Graceful Shutdown](#graceful-shutdown)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      Momoi API (This Repo)               │
│                                                          │
│  src/index.ts ──► src/api.ts                             │
│       │               │                                  │
│   HTTP Server       Routes (ElysiaJS)                    │
│   Graceful          ├── /api/auth    (better-auth)       │
│   Shutdown          ├── /api/user                        │
│                     ├── /api/instances                   │
│                     ├── /api/requests                    │
│                     ├── /api/academic                    │
│                     ├── /api/storage                     │
│                     └── /api/autocomplete                │
│                                                          │
│  Shared Modules                                          │
│  ├── PostgreSQL (Prisma)                                 │
│  ├── Redis (ioredis)  ◄──── BullMQ job queue             │
│  ├── S3-compatible object storage                        │
│  └── OpenTelemetry + Prometheus + Pino                   │
└──────────────────────────────────────────────────────────┘
           │ (BullMQ jobs via Redis)
           ▼
┌──────────────────────────┐
│  Worker Microservice     │
│  (separate repository)   │
│  Provisions / deprovisions│
│  VMs on Proxmox VE       │
└──────────────────────────┘
```

Momoi is a **producer-only** service for background jobs. All VM lifecycle operations are handled asynchronously by a separate worker microservice that shares the same Redis instance. See [docs/QUEUE.md](docs/QUEUE.md) and [docs/WORKER_IMPLEMENTATION.md](docs/WORKER_IMPLEMENTATION.md) for details.

---

## Tech Stack

| Layer                   | Technology                                            |
| ----------------------- | ----------------------------------------------------- |
| Runtime                 | [Bun](https://bun.sh) 1.3                             |
| HTTP Framework          | [ElysiaJS](https://elysiajs.com) (latest)             |
| Database                | PostgreSQL via [Prisma](https://prisma.io) 7.4.2      |
| Prisma Driver           | `@prisma/adapter-pg` (pg driver)                      |
| Cache / Queue broker    | Redis via [ioredis](https://github.com/redis/ioredis) |
| Background Jobs         | [BullMQ](https://docs.bullmq.io) 5                    |
| Authentication          | [better-auth](https://better-auth.com) 1.5.3          |
| Object Storage          | AWS S3 / S3-compatible (`@aws-sdk/client-s3`)         |
| Observability - Traces  | OpenTelemetry OTLP (gRPC)                             |
| Observability - Metrics | Prometheus via `prom-client`                          |
| Observability - Logs    | [Pino](https://getpino.io) 10                         |
| Validation              | [Zod](https://zod.dev) v4 + ElysiaJS TypeBox          |
| API Docs                | OpenAPI via `@elysiajs/openapi`                       |
| Testing                 | Bun test runner                                       |

---

## Project Structure

```
src/
├── index.ts              # HTTP server entry point & graceful shutdown
├── api.ts                # API singleton: route mounting, middleware, OTEL, CORS
├── auth/
│   ├── index.ts          # better-auth configuration (Google OAuth, sessions)
│   └── mock.ts           # Mock auth for test environment
├── cache/
│   ├── index.ts          # Redis CacheModule (get/set/del with TTL)
│   └── mock.ts           # In-memory mock cache for tests
├── database/
│   ├── index.ts          # Prisma client export
│   └── prisma/
│       ├── schema.prisma # Full database schema
│       ├── seeds.ts      # Seeding scripts
│       ├── generated/    # Prisma client generated output
│       └── prismabox/    # TypeBox models generated by prismabox
├── env/
│   └── index.ts          # Zod-validated environment variables
├── logger/
│   └── index.ts          # Pino logger instance
├── metrics/
│   ├── index.ts          # HTTP metrics + Prometheus /metrics endpoint plugin
│   ├── business.ts       # Business metrics (instances, requests, storage, files)
│   └── registry.ts       # Shared prom-client registry
├── model/                # ElysiaJS TypeBox request/response models
│   ├── academic.ts
│   ├── autocomplete.ts
│   ├── instance.ts
│   ├── request.ts
│   ├── storage.ts
│   └── user.ts
├── queue/
│   ├── index.ts          # BullMQ queue instances (provision / deprovision / toggle)
│   ├── mock.ts           # Mock queue for tests
│   └── types.ts          # Shared job data / result interfaces
├── routes/               # ElysiaJS route definitions (thin controller layer)
│   ├── academic.ts
│   ├── autocomplete.ts
│   ├── instance.ts
│   ├── request.ts
│   ├── storage.ts
│   └── user.ts
├── service/              # Business logic layer
│   ├── academic/
│   ├── autocomplete/
│   ├── instance/
│   ├── request/
│   ├── storage/
│   └── user/
├── storage-provider/
│   ├── index.ts          # Factory: returns S3 or database-stub provider
│   ├── s3.ts             # AWS S3 / S3-compatible implementation
│   └── types.ts          # ObjectStorageProvider interface
└── utils/
    ├── error.ts          # ServiceError class
    ├── object.ts         # Object utilities (pick, omit)
    ├── pagination.ts     # Pagination helpers
    └── user.ts           # Email domain helpers (IT dept, instructor detection)

test/
├── e2e/                  # End-to-end tests (real HTTP requests)
│   └── *.e2e.test.ts
├── unit/                 # Unit tests (mocked dependencies)
│   ├── routes/
│   ├── service/
│   └── ...
└── mocks/
    ├── mock-prisma.ts    # createMockPrisma() factory
    └── mock-factory.ts   # Domain object mock factories

docs/
├── API.md                # Detailed API endpoint documentation by role
├── E2E_TESTING.md        # E2E test guide
├── ENVIRONMENT.md        # Environment variable reference
├── QUEUE.md              # BullMQ queue architecture
├── TESTING.md            # Unit testing guide with mock Prisma
├── OBSERVABILITY_GRAFANA.md  # Grafana / Prometheus / Loki / Tempo setup
└── WORKER_IMPLEMENTATION.md  # Worker microservice implementation guide
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- PostgreSQL 14+
- Redis 6+

### Environment Variables

Copy `.env.example` to `.env` and fill in values. Full variable reference: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

| Variable                      | Required | Default       | Description                                                        |
| ----------------------------- | -------- | ------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                    | No       | `development` | `development` \| `production` \| `test`                            |
| `PORT`                        | No       | `3000`        | HTTP server port                                                   |
| `JWT_SECRET`                  | **Yes**  | —             | JWT signing secret (32+ characters)                                |
| `DATABASE_URL`                | **Yes**  | —             | PostgreSQL connection string (`postgresql://...`)                  |
| `REDIS_URL`                   | No       | —             | Redis connection string (`redis://...`). Required for queue/cache. |
| `BETTER_AUTH_URL`             | No       | —             | Base URL for auth callbacks (e.g. `http://localhost:3000`)         |
| `GOOGLE_CLIENT_ID`            | No       | —             | Google OAuth client ID                                             |
| `GOOGLE_CLIENT_SECRET`        | No       | —             | Google OAuth client secret                                         |
| `ALLOW_CORS_ORIGINS`          | No       | `*`           | Comma-separated allowed CORS origins                               |
| `STORAGE_PROVIDER`            | No       | `database`    | `database` (stub) or `s3`                                          |
| `S3_ENDPOINT`                 | No       | —             | S3-compatible endpoint URL                                         |
| `S3_ACCESS_KEY_ID`            | No       | —             | S3 access key                                                      |
| `S3_SECRET_ACCESS_KEY`        | No       | —             | S3 secret key                                                      |
| `S3_REGION`                   | No       | —             | S3 region                                                          |
| `S3_BUCKET_NAME`              | No       | —             | S3 bucket name                                                     |
| `S3_FORCE_PATH_STYLE`         | No       | `true`        | Use path-style S3 URLs                                             |
| `S3_PRESIGN_EXPIRES_SECONDS`  | No       | `900`         | Pre-signed URL TTL (60–604800 s)                                   |
| `OTEL_SERVICE_NAME`           | No       | `momoi`       | OpenTelemetry service name                                         |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No       | —             | OTLP gRPC endpoint (e.g. `http://localhost:4317`)                  |
| `LOG_LEVEL`                   | No       | `info`        | `debug` \| `info` \| `warn` \| `error`                             |
| `LOG_FORMAT`                  | No       | `plain`       | `json` \| `plain`                                                  |
| `LOG_PRETTY`                  | No       | `false`       | Enable pino-pretty output                                          |

### Running Locally

```bash
# Install dependencies
bun install

# Generate Prisma client
bun run db:gen

# Apply schema to database
bun run db:push

# Start development server (watch mode)
bun run dev

# Start production server
bun run start
```

The API is available at `http://localhost:3000/api`.  
OpenAPI docs are served at `http://localhost:3000/api/swagger` (or the configured OpenAPI path).

### Docker

A multi-stage `Dockerfile` is included:

```bash
# Build image
docker build -t momoi .

# Run container
docker run -p 3000:3000 --env-file .env momoi
```

The build stage uses `oven/bun:1.3-debian`, generates the Prisma client, then copies only necessary files to the runtime image.

---

## Database

### Schema Overview

The schema is defined in [src/database/prisma/schema.prisma](src/database/prisma/schema.prisma) and targets PostgreSQL with the `bun` Prisma engine.

#### Authentication Tables (managed by better-auth)

| Model          | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `User`         | Core user identity (id, name, email, emailVerified, image) |
| `Session`      | Active user sessions with expiry and user agent            |
| `Account`      | OAuth provider account links (Google, etc.)                |
| `Verification` | Email / token verification records                         |

#### Platform Tables

| Model              | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `PlatformUser`     | Extends `User` with a `PlatformRole` (STUDENT / INSTRUCTOR / ADMIN) |
| `InstructorSearch` | Email whitelist cache for instructor role eligibility               |
| `Course`           | Course registry (code, title, description, isActive)                |
| `Semester`         | Academic semester with start/end dates and `isCurrent` flag         |
| `CourseOffering`   | Junction of `Course` × `Semester`                                   |

#### Proxmox VE Infrastructure

| Model          | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `PVENode`      | Physical Proxmox node (name, IP address)                     |
| `PVENetwork`   | Network segment (subnet, gateway, bridge, VLAN tag)          |
| `PVENetworkIP` | Individual IP address within a network (+ allocation status) |
| `PVETemplate`  | VM/LXC template available for provisioning                   |
| `PVEVM`        | Provisioned VM record linked to a node and network IP        |

#### Instance & Lifecycle

| Model                  | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `Instance`             | User VM instance (CPU, RAM, disk, status, provision status)    |
| `InstanceReverseProxy` | Reverse proxy rules attached to an instance (HTTP/HTTPS, port) |
| `InstanceAuditLog`     | Immutable log of actions performed on an instance              |

#### Request & Approval Workflow

| Model                     | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| `Request`                 | Student request for a new instance within a course offering   |
| `ExtendedRequest`         | Request to extend an existing instance into the next semester |
| `RequestAuditLog`         | Approval/rejection history for requests                       |
| `ExtendedRequestAuditLog` | Approval/rejection history for extended requests              |

#### SSH Keys & File Storage

| Model                    | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `PlatformSSHKey`         | User's SSH public keys (name + public key, unique per owner)      |
| `PlatformFile`           | File or folder node in the virtual file system                    |
| `PlatformFileVersion`    | Immutable versioned content record with storage path and checksum |
| `PlatformFilePermission` | Per-user or per-email permission grant on a file                  |
| `PlatformFileShareLink`  | Shareable link with optional password, expiry, and access limits  |

### Key Enums

| Enum                      | Values                                                         |
| ------------------------- | -------------------------------------------------------------- |
| `PlatformRole`            | `ADMIN`, `INSTRUCTOR`, `STUDENT`                               |
| `InstanceStatus`          | `PENDING`, `ACTIVE`, `PROMOTED`, `INACTIVE`, `DELETED`         |
| `InstanceProvisionStatus` | `NOT_STARTED`, `QUEUED`, `PROVISIONING`, `COMPLETED`, `FAILED` |
| `ApprovalStatus`          | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`                 |
| `ReverseProxyType`        | `HTTPS`, `HTTP`                                                |
| `PVEVMStatus`             | `RUNNING`, `STOPPED`, `SUSPENDED`                              |
| `PVEVMType`               | `QEMU`, `LXC`                                                  |
| `PlatformFileType`        | `FILE`, `FOLDER`                                               |
| `PlatformFileVisibility`  | `PRIVATE`, `SHARED`, `PUBLIC`                                  |
| `PlatformFileViewerRole`  | `VIEWER`, `COMMENTER`, `EDITOR`, `OWNER`                       |

### Database Commands

```bash
bun run db:gen       # Generate Prisma client from schema
bun run db:push      # Push schema to DB without migration (dev)
bun run db:migrate   # Create and apply a new migration
bun run db:studio    # Open Prisma Studio in browser
```

---

## Authentication

Authentication is handled by [better-auth](https://better-auth.com) mounted at `/api/auth`.

**Supported providers:**

| Provider         | Environment                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| Google OAuth     | All environments (requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`) |
| Email / Password | Development & test only (`NODE_ENV !== 'production'`)                   |

**Session strategy:** JWT cookie cache (3-hour TTL, `sameSite: lax`).

**Role assignment on sign-up:**
- IT department email domains → evaluated for ADMIN or INSTRUCTOR
- Emails present in the `InstructorSearch` table → assigned INSTRUCTOR role
- All others → assigned STUDENT role

**Mock auth (`NODE_ENV=test`):** The mock adapter bypasses the database and returns a deterministic user. See [src/auth/mock.ts](src/auth/mock.ts).

---

## Authorization — Role-Based Access Control

Every route requires a valid session. Roles are checked inside route handlers or via guards.

| Role           | Capabilities                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **STUDENT**    | View own profile, manage SSH keys, create instance requests, view own instances, manage personal files             |
| **INSTRUCTOR** | Everything STUDENT can do, plus: create instances directly, review student requests, view course instances         |
| **ADMIN**      | Full access: manage all instances, requests, academic data (courses, semesters, PVE infra), view system audit logs |

See [docs/API.md](docs/API.md) for a per-endpoint role matrix.

---

## API Reference

### Base URL

All endpoints are prefixed with `/api`.

### Route Modules

#### `GET /api/user/me`
Returns the authenticated user's profile (`id`, `email`, `name`, `role`, `image`).

#### SSH Keys — `/api/user/ssh-keys`

| Method   | Path                 | Description                       |
| -------- | -------------------- | --------------------------------- |
| `GET`    | `/api/user/ssh-keys` | List user's SSH keys (paginated)  |
| `POST`   | `/api/user/ssh-keys` | Add a new SSH public key          |
| `DELETE` | `/api/user/ssh-keys` | Remove one or more SSH keys by ID |

#### Instances — `/api/instances`

| Method                   | Path                                 | Role               | Description                                          |
| ------------------------ | ------------------------------------ | ------------------ | ---------------------------------------------------- |
| `POST`                   | `/api/instances`                     | INSTRUCTOR / ADMIN | Create a new VM instance                             |
| `GET`                    | `/api/instances`                     | All                | List the current user's instances                    |
| `GET`                    | `/api/instances/admin`               | ADMIN              | List all instances system-wide                       |
| `GET`                    | `/api/instances/instructor`          | INSTRUCTOR / ADMIN | List instances for the instructor's courses          |
| `GET`                    | `/api/instances/:id`                 | All                | Get a single instance                                |
| `PATCH`                  | `/api/instances/:id/status`          | INSTRUCTOR / ADMIN | Toggle instance power state (START / STOP / RESTART) |
| `DELETE`                 | `/api/instances/:id`                 | INSTRUCTOR / ADMIN | Delete / deprovision an instance                     |
| Reverse Proxy sub-routes | `/api/instances/:id/reverse-proxies` | All                | Manage HTTP/HTTPS reverse proxy rules                |
| Audit Log sub-routes     | `/api/instances/:id/audit-logs`      | All                | View instance audit history                          |

#### Requests — `/api/requests`

| Method            | Path                        | Role                 | Description                        |
| ----------------- | --------------------------- | -------------------- | ---------------------------------- |
| `POST`            | `/api/requests`             | STUDENT / INSTRUCTOR | Create a new instance request      |
| `GET`             | `/api/requests`             | All                  | List the current user's requests   |
| `GET`             | `/api/requests/admin`       | ADMIN                | List all requests                  |
| `GET`             | `/api/requests/instructor`  | INSTRUCTOR / ADMIN   | List requests assigned for review  |
| `GET`             | `/api/requests/:id`         | All                  | Get a single request               |
| `PATCH`           | `/api/requests/:id/approve` | INSTRUCTOR / ADMIN   | Approve a request                  |
| `PATCH`           | `/api/requests/:id/reject`  | INSTRUCTOR / ADMIN   | Reject a request                   |
| Extended requests | `/api/requests/extended/*`  | All                  | Manage semester extension requests |

#### Academic — `/api/academic`

| Resource         | Description                 | Roles                     |
| ---------------- | --------------------------- | ------------------------- |
| Courses          | CRUD for course catalog     | ADMIN (write), All (read) |
| Semesters        | CRUD for academic semesters | ADMIN (write), All (read) |
| Course Offerings | Semester × Course pairings  | ADMIN (write), All (read) |
| PVE Nodes        | Proxmox node registry       | ADMIN only                |
| PVE Networks     | Network segment registry    | ADMIN only                |
| PVE Templates    | VM/LXC template registry    | ADMIN only                |
| Mailing List     | Instructor email whitelist  | ADMIN only                |

#### Storage — `/api/storage`

| Method                         | Path                        | Description                                  |
| ------------------------------ | --------------------------- | -------------------------------------------- |
| `GET`                          | `/api/storage`              | List files / folders (paginated, filterable) |
| `POST`                         | `/api/storage/folder`       | Create a new folder                          |
| `POST`                         | `/api/storage/upload`       | Obtain a pre-signed upload URL               |
| `GET`                          | `/api/storage/:id`          | Get file metadata                            |
| `GET`                          | `/api/storage/:id/download` | Obtain a pre-signed download URL             |
| `PATCH`                        | `/api/storage/:id`          | Rename / move a file or folder               |
| `DELETE`                       | `/api/storage/:id`          | Trash a file or folder                       |
| `/api/storage/:id/versions`    | —                           | File version management                      |
| `/api/storage/:id/permissions` | —                           | Per-user permission grants                   |
| `/api/storage/:id/share-links` | —                           | Shareable link management                    |

#### Autocomplete — `/api/autocomplete`

Read-only endpoints returning dropdown option lists (courses, semesters, templates, etc.) used by front-end form components.

#### Auth — `/api/auth/*`

Delegated entirely to better-auth. Includes Google OAuth callback, session management, sign-in, sign-out, and token refresh.

#### Metrics — `GET /metrics`

Prometheus-format metrics endpoint (not under `/api` prefix).

---

## Queue System

Momoi uses **BullMQ** backed by Redis for asynchronous VM lifecycle operations. The API enqueues jobs with minimal trigger data; a separate worker microservice consumes them.

**Queues:**

| Queue Name               | Job Data                                               | Trigger                     |
| ------------------------ | ------------------------------------------------------ | --------------------------- |
| `provision-instance`     | `{ instanceId, userId }`                               | Instance approved / created |
| `deprovision-instance`   | `{ instanceId, userId }`                               | Instance deleted            |
| `toggle-instance-status` | `{ instanceId, userId, status: START\|STOP\|RESTART }` | Status change request       |

**Retry policy:** 3 attempts with exponential backoff (initial delay 2 s).

For worker implementation details see [docs/WORKER_IMPLEMENTATION.md](docs/WORKER_IMPLEMENTATION.md).  
For architecture diagrams and flow descriptions see [docs/QUEUE.md](docs/QUEUE.md).

---

## Storage Provider

Configured via the `STORAGE_PROVIDER` environment variable.

| Provider            | `STORAGE_PROVIDER` | Description                                                                               |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| **S3**              | `s3`               | Full S3-compatible storage (AWS, MinIO, etc.). Generates pre-signed upload/download URLs. |
| **Database (stub)** | `database`         | Placeholder — throws errors on use. Suitable only for development without object storage. |

The `ObjectStorageProvider` interface exposes: `createObjectKey()`, `createUploadUrl()`, `createDownloadUrl()`, `deleteObject()`.

---

## Observability

### Metrics

Prometheus metrics are exposed at `GET /metrics` using a custom registry (`metricsRegistry`).

**HTTP metrics:**

| Metric                          | Type      | Description                                   |
| ------------------------------- | --------- | --------------------------------------------- |
| `http_request_duration_seconds` | Histogram | Request latency by method, route, status code |
| `http_requests_total`           | Counter   | Total requests by method, route, status code  |
| `http_request_errors_total`     | Counter   | Error count with error type label             |
| `http_active_connections`       | Counter   | Active connection count                       |

**Business metrics:**

| Metric                                         | Type      | Description                             |
| ---------------------------------------------- | --------- | --------------------------------------- |
| `momoi_instances_created_total`                | Counter   | Instances created (by template, course) |
| `momoi_instance_provisioning_total`            | Counter   | Provisioning attempts by result         |
| `momoi_instance_provisioning_duration_seconds` | Histogram | Provisioning duration                   |
| `momoi_instances_by_status`                    | Gauge     | Current instance count by status        |
| `momoi_instance_status_changes_total`          | Counter   | START / STOP / RESTART operations       |
| `momoi_instances_deleted_total`                | Counter   | Instances deleted                       |
| `momoi_requests_created_total`                 | Counter   | Requests created (standard / extended)  |

### Traces

Distributed tracing uses **OpenTelemetry** with a gRPC OTLP exporter.

- Instrumentations: PostgreSQL (`PgInstrumentation`), Redis (`IORedisInstrumentation`)
- Exporter: `OTLPTraceExporter` → configured via `OTEL_EXPORTER_OTLP_ENDPOINT`
- Service name: configured via `OTEL_SERVICE_NAME` (default: `momoi`)

### Logs

Structured logging via **Pino**.

- Level: `LOG_LEVEL` (default `info`)
- Format: `LOG_FORMAT` (`json` or `plain`)
- Pretty print: `LOG_PRETTY=true` enables `pino-pretty`

For a full Grafana observability stack (Prometheus + Loki + Tempo) see [docs/OBSERVABILITY_GRAFANA.md](docs/OBSERVABILITY_GRAFANA.md).

---

## Testing

```bash
bun test                          # Run all tests
bun run test:unit                 # Unit tests only
bun run test:e2e                  # E2E tests only
bun run test:watch                # Watch mode
bun run test:coverage             # Coverage report
```

**Unit tests** use a fully mocked Prisma client (`createMockPrisma()`) and mock service dependencies. Mock factories are available for all domain models (`createMockUser()`, `createMockInstance()`, etc.).

**E2E tests** send real HTTP requests to a running test server with an in-memory database and mock auth.

See [docs/TESTING.md](docs/TESTING.md) and [docs/E2E_TESTING.md](docs/E2E_TESTING.md) for detailed guides.

---

## Graceful Shutdown

The server handles `SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection` signals.

Shutdown sequence (15-second force-exit timeout):

1. Stop accepting new HTTP connections (`app.stop()`)
2. Close BullMQ queue connections
3. Disconnect Redis cache
4. Disconnect Prisma client

Shutdown logic is centralized in `shutdownApiResources()` ([src/api.ts](src/api.ts)) and invoked from signal handlers in [src/index.ts](src/index.ts).
