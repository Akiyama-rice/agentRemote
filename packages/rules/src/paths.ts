import { posix as path } from "node:path";

export interface PathContext {
  cwd: string;
  home: string;
}

// Pure lexical checks. Symlinks require filesystem checks at a future execution boundary.
export function resolvePath(value: string, context: PathContext): string | null {
  if (!path.isAbsolute(context.cwd) || !path.isAbsolute(context.home)) return null;
  if (value === "" || /[$`\\*?[\]{}]/.test(value)) return null;
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  if (value === "~") return path.normalize(context.home);
  if (value.startsWith("~/")) return path.resolve(context.home, value.slice(2));
  if (value.startsWith("~")) return null;
  return path.resolve(context.cwd, value);
}

export function isInside(directory: string, target: string): boolean {
  const relative = path.relative(directory, target);
  return (
    relative === "" ||
    (!relative.startsWith("../") && relative !== ".." && !path.isAbsolute(relative))
  );
}

export function pathFromArgument(argument: string): string {
  // Inspect --output=/tmp/file and curl's @file notation as paths too.
  const equals = argument.indexOf("=");
  const value = equals >= 0 ? argument.slice(equals + 1) : argument;
  return value.startsWith("@") ? value.slice(1) : value;
}
