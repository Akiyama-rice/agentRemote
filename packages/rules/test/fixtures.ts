import type { Item, Rule, RuleMatch, ToolCallInfo } from "@agentherd/protocol";

export const context = { cwd: "/work/project", home: "/home/owner" };

export function tool(command: string, paths: string[] = []): ToolCallInfo {
  return { kind: "execute", title: "Run a command", command, paths };
}

export function item(command: string, paths: string[] = []): Item {
  return {
    id: "item-1",
    sessionId: "session-1",
    profileId: "mock",
    cwd: context.cwd,
    kind: "permission",
    state: "open",
    createdAt: "2026-11-20T00:00:00.000Z",
    title: "Run a command",
    body: "",
    risk: "low",
    toolCall: tool(command, paths),
  };
}

export function rule(action: "allow" | "deny", match: RuleMatch = {}): Rule {
  return {
    id: `${action}-rule`,
    action,
    match,
    createdAt: "2026-11-20T00:00:00.000Z",
    createdBy: "owner",
  };
}
