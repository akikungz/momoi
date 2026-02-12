# Observability (Metrics, Traces, Logs) for Grafana

This document explains how to analyze Momoi’s telemetry data and build a Grafana dashboard using the metrics, tracing, and logging already implemented in the codebase.

## Overview
Momoi exports three telemetry signals:

- **Metrics** via Prometheus (`/metrics`) using `prom-client`.
- **Traces** via OpenTelemetry OTLP (gRPC exporter).
- **Logs** via Pino, optionally shipped to **Loki** with trace correlation.

These are all wired to work together so a Grafana dashboard can correlate **route latency**, **error rates**, **trace spans**, and **logs** for any request.

---
## 🚀 Grafana Stack Provisioning Guide

### Docker Compose Setup

Create a `docker-compose.observability.yml` file:

```yaml
version: "3.8"

services:
  # Prometheus - Metrics collection
  prometheus:
    image: prom/prometheus:v2.50.1
    container_name: momoi-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./observability/prometheus/alerts.yml:/etc/prometheus/alerts.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--web.enable-remote-write-receiver'
    restart: unless-stopped
    networks:
      - observability

  # Loki - Log aggregation
  loki:
    image: grafana/loki:2.9.4
    container_name: momoi-loki
    ports:
      - "3100:3100"
    volumes:
      - ./observability/loki/loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped
    networks:
      - observability

  # Tempo - Distributed tracing
  tempo:
    image: grafana/tempo:2.3.1
    container_name: momoi-tempo
    ports:
      - "3200:3200"   # Tempo API
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    volumes:
      - ./observability/tempo/tempo-config.yml:/etc/tempo/tempo.yaml
      - tempo_data:/tmp/tempo
    command: -config.file=/etc/tempo/tempo.yaml
    restart: unless-stopped
    networks:
      - observability

  # Grafana - Visualization
  grafana:
    image: grafana/grafana:10.3.3
    container_name: momoi-grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_FEATURE_TOGGLES_ENABLE=traceqlEditor
    volumes:
      - ./observability/grafana/provisioning:/etc/grafana/provisioning
      - ./observability/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
      - loki
      - tempo
    restart: unless-stopped
    networks:
      - observability

volumes:
  prometheus_data:
  loki_data:
  tempo_data:
  grafana_data:

networks:
  observability:
    driver: bridge
```

### Directory Structure

```
observability/
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml
│   │   └── dashboards/
│   │       └── dashboards.yml
│   └── dashboards/
│       ├── momoi-overview.json
│       ├── momoi-business.json
│       └── momoi-infrastructure.json
├── prometheus/
│   ├── prometheus.yml
│   └── alerts.yml
├── loki/
│   └── loki-config.yml
└── tempo/
    └── tempo-config.yml
```

### Prometheus Configuration

`observability/prometheus/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files:
  - /etc/prometheus/alerts.yml

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'momoi'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

`observability/prometheus/alerts.yml`:
```yaml
groups:
  - name: momoi-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_request_errors_total[5m])) 
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: "Error rate is above 5% for the last 5 minutes"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency detected
          description: "P95 latency is above 2 seconds"

      - alert: ProvisioningFailures
        expr: |
          sum(rate(momoi_instance_provisioning_total{status="failed"}[15m])) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Instance provisioning failures detected
          description: "One or more instance provisioning jobs have failed"

      - alert: HighPendingRequests
        expr: momoi_pending_requests_count > 50
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: High number of pending requests
          description: "More than 50 requests pending for over 30 minutes"

      - alert: QueueBacklog
        expr: momoi_queue_size{state="waiting"} > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Job queue backlog growing
          description: "Queue {{ $labels.queue_name }} has over 100 waiting jobs"
```

### Loki Configuration

`observability/loki/loki-config.yml`:
```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

analytics:
  reporting_enabled: false
```

### Tempo Configuration

`observability/tempo/tempo-config.yml`:
```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

ingester:
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 48h

metrics_generator:
  registry:
    external_labels:
      source: tempo
      cluster: momoi
  storage:
    path: /tmp/tempo/generator/wal
    remote_write:
      - url: http://prometheus:9090/api/v1/write
        send_exemplars: true

