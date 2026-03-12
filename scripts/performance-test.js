#!/usr/bin/env node
// Lightweight HTTP performance tester for Momoi API.
// Node 18+ required (global fetch). No external dependencies.

const DEFAULTS = {
  base: process.env.MOMOI_BASE_URL || `http://localhost:${process.env.MOMOI_PORT || 3000}`,
  // Current public routes in Momoi.
  paths: ["/api/openapi/json", "/api/academic/semesters/current"],
  durationSec: 20,
  concurrency: 10,
  method: "GET",
  timeoutMs: 10000,
  log: process.env.PERF_LOG_FILE || "momoi-perf-requests.log",
  headers: {
    "User-Agent": "momoi-perf/1.0 (+node)",
  },
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const n = argv[i + 1];
    switch (a) {
      case "--base":
        args.base = n;
        i += 1;
        break;
      case "--paths":
        args.paths = n.split(",").map((s) => s.trim()).filter(Boolean);
        i += 1;
        break;
      case "--duration":
        args.durationSec = parseInt(n, 10);
        i += 1;
        break;
      case "--concurrency":
        args.concurrency = parseInt(n, 10);
        i += 1;
        break;
      case "--method":
        args.method = n.toUpperCase();
        i += 1;
        break;
      case "--timeout":
        args.timeoutMs = parseInt(n, 10);
        i += 1;
        break;
      case "--header": {
        const [k, ...rest] = n.split("=");
        const v = rest.join("=");
        args.headers[k] = v;
        i += 1;
        break;
      }
      case "--out":
        args.out = n;
        i += 1;
        break;
      case "--log":
        args.log = n;
        i += 1;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        break;
    }
  }
  return args;
}

function printHelp() {
  console.log(`\nMomoi Performance Test\n\nUsage:\n  node scripts/performance-test.js [options]\n\nOptions:\n  --base <url>          Base URL (default: ${DEFAULTS.base})\n  --paths <list>        Comma-separated paths (default: ${DEFAULTS.paths.join(",")})\n  --duration <sec>      Test duration in seconds (default: ${DEFAULTS.durationSec})\n  --concurrency <n>     Concurrent workers per path (default: ${DEFAULTS.concurrency})\n  --method <HTTP>       HTTP method (default: GET)\n  --timeout <ms>        Request timeout in ms (default: ${DEFAULTS.timeoutMs})\n  --header k=v          Extra header, can be repeated\n  --out <file>          Write JSON report to file\n  --log <file>          Write per-request JSONL log (default: ${DEFAULTS.log})\n`);
}

function nowMs() {
  return performance.now();
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const pos = (arr.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
    return arr[base] + rest * (arr[base + 1] - arr[base]);
  }
  return arr[base];
}

