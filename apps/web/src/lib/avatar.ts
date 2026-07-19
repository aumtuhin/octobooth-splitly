import { createAvatar, type Style } from "@dicebear/core";
import {
  funEmoji,
  bottts,
  adventurer,
  bigSmile,
  lorelei,
  notionists,
  openPeeps,
  thumbs,
  shapes,
  identicon
} from "@dicebear/collection";

// Style names (keep in sync with AVATAR_STYLES on the API — me.routes.ts).
export const AVATAR_STYLES = [
  "funEmoji",
  "bottts",
  "adventurer",
  "bigSmile",
  "lorelei",
  "notionists",
  "openPeeps",
  "thumbs",
  "shapes",
  "identicon"
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];

// Each collection has its own options type; we only ever use base options
// (seed, radius), so store them under one loose Style type to avoid TS trying
// to unify the incompatible per-style option shapes.
const styleImpls = {
  funEmoji,
  bottts,
  adventurer,
  bigSmile,
  lorelei,
  notionists,
  openPeeps,
  thumbs,
  shapes,
  identicon
} as unknown as Record<AvatarStyle, Style<Record<string, unknown>>>;

const STYLE_LABELS: Record<AvatarStyle, string> = {
  funEmoji: "Fun Emoji",
  bottts: "Robots",
  adventurer: "Adventurer",
  bigSmile: "Big Smile",
  lorelei: "Lorelei",
  notionists: "Notionists",
  openPeeps: "Peeps",
  thumbs: "Thumbs",
  shapes: "Shapes",
  identicon: "Identicon"
};

export function avatarStyleLabel(style: AvatarStyle): string {
  return STYLE_LABELS[style] ?? style;
}

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return typeof value === "string" && (AVATAR_STYLES as readonly string[]).includes(value);
}

/** Render a DiceBear avatar as an inline SVG data URI (no network calls). */
export function avatarDataUri(style: string, seed: string): string {
  const collection = isAvatarStyle(style) ? styleImpls[style] : styleImpls.funEmoji;
  return createAvatar(collection, { seed, radius: 50 }).toDataUri();
}

function randomSeed(): string {
  const a = ["taco", "disco", "ninja", "wizard", "pickle", "cosmic", "sneaky", "fluffy", "turbo", "mango"];
  const b = ["otter", "panda", "raptor", "muffin", "goblin", "comet", "noodle", "walrus", "pixel", "yeti"];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(a)}-${pick(b)}-${Math.floor(Math.random() * 1000)}`;
}

/** Pick a random style + seed for a fresh funny avatar. */
export function randomAvatar(): { style: AvatarStyle; seed: string } {
  const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
  return { style, seed: randomSeed() };
}