storage:
  trace:
    backend: local
    wal:
      path: /tmp/tempo/wal
    local:
      path: /tmp/tempo/blocks

overrides:
  defaults:
    metrics_generator:
      processors: [service-graphs, span-metrics]
```

### Grafana Data Sources Provisioning

`observability/grafana/provisioning/datasources/datasources.yml`:
```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      httpMethod: POST
      exemplarTraceIdDestinations:
        - name: traceId
          datasourceUid: tempo

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false
    jsonData:
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: '"traceId":"(\w+)"'
          name: traceId
          url: '$${__value.raw}'

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    uid: tempo
    editable: false
    jsonData:
      httpMethod: GET
      tracesToLogs:
        datasourceUid: loki
        tags: ['service']
        mappedTags: [{ key: 'service.name', value: 'service' }]
        mapTagNamesEnabled: true
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
        filterByTraceID: true
        filterBySpanID: false
      tracesToMetrics:
        datasourceUid: prometheus
        tags: [{ key: 'service.name', value: 'service' }]
        queries:
          - name: 'Request rate'
            query: 'sum(rate(http_requests_total{$$__tags}[5m]))'
          - name: 'Error rate'
            query: 'sum(rate(http_request_errors_total{$$__tags}[5m]))'
      serviceMap:
        datasourceUid: prometheus
      nodeGraph:
        enabled: true
      lokiSearch:
        datasourceUid: loki
```

### Grafana Dashboard Provisioning

`observability/grafana/provisioning/dashboards/dashboards.yml`:
```yaml
apiVersion: 1

providers:
  - name: 'Momoi Dashboards'
    orgId: 1
    folder: 'Momoi'
    folderUid: 'momoi'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### Starting the Stack

```bash
# Start all services
docker-compose -f docker-compose.observability.yml up -d

# View logs
docker-compose -f docker-compose.observability.yml logs -f

# Stop all services
docker-compose -f docker-compose.observability.yml down
```

### Environment Variables for Momoi

Add these to your `.env` file:
```bash
# Telemetry
OTEL_SERVICE_NAME=momoi
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
LOKI_URL=http://localhost:3100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_PRETTY=false
```

---
## 📊 Metrics (Prometheus)

### How metrics are exposed
The `metricsPlugin` in `src/metrics/index.ts` exposes:

- **Endpoint:** `GET /metrics`
- **Registry:** `src/metrics/registry.ts`
- **Default Node metrics:** CPU, memory, event loop, etc.

### Infrastructure Metrics

| Metric                            | Type      | Labels                                         | Meaning                                   |
| --------------------------------- | --------- | ---------------------------------------------- | ----------------------------------------- |
| `http_requests_total`             | Counter   | `method`, `route`, `status_code`               | Total HTTP requests                       |
| `http_request_duration_seconds`   | Histogram | `method`, `route`, `status_code`               | Request latency                           |
| `http_request_errors_total`       | Counter   | `method`, `route`, `status_code`, `error_type` | Request errors                            |
| `http_active_connections`         | Counter   | _none_                                         | Active connections (tracked as a counter) |
| `log_entries_total`               | Counter   | `level`, `service`                             | Total log entries                         |
| `log_errors_total`                | Counter   | `level`, `service`, `error_type`               | Error logs by type                        |
| `log_processing_duration_seconds` | Histogram | `transport`, `level`                           | Log shipping duration                     |

### Business & Domain Metrics

Defined in `src/metrics/business.ts`:

#### Instance Metrics

| Metric                                         | Type      | Labels                       | Meaning                               |
| ---------------------------------------------- | --------- | ---------------------------- | ------------------------------------- |
| `momoi_instances_created_total`                | Counter   | `template_id`, `course_code` | Total instances created               |
| `momoi_instance_provisioning_total`            | Counter   | `status`, `template_id`      | Provisioning attempts by result       |
| `momoi_instance_provisioning_duration_seconds` | Histogram | `template_id`, `status`      | Time to provision an instance         |
| `momoi_instances_by_status`                    | Gauge     | `status`, `provision_status` | Current instance count by status      |
| `momoi_instance_status_changes_total`          | Counter   | `action`, `result`           | Instance start/stop/restart ops       |
| `momoi_instances_deleted_total`                | Counter   | `reason`                     | Total instances deleted/deprovisioned |

