import { describe, expect, it } from "vitest";
import { isInbound } from "../src/index.ts";

describe("isInbound", () => {
  it.each([
    { kind: "action", target: "item-1", action: "allow", from: "owner" },
    { kind: "action", target: "item-1", action: "answer", text: "yes", from: "owner" },
    { kind: "message", text: "", from: "owner" },
    {
      kind: "message",
      text: "allow",
      from: "owner",
      replyTo: { channelId: "fake", messageId: "card-1" },
    },
  ])("accepts an inbound event: %j", (event) => {
    expect(isInbound(event)).toBe(true);
  });

  it.each([
    null,
    [],
    "allow",
    42,
    {},
    { kind: "other", from: "owner" },
    { kind: "action", target: "item-1", action: "allow" },
    { kind: "action", target: "", action: "allow", from: "owner" },
    { kind: "action", target: "item-1", action: "allow", from: " " },
    { kind: "action", target: "item-1", action: "allow", from: "owner", text: 1 },
    { kind: "action", target: "item-1", action: "allow", from: "owner", text: undefined },
    { kind: "message", text: 1, from: "owner" },
    { kind: "message", text: "hi", from: "owner", replyTo: null },
    { kind: "message", text: "hi", from: "owner", replyTo: { messageId: "1" } },
  ])("rejects invalid data: %j", (event) => {
    expect(isInbound(event)).toBe(false);
  });

  it("does not claim to authenticate the sender", () => {
    expect(isInbound({ kind: "message", text: "hi", from: "stranger" })).toBe(true);
  });
});
