const REDACTED = "«redacted»";
const secretName = /KEY|TOKEN|SECRET|PASSWORD/i;

const secretPatterns = [
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{8,}\b/g,
  /\bxox[abp]-[A-Za-z0-9-]+/g,
  /\bAKIA[A-Z0-9]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

export function redact(text: string, env: Record<string, string> = {}): string {
  let result = text;
  const values = Object.entries(env)
    .filter(([name, value]) => secretName.test(name) && value.length > 0)
    .map(([, value]) => value)
    .sort((a, b) => b.length - a.length);
  for (const value of values) result = result.replaceAll(value, REDACTED);
  for (const pattern of secretPatterns) result = result.replace(pattern, REDACTED);

  result = result.replace(/\bBearer\s+[^\s"',;]+/gi, `Bearer ${REDACTED}`);
  result = result.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*)=(?:"(?:\\.|[^"\\\n])*"|'[^'\n]*'|[^\s;,]+)/g,
    (full: string, name: string) => (secretName.test(name) ? `${name}=${REDACTED}` : full),
  );
  result = result.replace(
    /("([^"\\]+)"\s*:\s*)"(?:\\.|[^"\\])*"/g,
    (full: string, prefix: string, name: string) =>
      secretName.test(name) ? `${prefix}"${REDACTED}"` : full,
  );
  return result;
}
