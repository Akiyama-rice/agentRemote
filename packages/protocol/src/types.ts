export type SessionState =
  | "starting"
  | "working"
  | "waiting-approval"
  | "idle"
  | "looping"
  | "error"
  | "ended";

export type Mode = "observe" | "assist" | "auto";
export type Risk = "low" | "medium" | "high";

export interface AgentProfile {
  id: string;
  name: string;
  command: string[];
  env: Record<string, string>;
  exporter: string | null;
}

// ACP-specific fields stay in the future ACP client, outside this shared contract.
export interface ToolCallInfo {
  kind: string;
  title: string;
  command?: string;
  paths: string[];
  rawInput?: unknown;
}

export interface Decision {
  itemId: string;
  action: "allow" | "deny" | "answer" | "escalate";
  text?: string;
  confidence: number;
  risk: Risk;
  source: "rule" | "reviewer" | "human";
  reason: string;
  precedents: string[];
}

export interface Item {
  id: string;
  sessionId: string;
  profileId: string;
  cwd: string;
  kind: "permission" | "notification";
  state: "open" | "decided" | "expired";
  createdAt: string; // ISO 8601, so persisted values remain plain JSON.
  toolCall?: ToolCallInfo;
  title: string;
  body: string;
  risk: Risk;
  decision?: Decision;
}

export interface RuleMatch {
  profileId?: string;
  eventType?: "permission";
  toolKind?: string;
  command?: string; // Only * is special; all other characters are literal.
  pathScope?: { kind: "cwd" } | { kind: "dir"; path: string };
}

export interface Rule {
  id: string;
  action: "allow" | "deny";
  match: RuleMatch;
  createdAt: string;
  createdBy: "owner" | "always-button";
}
