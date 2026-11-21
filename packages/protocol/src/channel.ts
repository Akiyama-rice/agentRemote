import type { Decision, Risk } from "./types.ts";

// Round 1 defines only the approval card. Board and relay views come with their features.
export interface ItemView {
  kind: "item";
  itemId: string;
  title: string;
  body: string;
  risk: Risk;
  options: { action: string; label: string }[];
  reason?: string;
  final?: Decision;
}

export interface MessageRef {
  channelId: string;
  messageId: string;
}

export type Inbound =
  | { kind: "action"; target: string; action: string; text?: string; from: string }
  | { kind: "message"; text: string; from: string; replyTo?: MessageRef };

export type InboundSink = (event: Inbound) => Promise<void>;
export type ChannelCapability = "buttons" | "free-text" | "update-message";

export interface ChannelBinding {
  channelId: string;
  ownerId: string;
  data: Record<string, string>; // References only. Never store credentials here.
}

export interface SetupUI {
  showText(text: string): Promise<void>;
  showQrCode(url: string): Promise<void>;
}

export interface Channel {
  id: string;
  capabilities: ChannelCapability[];
  setup(ui: SetupUI): Promise<ChannelBinding>;
  start(binding: ChannelBinding, sink: InboundSink): Promise<void>;
  stop(): Promise<void>;
  send(view: ItemView): Promise<MessageRef>;
  update(ref: MessageRef, view: ItemView): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Shape validation is not authorization. The core must also compare from with ownerId.
export function isInbound(value: unknown): value is Inbound {
  if (!isRecord(value) || !isNonEmptyString(value.from)) return false;

  if (value.kind === "action") {
    return (
      isNonEmptyString(value.target) &&
      isNonEmptyString(value.action) &&
      (!("text" in value) || typeof value.text === "string")
    );
  }

  if (value.kind === "message") {
    if (typeof value.text !== "string") return false;
    if (!("replyTo" in value)) return true;
    return (
      isRecord(value.replyTo) &&
      isNonEmptyString(value.replyTo.channelId) &&
      isNonEmptyString(value.replyTo.messageId)
    );
  }

  return false;
}