#### Request Metrics

| Metric                                    | Type      | Labels           | Meaning                                    |
| ----------------------------------------- | --------- | ---------------- | ------------------------------------------ |
| `momoi_requests_created_total`            | Counter   | `type`           | Total requests created (standard/extended) |
| `momoi_request_status_updates_total`      | Counter   | `type`, `action` | Request status changes                     |
| `momoi_pending_requests_count`            | Gauge     | `type`           | Current pending requests                   |
| `momoi_request_approval_duration_seconds` | Histogram | `type`, `action` | Time from creation to resolution           |

#### User Activity Metrics

| Metric                           | Type    | Labels      | Meaning                      |
| -------------------------------- | ------- | ----------- | ---------------------------- |
| `momoi_user_logins_total`        | Counter | `method`    | Total user logins            |
| `momoi_active_users_count`       | Gauge   | `role`      | Active users by role         |
| `momoi_ssh_key_operations_total` | Counter | `operation` | SSH key create/delete/update |

#### Queue & Job Metrics

| Metric                                  | Type      | Labels                   | Meaning                |
| --------------------------------------- | --------- | ------------------------ | ---------------------- |
| `momoi_queue_size`                      | Gauge     | `queue_name`, `state`    | Jobs in queue by state |
| `momoi_jobs_processed_total`            | Counter   | `queue_name`, `status`   | Total jobs processed   |
| `momoi_job_processing_duration_seconds` | Histogram | `queue_name`, `job_type` | Job processing time    |
| `momoi_job_retries_total`               | Counter   | `queue_name`, `job_type` | Job retry attempts     |

#### Resource Metrics

| Metric                      | Type  | Labels                         | Meaning                         |
| --------------------------- | ----- | ------------------------------ | ------------------------------- |
| `momoi_allocated_resources` | Gauge | `resource_type`                | Total allocated CPU/memory/disk |
| `momoi_resources_by_course` | Gauge | `course_code`, `resource_type` | Resources allocated per course  |

#### Reverse Proxy Metrics

| Metric                                 | Type    | Labels      | Meaning                     |
| -------------------------------------- | ------- | ----------- | --------------------------- |
| `momoi_reverse_proxy_operations_total` | Counter | `operation` | Proxy config operations     |
| `momoi_active_reverse_proxies_count`   | Gauge   | _none_      | Active proxy configurations |

#### Academic Metrics

| Metric                       | Type  | Labels                    | Meaning               |
| ---------------------------- | ----- | ------------------------- | --------------------- |
| `momoi_active_courses_count` | Gauge | `semester`                | Active course offerings |
| `momoi_instances_per_course` | Gauge | `course_code`, `semester` | Instances per course  |

> Note: `http_active_connections` is currently implemented as a **Counter**. If you need a true live gauge, consider converting this to a `Gauge` in the future.

---

## 🔎 Traces (OpenTelemetry → OTLP → Jaeger)

Tracing is enabled in `src/api.ts` using `@elysiajs/opentelemetry`:

- Exporter: `OTLPTraceExporter`
- Processor: `BatchSpanProcessor`
- Endpoint: `OTEL_EXPORTER_OTLP_ENDPOINT`

This means all HTTP request spans are emitted to your OTLP backend (e.g., **Jaeger** via the OTLP collector endpoint).

Database and Redis tracing are enabled via OpenTelemetry instrumentations:
- **Postgres**: `@opentelemetry/instrumentation-pg`
- **Redis (ioredis)**: `@opentelemetry/instrumentation-ioredis`

These create spans for SQL queries and Redis commands, which appear as child spans under each request trace.

### Trace identifiers in logs
The logger injects `traceId` and `spanId` into all logs (see `src/logger/index.ts`).
If Loki is configured, `traceId` and `spanId` are also included as labels for easy navigation from logs → traces.

