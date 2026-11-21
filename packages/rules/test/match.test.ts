import { describe, expect, it } from "vitest";
import { matchRules } from "../src/index.ts";
import { context, item, rule } from "./fixtures.ts";

describe("matchRules", () => {
  it("requires every configured field to match", () => {
    const allow = rule("allow", {
      profileId: "mock",
      eventType: "permission",
      toolKind: "execute",
      command: "pnpm test*",
      pathScope: { kind: "cwd" },
    });
    expect(matchRules([allow], item("pnpm test --run"), context.home)?.rule).toBe(allow);
    for (const match of [{ profileId: "other" }, { toolKind: "edit" }, { command: "git status" }]) {
      expect(matchRules([rule("allow", match)], item("pnpm test"), context.home)).toBeNull();
    }
  });

  it("deny wins regardless of rule order; first matching rule wins ties", () => {
    const allow = rule("allow");
    const deny = rule("deny");
    expect(matchRules([allow, deny], item("pnpm test"), context.home)?.rule).toBe(deny);
    expect(matchRules([deny, allow], item("pnpm test"), context.home)?.rule).toBe(deny);
    expect(
      matchRules([allow, { ...allow, id: "later" }], item("pnpm test"), context.home)?.rule,
    ).toBe(allow);
  });

  it.each([
    ["pnpm test*", "pnpm test --run", true],
    ["pnpm test", "pnpm test-more", false],
    ["echo a.b", "echo axb", false],
    ["echo a+b", "echo a+b", true],
    ["echo '?'", "echo '?'", true],
    ["echo '?'", "echo x", false],
  ])("matches only a whole command, with * as the only wildcard", (pattern, command, expected) => {
    expect(
      matchRules([rule("allow", { command: pattern })], item(command), context.home) !== null,
    ).toBe(expected);
  });

  it.each([
    "pnpm test && git push",
    "FOO=1 pnpm test",
    "env pnpm test",
    "cd src && pnpm test",
    "echo $(id)",
    "echo 'open",
  ])("never lets a broad allow rule hide command semantics: %s", (command) => {
    expect(matchRules([rule("allow")], item(command), context.home)).toBeNull();
  });

  it.each(["../other/file", "/work/project-old/file", "~/notes", "--output=/tmp/result"])(
    "rejects paths outside the scope, even if reported paths are inside: %s",
    (path) => {
      expect(
        matchRules(
          [rule("allow", { pathScope: { kind: "cwd" } })],
          item(`cat ${path}`, ["src/main.ts"]),
          context.home,
        ),
      ).toBeNull();
    },
  );

  it("checks plain relative paths and explicit directory scopes", () => {
    const scoped = rule("allow", { pathScope: { kind: "dir", path: "/work/project/src" } });
    expect(matchRules([scoped], item("cat README.md"), context.home)).toBeNull();
    expect(matchRules([scoped], item("cat src/main.ts"), context.home)?.action).toBe("allow");
    expect(matchRules([scoped], item("pnpm test"), context.home)).toBeNull();
  });

  it("does not approve a scoped command whose path arguments are unknown", () => {
    expect(
      matchRules(
        [rule("allow", { pathScope: { kind: "cwd" } })],
        item("custom-tool unknown"),
        context.home,
      ),
    ).toBeNull();
  });

  it("does not match closed items, notifications or missing tool calls", () => {
    const original = item("pnpm test");
    const { toolCall: _toolCall, ...withoutTool } = original;
    for (const request of [
      withoutTool,
      { ...original, kind: "notification" as const },
      { ...original, state: "decided" as const },
    ]) {
      expect(matchRules([rule("allow")], request, context.home)).toBeNull();
    }
  });
});
