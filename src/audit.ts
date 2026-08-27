import { SeverityNumber, logs } from "@opentelemetry/api-logs";

type AuditFields = Record<string, string | number | boolean | string[] | null | undefined>;

type AuditOptions = {
  outcome: "success" | "failure" | "unknown";
  category?: string | string[];
  eventType?: string | string[];
  message?: string;
} & AuditFields;

type AuditUser = {
  id: string;
  email?: string;
  tenant_id?: string;
  full_name?: string;
  role?: string;
};

let auditUser: AuditUser | null = null;
let auditSessionId: string | null = null;

/** Attach authenticated user fields to subsequent UI audit events. */
export function setAuditUser(user: AuditUser | null): void {
  auditUser = user;
}

/** Bind JWT `jti` as session.id for stitching UI + API audits. */
export function setAuditSessionId(sessionId: string | null): void {
  auditSessionId = sessionId;
}

/** Decode JWT payload (no verify) and return `jti` when present. */
export function sessionIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { jti?: string };
    return typeof payload.jti === "string" && payload.jti ? payload.jti : null;
  } catch {
    return null;
  }
}

function asList(value: string | string[] | undefined, fallback: string[]): string[] {
  if (value == null) return fallback;
  return typeof value === "string" ? [value] : value;
}

function scalar(value: string | number | boolean | string[]): string | number | boolean {
  if (Array.isArray(value)) return value.join(",");
  return value;
}

/**
 * Emit an ECS-shaped UI audit log via OpenTelemetry logs (OTLP).
 * Body is a one-line message (Elastic `body.text`); ECS fields are scalar attributes.
 */
export function audit(action: string, options: AuditOptions): void {
  const { outcome, category, eventType, message, ...rest } = options;
  const cats = asList(category, ["ui"]);
  const types = asList(
    eventType,
    outcome === "failure" ? ["error"] : ["info"],
  );

  const attributes: Record<string, string | number | boolean> = {
    "ecs.version": "8.11.0",
    "event.dataset": "projectX-web.audit",
    "event.kind": "event",
    "event.action": action,
    "event.outcome": outcome,
    "event.category": cats.join(","),
    "event.type": types.join(","),
  };

  if (auditUser?.id) attributes["user.id"] = auditUser.id;
  if (auditUser?.email) attributes["user.email"] = auditUser.email;
  if (auditUser?.full_name) attributes["user.name"] = auditUser.full_name;
  if (auditUser?.role) attributes["user.roles"] = auditUser.role;
  if (auditUser?.tenant_id) attributes["organization.id"] = auditUser.tenant_id;
  if (auditSessionId) attributes["session.id"] = auditSessionId;

  for (const [key, value] of Object.entries(rest)) {
    if (value == null) continue;
    const ecsKey = key.includes(".") ? key : key.replace(/_/g, ".");
    attributes[ecsKey] = scalar(value);
  }

  const body = message || `${action} ${outcome}`;
  try {
    logs.getLogger("projectx.audit").emit({
      severityNumber: outcome === "failure" ? SeverityNumber.WARN : SeverityNumber.INFO,
      severityText: outcome === "failure" ? "WARN" : "INFO",
      body,
      attributes,
    });
  } catch {
    // never break UI on audit failure
  }
}

export function auditUiLogin(outcome: "success" | "failure", fields: AuditFields = {}): void {
  audit("ui-login", {
    outcome,
    category: ["ui", "authentication"],
    eventType: ["start"],
    message: outcome === "success" ? "ui login succeeded" : "ui login failed",
    ...fields,
  });
}

export function auditUiLogout(fields: AuditFields = {}): void {
  audit("ui-logout", {
    outcome: "success",
    category: ["ui", "authentication"],
    eventType: ["end"],
    message: "ui logout",
    ...fields,
  });
}

export function auditUiView(view: string, fields: AuditFields = {}): void {
  audit("ui-view", {
    outcome: "success",
    category: ["ui"],
    eventType: ["access"],
    message: `ui view ${view}`,
    "ui.view": view,
    ...fields,
  });
}

export function auditUiAction(
  name: string,
  outcome: "success" | "failure" | "unknown" = "success",
  fields: AuditFields = {},
): void {
  audit("ui-action", {
    outcome,
    category: ["ui"],
    eventType: outcome === "failure" ? ["error"] : ["change"],
    message: `ui action ${name}`,
    "ui.action": name,
    ...fields,
  });
}
