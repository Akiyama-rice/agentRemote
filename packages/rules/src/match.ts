import type { Item, Rule } from "@agentherd/protocol";
import { normalizeCommand } from "./normalize.ts";
import { matchesScope } from "./scope.ts";
import { parseCommand, withoutAssignments } from "./shell.ts";

export interface RuleMatchResult {
  rule: Rule;
  action: "allow" | "deny";
}

/**
 * 检查命令是否匹配规则的通配模式。
 * 只有 `*` 是通配符（匹配任意子串），其余字符都是字面量。
 * 例如："pnpm test*" 能匹配 "pnpm test" 和 "pnpm test --run"，
 *       但不能匹配 "pnpm lint" 或 "npm test"。
 */
function matchesGlob(pattern: string, command: string): boolean {
  // 把正则特殊字符转义，只让 * 充当通配符。
  const escaped = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join(".*")}$`).test(command);
}

/**
 * 判断一条规则是否匹配一个请求。
 * 规则指定的每个条件都必须命中，没指定的条件视为"不限"。
 * 任何一个条件不满足就立即返回 false。
 */
function matchesRule(rule: Rule, item: Item, home: string): boolean {
  const call = item.toolCall;
  if (call === undefined) return false;
  const match = rule.match;

  // --- 关卡 1-3：身份和类型过滤（规则没指定的条件直接跳过） ---
  if (match.profileId !== undefined && match.profileId !== item.profileId) return false;
  if (match.eventType !== undefined && match.eventType !== item.kind) return false;
  if (match.toolKind !== undefined && match.toolKind !== call.kind) return false;

  // --- 关卡 4：复合命令安全检查（仅限 allow 规则） ---
  // allow 规则不能匹配复合命令（如 "pnpm test && rm -rf /"）
  // 或带环境变量前缀的命令（如 "VAR=secret pnpm test"），
  // 因为后半部分可能很危险，会借着 allow 蒙混过关。
  // deny 规则不受此限制——拒绝宁可宽一点。
  if (rule.action === "allow" && call.command !== undefined) {
    const parsed = parseCommand(call.command);
    const words = parsed.segments[0] ?? [];
    if (parsed.segments.length !== 1 || words.length !== withoutAssignments(words).length)
      return false;
  }

  // --- 关卡 5：命令模式匹配（归一化后再用通配符比对） ---
  if (match.command !== undefined) {
    if (call.command === undefined || !matchesGlob(match.command, normalizeCommand(call.command)))
      return false;
  }

  // --- 关卡 6：路径范围检查（限定在工作目录或指定目录内） ---
  return matchesScope(match.pathScope, item, home);
}

/**
 * 拿一个请求逐条扫描所有规则，返回最终结果；没有匹配则返回 null。
 *
 * 核心行为：
 * - deny 一票否决：碰到第一条匹配的 deny 立刻停止扫描并返回。
 * - allow 先记住，但继续扫描，因为后面可能还有 deny 覆盖它。
 * - 全部扫完都没匹配，返回 null，调用方应该交给主人决定。
 * - 匹配过程中出现异常（如命令无法解析），返回 null 而非意外放行。
 *
 * 这是底层匹配函数，调用方必须先运行守卫检查。
 * 入口处请使用 evaluateRules()，它保证守卫先于规则执行。
 */
export function matchRules(rules: Rule[], item: Item, home: string): RuleMatchResult | null {
  // 只有 open 状态的权限请求、且带有操作详情，才值得查规则。
  if (item.kind !== "permission" || item.state !== "open" || item.toolCall === undefined)
    return null;

  let firstAllow: RuleMatchResult | null = null;

  for (const rule of rules) {
    try {
      if (!matchesRule(rule, item, home)) continue;
    } catch {
      // 解析失败不能作为 allow 匹配的证据。直接放弃，让调用方交给主人。
      return null;
    }
    // deny 一票否决——立刻停止扫描。
    if (rule.action === "deny") return { rule, action: "deny" };
    // 记住第一条 allow，但继续扫描，看后面有没有 deny。
    firstAllow ??= { rule, action: "allow" };
  }

  // 有 allow 就返回它，全都没匹配就返回 null。
  return firstAllow;
}
