import { describe, expect, it } from "vitest";
import { redact } from "../src/index.ts";

const hidden = "«redacted»";

describe("redact", () => {
  it("redacts the entire value when a quoted assignment contains an escaped quote", () => {
    expect(redact('API_KEY="example\\"suffix" next')).toBe(`API_KEY=${hidden} next`);
  });
  // Synthetic strings only. These values are not credentials and cannot authenticate.
  const formats = [
    `sk-${"example".repeat(5)}`,
    `ghp_${"example".repeat(6)}`,
    `gho_${"example".repeat(6)}`,
    `github_pat_${"example".repeat(8)}`,
    `xoxb-${"1234-".repeat(5)}example`,
    `AKIA${"EXAMPLE0".repeat(2)}`,
    "eyJleGFtcGxl.e30.c2lnbmF0dXJl",
    "-----BEGIN PRIVATE KEY-----\nexample-only\n-----END PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----\nexample-only\n-----END RSA PRIVATE KEY-----",
  ];

  it.each(formats)("removes a known secret shape", (value) => {
    expect(redact(`before ${value} after`)).toBe(`before ${hidden} after`);
  });

  it.each([
    "API_KEY=example",
    "access_token='two words'",
    '"password": "example"',
    "clientSecret=example",
  ])("redacts named values", (text) => {
    expect(redact(text)).not.toContain("example");
    expect(redact(text)).not.toContain("two words");
    expect(redact(text)).toContain(hidden);
  });

  it("preserves the Bearer label but hides its value", () => {
    expect(redact("Authorization: Bearer example-only")).toBe(`Authorization: Bearer ${hidden}`);
  });

  it("redacts known environment values literally, longest first", () => {
    expect(
      redact("example-long example x.y+$ plain", {
        API_KEY: "example",
        ACCESS_TOKEN: "example-long",
        PASSWORD: "x.y+$",
        SECRET: "",
        MODE: "plain",
      }),
    ).toBe(`${hidden} ${hidden} ${hidden} plain`);
  });

  it("preserves normal text and is idempotent", () => {
    expect(redact("pnpm test --run; MODE=development")).toBe("pnpm test --run; MODE=development");
    const once = redact("API_KEY=example");
    expect(redact(once)).toBe(once);
  });
});
