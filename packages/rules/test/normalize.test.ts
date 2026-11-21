import { describe, expect, it } from "vitest";
import { commandHead, normalizeCommand } from "../src/index.ts";

describe("normalizeCommand", () => {
  it.each([
    [" pnpm test ", "pnpm test"],
    ["pnpm    test", "pnpm test"],
    ["git\tstatus", "git status"],
    ["FOO=1 BAR=2 pnpm test", "pnpm test"],
    ["env FOO=1 pnpm test", "pnpm test"],
    ["cd src && pnpm test", "pnpm test"],
    ["cd 'my project' && FOO=1 pnpm test", "pnpm test"],
    ["echo 'two  spaces'", "echo 'two  spaces'"],
    ['echo "hello world"', 'echo "hello world"'],
    ["git status && git diff", "git status && git diff"],
    ["envy test", "envy test"],
    ["pnpm test -- --run", "pnpm test -- --run"],
  ])("normalizes %s", (input, output) => expect(normalizeCommand(input)).toBe(output));

  it.each(["echo $(whoami)", "echo `whoami`", "echo 'open", "cat < file", "echo hi\nrm x"])(
    "rejects unsupported syntax without echoing the input: %s",
    (command) => {
      expect(() => normalizeCommand(command)).toThrow("Unsupported shell syntax");
    },
  );

  it("returns up to two words as a display label", () => {
    expect(commandHead("FOO=1 pnpm test --run")).toBe("pnpm test");
    expect(commandHead("pwd")).toBe("pwd");
    expect(commandHead("  ")).toBe("");
  });
});
