import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor, WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { logs } from "@opentelemetry/api-logs";

let started = false;
let tracerProvider: WebTracerProvider | undefined;
let loggerProvider: LoggerProvider | undefined;

function deploymentEnvironment(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (
    env.VITE_DEPLOYMENT_ENVIRONMENT ||
    env.VITE_ENVIRONMENT ||
    env.MODE ||
    "dev"
  );
}

function peerServiceFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/(identity|time|project|partner|customer|catalog|finance)(?:\/|$)/);
  if (!match) return undefined;
  return `projectX-${match[1]}`;
}

/**
 * Boot browser OpenTelemetry to same-origin `/otel/`.
 * - Traces (`/otel/v1/traces`): page load + fetch spans (APM service map).
 * - Logs (`/otel/v1/logs`): UI audit events only (`audit.ts`); not traces.
 */
export function initOtel(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "projectX-web",
    // Match Python backends (ECS / Elastic): deployment.environment
    "deployment.environment": deploymentEnvironment(),
  });

  tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${window.location.origin}/otel/v1/traces`,
        }),
      ),
    ],
  });
  tracerProvider.register({
    contextManager: new ZoneContextManager(),
  });

  loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${window.location.origin}/otel/v1/logs`,
        }),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void tracerProvider?.forceFlush();
      void loggerProvider?.forceFlush();
    }
  });

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        ignoreUrls: [/\/otel\//],
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
        applyCustomAttributesOnSpan(span, request) {
          try {
            let pathname: string;
            if (typeof request === "string") {
              pathname = new URL(request, window.location.origin).pathname;
            } else if (request instanceof Request) {
              pathname = new URL(request.url).pathname;
            } else {
              return;
            }
            const peer = peerServiceFromPath(pathname);
            if (peer) span.setAttribute("peer.service", peer);
          } catch {
            /* ignore */
          }
        },
      }),
    ],
  });
}
