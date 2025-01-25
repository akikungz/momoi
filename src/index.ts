import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { opentelemetry } from "@elysiajs/opentelemetry";

import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const app = new Elysia()
  .use(swagger())
  .use(opentelemetry({
    serviceName: 'Momoi',
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: 'http://localhost:4317',
          headers: {
            'x-scope-orgid': 'elysia',
            'x-scope-appid': 'momoi'
          }
        })
      )
    ]
  }))
  // !add a middleware to handle the route because route in trace is undefined
  .onBeforeHandle(({ route }) => void route)

app.listen(3001, (ctx) => console.log(`Momoi is running on ${ctx.hostname}:${ctx.port}`));