---

## 🧾 Logs (Pino → Loki)

Logging is handled in `src/logger/index.ts` with support for Loki:

- If `LOKI_URL` is set, logs are shipped to Loki via `pino-loki`.
- Trace context is attached to every log entry.
- Request logs and error logs are generated in `src/api.ts` inside `.trace()`.

Each log entry includes:

- `service`, `env`
- `traceId`, `spanId`
- `method`, `route`, `status`, `url`
- `totalTime`, `userAgent`

---

## ✅ Grafana Setup (Data Sources)

Add the following data sources:

1. **Prometheus** → metrics
2. **Jaeger** (OTLP collector) → traces
3. **Loki** → logs

All three should use the same `service.name` (`OTEL_SERVICE_NAME`) so dashboard filters align.

---

## 📈 Recommended Grafana Dashboard Panels

### Traffic
- **Requests per second**
  ```promql
  sum(rate(http_requests_total[5m])) by (method, route)
  ```

- **Top routes by traffic**
  ```promql
  topk(10, sum(rate(http_requests_total[5m])) by (route))
  ```

### Latency
- **P95 latency by route**
  ```promql
  histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
  ```

- **P99 latency overall**
  ```promql
  histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
  ```

### Errors
- **Error rate (%)**
  ```promql
  100 * (
    sum(rate(http_request_errors_total[5m]))
    /
    sum(rate(http_requests_total[5m]))
  )
  ```

- **Top error routes**
  ```promql
  topk(10, sum(rate(http_request_errors_total[5m])) by (route, error_type))
  ```

### Logs
- **Log volume by level**
  ```promql
  sum(rate(log_entries_total[5m])) by (level)
  ```

- **Error logs by type**
  ```promql
  sum(rate(log_errors_total[5m])) by (error_type)
  ```

### Log processing latency
- **P95 log ship time**
  ```promql
  histogram_quantile(0.95, sum(rate(log_processing_duration_seconds_bucket[5m])) by (le, transport))
  ```

### Traces (Jaeger)
- **Search by service**
  - Service: `momoi` (matches `OTEL_SERVICE_NAME`)
  - Operation: `HTTP GET` (example; depends on your span naming)

- **Narrow by route**
  - Use the **Tags** field with attributes your OTEL backend records (e.g., `http.route`, `http.method`, `http.status_code`).

---

## � Business Metrics Dashboard Panels

### Instance Metrics

- **Instances created per hour**
  ```promql
  sum(increase(momoi_instances_created_total[1h])) by (template_id)
  ```

- **Instance status distribution**
  ```promql
  sum(momoi_instances_by_status) by (status, provision_status)
  ```

- **Provisioning success rate**
  ```promql
  100 * (
    sum(rate(momoi_instance_provisioning_total{status="success"}[1h]))
    /
    sum(rate(momoi_instance_provisioning_total[1h]))
  )
  ```

- **Average provisioning time by template**
  ```promql
  histogram_quantile(0.5, sum(rate(momoi_instance_provisioning_duration_seconds_bucket[1h])) by (le, template_id))
  ```

- **Instance operations (start/stop/restart)**
  ```promql
  sum(rate(momoi_instance_status_changes_total[5m])) by (action, result)
  ```

### Request Metrics

- **Requests created by type**
  ```promql
  sum(increase(momoi_requests_created_total[24h])) by (type)
  ```

- **Pending requests (should stay low)**
  ```promql
  sum(momoi_pending_requests_count) by (type)
  ```

- **Request approval rate**
  ```promql
  sum(rate(momoi_request_status_updates_total{action="APPROVED"}[24h])) by (type)
  /
  sum(rate(momoi_request_status_updates_total{action=~"APPROVED|REJECTED"}[24h])) by (type)
  ```

- **Average time to approval (median)**
  ```promql
  histogram_quantile(0.5, sum(rate(momoi_request_approval_duration_seconds_bucket[24h])) by (le, type))
  ```

- **Request status changes**
  ```promql
  sum(increase(momoi_request_status_updates_total[1h])) by (type, action)
  ```

