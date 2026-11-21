import { posix as path } from "node:path";
import type { Item, RuleMatch } from "@agentherd/protocol";
import { isInside, pathFromArgument, resolvePath } from "./paths.ts";
import { parseCommand } from "./shell.ts";

// Without a full shell/CLI parser we cannot infer every option's meaning.
// Recognize a few common shapes; unknown scoped commands need the owner.
function commandPaths(command: string): string[] | null {
  const parsed = parseCommand(command);
  const words = parsed.segments[0]?.map((word) => word.value) ?? [];
  if (parsed.segments.length !== 1) return null;
  const [name, subcommand] = words;
  let args: string[];
  if (["cat", "ls", "rm", "head", "tail", "mkdir", "touch", "cp", "mv"].includes(name ?? "")) {
    args = words.slice(1);
  } else if (name === "git" && ["status", "diff", "log"].includes(subcommand ?? "")) {
    args = words.slice(2);
  } else if (["pnpm", "npm"].includes(name ?? "") && subcommand === "test") {
    args = words.slice(2);
  } else if (name === "pwd" && words.length === 1) {
    return [];
  } else {
    return null;
  }

  const paths: string[] = [];
  const flags = new Set([
    "--",
    "--run",
    "--watch",
    "--short",
    "--stat",
    "--cached",
    "--staged",
    "-r",
    "-R",
    "-f",
    "-rf",
    "-fr",
    "-p",
    "-l",
    "-a",
    "-la",
    "-al",
  ]);
  let afterSeparator = false;
  for (const arg of args) {
    if (arg === "--") {
      afterSeparator = true;
      continue;
    }
    if (!afterSeparator && flags.has(arg)) continue;
    if (!afterSeparator && arg.startsWith("-")) {
      // Options may change directories, read config or invoke other programs.
      // Do not guess their effects, even when an explicit path is present.
      return null;
    }
    paths.push(pathFromArgument(arg));
  }
  return paths;
}

export function matchesScope(scope: RuleMatch["pathScope"], item: Item, home: string): boolean {
  if (scope === undefined) return true;
  const call = item.toolCall;
  if (call === undefined) return false;
  const context = { cwd: item.cwd, home };
  if (scope.kind === "dir" && !path.isAbsolute(scope.path)) return false;
  const directory = scope.kind === "cwd" ? item.cwd : scope.path;
  const paths = [...call.paths];
  if (call.command !== undefined) {
    const inferred = commandPaths(call.command);
    if (inferred === null) return false;
    paths.push(...inferred);
  }
  // A path-free command still runs in cwd. It cannot match a narrower subdirectory.
  if (paths.length === 0) return call.command !== undefined && isInside(directory, item.cwd);
  return paths.every((value) => {
    const resolved = resolvePath(value, context);
    return resolved !== null && isInside(directory, resolved);
  });
}
