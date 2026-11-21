import { posix as path } from "node:path";
import type { ToolCallInfo } from "@agentherd/protocol";
import { isInside, type PathContext, pathFromArgument, resolvePath } from "./paths.ts";
import { parseCommand, withoutAssignments } from "./shell.ts";

export type GuardResult = { hit: false } | { hit: true; id: string; reason: string };
export type ExtraGuard = (call: ToolCallInfo, context: PathContext) => string | null;
export interface GuardContext extends PathContext {
  extraGuards?: ExtraGuard[];
}

const interpreters = new Set([
  "sh",
  "bash",
  "zsh",
  "dash",
  "fish",
  "python",
  "python3",
  "node",
  "perl",
  "ruby",
]);
const wrappers = new Set([
  "env",
  "command",
  "exec",
  "eval",
  "xargs",
  "find",
  "time",
  "nohup",
  "nice",
  "source",
  ".",
  "builtin",
]);

function hit(id: string, reason: string): GuardResult {
  return { hit: true, id, reason };
}

function unparsed(): GuardResult {
  return hit("unparsed", "The command or path cannot be inspected safely.");
}

function checkSensitivePath(value: string, context: PathContext): GuardResult {
  const resolved = resolvePath(pathFromArgument(value), context);
  if (resolved === null) return { hit: false };

  if (
    [".ssh", ".aws", ".gnupg"].some((dir) => isInside(path.join(context.home, dir), resolved)) ||
    /(^|\/)\.env(?:\.[^/]*)?(?:\/|$)/.test(resolved)
  )
    return hit("secret-read", "The operation may expose credentials.");

  if (
    [".agentherd", ".codex"].some((dir) => isInside(path.join(context.home, dir), resolved)) ||
    /(^|\/)\.claude\/settings[^/]*\.json(?:\/|$)/.test(resolved)
  )
    return hit("self-config", "The operation touches Agent approval configuration.");

  return { hit: false };
}

function checkDelete(targets: string[], context: PathContext): GuardResult {
  if (targets.length === 0) return unparsed();
  for (const target of targets) {
    if (["/", "/*", "~", "~/", "$HOME"].includes(target)) {
      return hit("rm-outside-cwd", "Recursive deletion needs the owner.");
    }
    const resolved = resolvePath(target, context);
    if (resolved === null) return unparsed();
    if (!isInside(context.cwd, resolved) || resolved === path.normalize(context.cwd)) {
      return hit("rm-outside-cwd", "Deletion includes the project root or a path outside it.");
    }
  }
  return { hit: false };
}

function checkBuiltIns(call: ToolCallInfo, context: PathContext): GuardResult {
  if (!path.isAbsolute(context.cwd) || !path.isAbsolute(context.home)) return unparsed();
  for (const value of call.paths) {
    const result = checkSensitivePath(value, context);
    if (result.hit) return result;
    if (resolvePath(value, context) === null) return unparsed();
  }

  if (call.kind === "delete") {
    const result = checkDelete(call.paths, context);
    if (result.hit) return result;
  }
  if (call.command === undefined) return call.kind === "execute" ? unparsed() : { hit: false };

  const parsed = parseCommand(call.command);
  if (parsed.segments.length === 0) return unparsed();
  const segments = parsed.segments.map((words) =>
    withoutAssignments(words).map((word) => word.value),
  );

  const downloads = segments.some((words) =>
    ["curl", "wget"].includes(path.basename(words[0] ?? "")),
  );
  const runsCode = segments.some((words) => interpreters.has(path.basename(words[0] ?? "")));
  if (downloads && runsCode && parsed.operators.includes("|")) {
    return hit("pipe-to-shell", "Downloaded content would run as code.");
  }

  for (const words of segments) {
    const name = path.basename(words[0] ?? "");
    if (name === "sudo" || name === "doas")
      return hit("sudo", "Privilege elevation needs the owner.");
    for (const argument of words.slice(1)) {
      const result = checkSensitivePath(argument, context);
      if (result.hit) return result;
    }
    if (name === "security" && words.some((word) => /^find-.*-password$/.test(word))) {
      return hit("secret-read", "Reading the keychain needs the owner.");
    }
    if (
      name === "git" &&
      words.includes("push") &&
      words.some(
        (word) => /^--force(?:$|[=-])/.test(word) || /^-[^-]*f/.test(word) || word.startsWith("+"),
      )
    ) {
      return hit("force-push", "A force push may overwrite remote history.");
    }
    if (name === "rm" && words.some((word) => word === "--recursive" || /^-[^-]*[rR]/.test(word))) {
      const result = checkDelete(
        words.slice(1).filter((word) => !word.startsWith("-")),
        context,
      );
      if (result.hit) return result;
    }
    // Unexpanded globs can hide sensitive paths, even without a path-scoped rule.
    if (words.some((word) => /[*?[\]]/.test(word))) return unparsed();
    // Wrappers, directory changes and embedded scripts need semantics we do not implement.
    if (name === "" || name === "cd" || interpreters.has(name) || wrappers.has(name))
      return unparsed();
  }
  return { hit: false };
}

export function guardCheck(call: ToolCallInfo, context: GuardContext): GuardResult {
  try {
    const result = checkBuiltIns(call, context);
    if (result.hit) return result;
    for (const guard of context.extraGuards ?? []) {
      const reason = guard(call, context);
      // A stable message avoids exposing an extension's unredacted output.
      if (reason !== null) return hit("extra-guard", "An additional guard requires the owner.");
    }
    return { hit: false };
  } catch (error) {
    if (error instanceof Error && error.name === "UnparsedCommandError") return unparsed();
    return hit("guard-error", "A guard failed; the owner must decide.");
  }
}
