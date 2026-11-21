import { parseCommand, withoutAssignments } from "./shell.ts";

// For matching/display only. Never execute the normalized string.
export function normalizeCommand(command: string): string {
  const { segments, operators } = parseCommand(command);
  const first = segments[0];
  const skipCd = first?.[0]?.value === "cd" && first.length === 2 && operators[0] === "&&";
  const start = skipCd ? 1 : 0;
  const result: string[] = [];

  for (let index = start; index < segments.length; index += 1) {
    const words = withoutAssignments(segments[index] ?? []);
    result.push(words.map((word) => word.raw).join(" "));
    const operator = operators[index];
    if (operator !== undefined) result.push(operator);
  }
  return result.join(" ").trim();
}

export function commandHead(command: string): string {
  const first = parseCommand(normalizeCommand(command)).segments[0] ?? [];
  return first
    .slice(0, 2)
    .map((word) => word.value)
    .join(" ");
}
