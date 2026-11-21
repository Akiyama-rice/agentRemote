import type { Item, Rule } from "@agentherd/protocol";
import { evaluateRules, redact } from "@agentherd/rules";

const context = { cwd: "/work/project", home: "/home/owner" };
const rules: Rule[] = [
  {
    id: "allow-tests",
    action: "allow",
    match: { command: "pnpm test*", pathScope: { kind: "cwd" } },
    createdAt: "2026-11-20T00:00:00.000Z",
    createdBy: "owner",
  },
  {
    id: "deny-publish",
    action: "deny",
    match: { command: "npm publish*" },
    createdAt: "2026-11-20T00:00:00.000Z",
    createdBy: "owner",
  },
];

const commands = [
  "pnpm test --run",
  "npm publish",
  "git push --force",
  "cat .env",
  "pnpm test && git push",
  "git status",
];

console.log("AgentHerd: rule recommendations (no commands are executed)\n");
for (const [index, command] of commands.entries()) {
  const item: Item = {
    id: `demo-${index + 1}`,
    sessionId: "demo",
    profileId: "mock",
    cwd: context.cwd,
    kind: "permission",
    state: "open",
    createdAt: "2026-11-20T00:00:00.000Z",
    title: "Run a command",
    body: "",
    risk: "low",
    toolCall: { kind: "execute", title: "Run a command", command, paths: [] },
  };
  const result = evaluateRules(item, rules, context);
  const source = "rule" in result ? result.rule.id : (result.guardId ?? "owner");
  console.log(
    `${redact(command)}\n  ${result.action.toUpperCase()} [${source}] — ${result.reason}\n`,
  );
}

console.log(`Redaction: ${redact("API_KEY=example-only")}`);
