import { describe, expect, it } from "vitest";
import { evaluateRules } from "../src/index.ts";
import { context, item, rule } from "./fixtures.ts";

describe("evaluateRules: guard → rules → owner", () => {
  it("does not confuse Unicode spaces with shell separators", () => {
    expect(
      evaluateRules(item("pnpm\u00a0test"), [rule("allow", { command: "pnpm test" })], context)
        .action,
    ).toBe("escalate");
  });
  it.each(["cat ~/.ssh/*", "cat .env*", "source local-script.sh", "builtin eval 'sudo id'"])(
    "does not let a broad rule approve hidden operations: %s",
    (command) => {
      expect(evaluateRules(item(command), [rule("allow")], context).action).toBe("escalate");
    },
  );
  it("checks the guard before even reading a matching allow rule", () => {
    const unreadableRule = rule("allow");
    Object.defineProperty(unreadableRule, "match", {
      get() {
        throw new Error("Rules should not run after a guard hit.");
      },
    });
    expect(evaluateRules(item("git push --force"), [unreadableRule], context)).toMatchObject({
      action: "escalate",
      guardId: "force-push",
    });
  });

  it("returns a matching rule and lets deny win", () => {
    expect(
      evaluateRules(item("pnpm test"), [rule("allow", { command: "pnpm test" })], context).action,
    ).toBe("allow");
    expect(evaluateRules(item("pnpm test"), [rule("allow"), rule("deny")], context).action).toBe(
      "deny",
    );
  });

  it.each(["git status", "custom-tool", "echo $(whoami)"])(
    "asks the owner without a usable rule: %s",
    (command) => {
      expect(evaluateRules(item(command), [], context).action).toBe("escalate");
    },
  );

  it("does not let the caller widen the item's cwd", () => {
    expect(
      evaluateRules(item("rm -rf ../other"), [rule("allow")], { ...context, cwd: "/" }),
    ).toMatchObject({
      action: "escalate",
      guardId: "rm-outside-cwd",
    });
  });

  it("asks the owner when rule evaluation throws", () => {
    const broken = rule("allow");
    Object.defineProperty(broken, "match", {
      get() {
        throw new Error("private details");
      },
    });
    const result = evaluateRules(item("pnpm test"), [broken], context);
    expect(result.action).toBe("escalate");
    expect(JSON.stringify(result)).not.toContain("private details");
  });

  it("does not decide a closed item", () => {
    expect(
      evaluateRules({ ...item("pnpm test"), state: "decided" }, [rule("allow")], context).action,
    ).toBe("escalate");
  });
});
