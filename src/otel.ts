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

function deploymentEnvironment(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (
    env.VITE_DEPLOYMENT_ENVIRONMENT ||
    env.VITE_ENVIRONMENT ||
    env.MODE ||
    "dev"
  );
}

/** Boot browser OpenTelemetry (traces + logs) to same-origin `/otel/`. */
export function initOtel(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "projectX-web",
    // Match Python backends (ECS / Elastic): deployment.environment
    "deployment.environment": deploymentEnvironment(),
  });

  const tracerProvider = new WebTracerProvider({
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

  const loggerProvider = new LoggerProvider({
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

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        ignoreUrls: [/\/otel\//],
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
      }),
    ],
  });
}
