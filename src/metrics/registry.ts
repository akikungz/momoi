import { Registry, collectDefaultMetrics } from "prom-client";

/**
 * Shared Prometheus metrics registry
 * This module is separate to avoid circular dependencies
 */
export const metricsRegistry = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: metricsRegistry });