function fixGitBashPath(p) {
  const pf = "/Program Files/Git/";
  if (p.includes(pf)) {
    const idx = p.indexOf(pf);
    const rest = p.slice(idx + pf.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }

  if (/^[A-Za-z]:\//.test(p)) {
    const last = p.split("/").pop();
    return last ? (last.startsWith("/") ? last : `/${last}`) : "/";
  }

  return p;
}

async function httpFetch(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = nowMs();

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const dur = nowMs() - start;

    let size = 0;
    try {
      const reader = res.body?.getReader?.();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value?.length || 0;
          if (size > 1024 * 1024) {
            controller.abort();
            break;
          }
        }
      } else {
        const t = await res.text();
        size = t.length;
      }
    } catch {
      // Ignore body read issues for perf measurement.
    }

    return { ok: res.ok, status: res.status, dur, size };
  } catch (err) {
    const dur = nowMs() - start;
    return { ok: false, status: 0, dur, error: err?.name || "Error" };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPath({ base, path, concurrency, method, headers, timeoutMs, deadline, logRequest }) {
  const safePath = fixGitBashPath(path);
  const url = base.replace(/\/$/, "") + (safePath.startsWith("/") ? safePath : `/${safePath}`);
  const latencies = [];
  let ok = 0;
  let fail = 0;
  let total = 0;
  let bytes = 0;

  async function worker() {
    while (performance.now() < deadline) {
      const requestStartedAt = Date.now();
      const r = await httpFetch(url, { method, headers }, timeoutMs);
      total += 1;
      const requestNo = total;
      if (r.ok) ok += 1;
      else fail += 1;
      latencies.push(r.dur);
      bytes += r.size || 0;

      if (logRequest) {
        logRequest({
          timestamp: new Date(requestStartedAt).toISOString(),
          path,
          url,
          requestNo,
          method,
          status: r.status,
          ok: r.ok,
          durationMs: Number(r.dur.toFixed(3)),
          responseBytes: r.size || 0,
          error: r.error || null,
        });
      }
    }
  }

  const start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsed = (performance.now() - start) / 1000;

  latencies.sort((a, b) => a - b);
  return {
    path,
    url,
    total,
    ok,
    fail,
    bytes,
    elapsedSec: Number(elapsed.toFixed(3)),
    rps: Number((total / elapsed).toFixed(2)),
    min: latencies[0] || 0,
    p50: percentile(latencies, 0.5),
    p90: percentile(latencies, 0.9),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99),
    max: latencies[latencies.length - 1] || 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { createWriteStream } = await import("node:fs");
  const logStream = createWriteStream(args.log, { flags: "w", encoding: "utf8" });

  const logRequest = (entry) => {
    logStream.write(`${JSON.stringify(entry)}\n`);
  };

  logRequest({
    type: "meta",
    service: "momoi",
    startedAt: new Date().toISOString(),
    base: args.base,
    paths: args.paths,
    durationSec: args.durationSec,
    concurrency: args.concurrency,
    method: args.method,
  });

  console.log(`\nMomoi perf: ${args.base}`);
  const displayPaths = args.paths.map((p) => fixGitBashPath(p));
  console.log(`Paths: ${displayPaths.join(", ")}`);
  console.log(`Duration: ${args.durationSec}s  Concurrency: ${args.concurrency} per path  Method: ${args.method}`);
  console.log(`Per-request log: ${args.log}`);

  try {
    const deadline = performance.now() + args.durationSec * 1000;
    const perPath = await Promise.all(
      args.paths.map((p) =>
        runPath({
          base: args.base,
          path: p,
          concurrency: args.concurrency,
          method: args.method,
          headers: args.headers,
          timeoutMs: args.timeoutMs,
          deadline,
          logRequest,
        })
      )
    );

    const totals = perPath.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.ok += r.ok;
        acc.fail += r.fail;
        acc.bytes += r.bytes;
        acc.elapsedSec = Math.max(acc.elapsedSec, r.elapsedSec);
        return acc;
      },
      { total: 0, ok: 0, fail: 0, bytes: 0, elapsedSec: 0 }
    );

    const overall = {
      target: args.base,
      startedAt: new Date().toISOString(),
      durationSec: args.durationSec,
      concurrencyPerPath: args.concurrency,
      logFile: args.log,
      summary: {
        requests: totals.total,
        ok: totals.ok,
        fail: totals.fail,
        throughputRps: Number((totals.total / (totals.elapsedSec || 1)).toFixed(2)),
        transferredMB: Number((totals.bytes / (1024 * 1024)).toFixed(3)),
      },
      results: perPath,
    };

    console.log("\n=== Summary ===");
    console.table(
      perPath.map((r) => ({
        path: r.path,
        rps: r.rps,
        ok: r.ok,
        fail: r.fail,
        p50: Number(r.p50.toFixed(1)),
        p90: Number(r.p90.toFixed(1)),
        p95: Number(r.p95.toFixed(1)),
        p99: Number(r.p99.toFixed(1)),
      }))
    );
    console.log(
      `Total: ${overall.summary.requests} | OK: ${overall.summary.ok} | Fail: ${overall.summary.fail} | RPS: ${overall.summary.throughputRps}`
    );

    if (args.out) {
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(args.out, JSON.stringify(overall, null, 2), "utf8")
      );
      console.log(`Report written to ${args.out}`);
    }
  } finally {
    await new Promise((resolve) => {
      logStream.end(resolve);
    });
    console.log(`Per-request log written to ${args.log}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
