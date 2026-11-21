export interface Word {
  value: string; // Quotes removed, for inspecting command names and paths.
  raw: string; // Quotes retained, so matching does not merge different commands.
}

export interface ParsedCommand {
  segments: Word[][];
  operators: string[];
}

export class UnparsedCommandError extends Error {
  constructor() {
    // Never put the original command in an error: it may contain credentials.
    super("Unsupported shell syntax");
    this.name = "UnparsedCommandError";
  }
}

// This is a small tokenizer, not a shell interpreter. Unsupported syntax is rejected.
export function parseCommand(command: string): ParsedCommand {
  const segments: Word[][] = [];
  const operators: string[] = [];
  let words: Word[] = [];
  let raw = "";
  let value = "";
  let quote = "";

  function finishWord(): void {
    if (raw !== "") words.push({ raw, value });
    raw = "";
    value = "";
  }

  function finishSegment(): void {
    finishWord();
    if (words.length === 0) throw new UnparsedCommandError();
    segments.push(words);
    words = [];
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command.charAt(index);
    const code = char.charCodeAt(0);
    if ((code < 32 && char !== "\t") || code === 127) throw new UnparsedCommandError();
    // Reject expansion and escaping even inside quotes. False positives ask the owner.
    if ("$`\\".includes(char)) throw new UnparsedCommandError();

    if (quote !== "") {
      raw += char;
      if (char === quote) quote = "";
      else value += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      raw += char;
    } else if (char === " " || char === "\t") {
      finishWord();
    } else if (";&|".includes(char)) {
      finishSegment();
      const next = command.charAt(index + 1);
      if ((char === "&" || char === "|") && next === char) {
        operators.push(char + next);
        index += 1;
      } else if (char === "&") {
        throw new UnparsedCommandError();
      } else {
        operators.push(char);
      }
    } else if ("<>(){}#".includes(char)) {
      throw new UnparsedCommandError();
    } else {
      raw += char;
      value += char;
    }
  }

  if (quote !== "") throw new UnparsedCommandError();
  if (command.trim() !== "") finishSegment();
  return { segments, operators };
}

export function withoutAssignments(words: Word[]): Word[] {
  let start = words[0]?.value === "env" ? 1 : 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[start]?.value ?? "")) start += 1;
  return words.slice(start);
}
