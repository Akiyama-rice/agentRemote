import type { Item, Rule } from "@agentherd/protocol";
import { type GuardContext, guardCheck } from "./guard.ts";
import { matchRules } from "./match.ts";

export type RuleEvaluation =
  | { action: "allow" | "deny"; rule: Rule; reason: string }
  | { action: "escalate"; reason: string; guardId?: string };

// A recommendation only: this module never executes commands or contacts an Agent.
export function evaluateRules(item: Item, rules: Rule[], context: GuardContext): RuleEvaluation {
  try {
    if (item.kind !== "permission" || item.state !== "open" || item.toolCall === undefined) {
      return {
        action: "escalate",
        reason: "An open permission item with tool details is required.",
      };
    }
    // 我们真正要判断的是满足open&permission&have_toolcall的item是否满足规则
    // The item's cwd is authoritative; a caller cannot substitute a wider directory.
    const guarded = guardCheck(item.toolCall, { ...context, cwd: item.cwd });
    if (guarded.hit) return { action: "escalate", guardId: guarded.id, reason: guarded.reason };
    // guardCheck() 命中？→ escalate（守卫优先，规则救不了）
    
    const match = matchRules(rules, item, context.home);
    if (match !== null) return { ...match, reason: "Matched an owner rule." };
    return { action: "escalate", reason: "No rule can decide this item; ask the owner." };
  } catch {
    return { action: "escalate", reason: "Rule evaluation failed; ask the owner." };
  }
}
