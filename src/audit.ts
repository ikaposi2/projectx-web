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

/** Attach authenticated user fields to subsequent UI audit events. */
export function setAuditUser(user: AuditUser | null): void {
  auditUser = user;
}

function asList(value: string | string[] | undefined, fallback: string[]): string[] {
  if (value == null) return fallback;
  return typeof value === "string" ? [value] : value;
}

/**
 * Emit an ECS-shaped UI audit log via OpenTelemetry logs (OTLP).
 * Attributes use dotted ECS names (event.action, user.id, …).
 */
export function audit(action: string, options: AuditOptions): void {
  const { outcome, category, eventType, message, ...rest } = options;
  const cats = asList(category, ["ui"]);
  const types = asList(
    eventType,
    outcome === "failure" ? ["error"] : ["info"],
  );

  const attributes: Record<string, string | number | boolean | string[]> = {
    "event.kind": "event",
    "event.action": action,
    "event.outcome": outcome,
    "event.category": cats,
    "event.type": types,
  };

  if (auditUser?.id) attributes["user.id"] = auditUser.id;
  if (auditUser?.email) attributes["user.email"] = auditUser.email;
  if (auditUser?.full_name) attributes["user.name"] = auditUser.full_name;
  if (auditUser?.role) attributes["user.roles"] = [auditUser.role];
  if (auditUser?.tenant_id) attributes["organization.id"] = auditUser.tenant_id;

  for (const [key, value] of Object.entries(rest)) {
    if (value == null) continue;
    const ecsKey = key.includes(".") ? key : key.replace(/_/g, ".");
    attributes[ecsKey] = value;
  }

  const body = message || action;
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

  // Structured console mirror (helps local/dev; Elastic still gets OTLP).
  try {
    console.info("[audit]", body, attributes);
  } catch {
    /* ignore */
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