### Queue & Job Metrics

- **Queue sizes by state**
  ```promql
  sum(momoi_queue_size) by (queue_name, state)
  ```

- **Job throughput per queue**
  ```promql
  sum(rate(momoi_jobs_processed_total[5m])) by (queue_name, status)
  ```

- **Job success rate**
  ```promql
  100 * (
    sum(rate(momoi_jobs_processed_total{status="success"}[5m])) by (queue_name)
    /
    sum(rate(momoi_jobs_processed_total[5m])) by (queue_name)
  )
  ```

- **P95 job processing time**
  ```promql
  histogram_quantile(0.95, sum(rate(momoi_job_processing_duration_seconds_bucket[5m])) by (le, queue_name))
  ```

- **Job retries**
  ```promql
  sum(rate(momoi_job_retries_total[5m])) by (queue_name, job_type)
  ```

### Resource Allocation

- **Total allocated resources**
  ```promql
  sum(momoi_allocated_resources) by (resource_type)
  ```

- **Resources per course**
  ```promql
  sum(momoi_resources_by_course) by (course_code, resource_type)
  ```

- **Top courses by CPU allocation**
  ```promql
  topk(10, sum(momoi_resources_by_course{resource_type="cpu"}) by (course_code))
  ```

### User Activity

- **User logins per hour**
  ```promql
  sum(increase(momoi_user_logins_total[1h])) by (method)
  ```

- **Active users by role**
  ```promql
  sum(momoi_active_users_count) by (role)
  ```

- **SSH key operations**
  ```promql
  sum(rate(momoi_ssh_key_operations_total[1h])) by (operation)
  ```

### Academic Metrics

- **Active courses per semester**
  ```promql
  sum(momoi_active_courses_count) by (semester)
  ```

- **Instances per course (distribution)**
  ```promql
  topk(15, sum(momoi_instances_per_course) by (course_code, semester))
  ```

### Reverse Proxy

- **Active reverse proxies**
  ```promql
  momoi_active_reverse_proxies_count
  ```

- **Proxy configuration changes**
  ```promql
  sum(rate(momoi_reverse_proxy_operations_total[1h])) by (operation)
  ```

---

## 🔗 Correlating Metrics → Logs → Traces

1. **Find a spike** in latency or errors from metrics.
2. **Pivot to logs** using the route or error labels.
3. **Jump to traces** using `traceId` in Loki or by filtering in Jaeger.

Recommended Grafana setup:
- Add a **Logs panel** with a derived field linking `traceId` → Jaeger trace view.
- Use dashboard variables for `route`, `status_code`, and `service`.

---

## 🧩 Environment Variables (Telemetry)

These values control observability behavior:

| Variable                      | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `OTEL_SERVICE_NAME`           | Service name used in traces/logs             |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP gRPC endpoint for traces                |
| `LOKI_URL`                    | Loki log ingestion endpoint                  |
| `LOG_LEVEL`                   | Log level (`debug`, `info`, `warn`, `error`) |
| `LOG_FORMAT`                  | Log format (`json` or `plain`)               |
| `LOG_PRETTY`                  | Pretty logs in dev (`true`/`false`)          |

---

## 🛠️ Troubleshooting

- **No metrics in Prometheus:** ensure `/metrics` is reachable and scraped.
- **No traces:** confirm `OTEL_EXPORTER_OTLP_ENDPOINT` is reachable and OTLP gRPC is enabled.
- **No logs in Loki:** verify `LOKI_URL` and that Loki is accepting JSON payloads.
- **Missing trace/log correlation:** check `traceId`/`spanId` labels in Loki and `OTEL_SERVICE_NAME` consistency.

---

## Next Improvements (Optional)

- Convert `http_active_connections` to a true `Gauge`.
- Integrate business metrics recording in service layer methods.
- Add domain-specific span attributes (e.g., request IDs, user IDs) where appropriate.
- Create pre-built Grafana dashboard JSON files for quick import.
- Add recording rules for frequently-used aggregations.
- Configure alertmanager for notification routing (Slack, PagerDuty, email).
