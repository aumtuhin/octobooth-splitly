// Builds a shareable "add me as a friend" link. Scanning the QR (or opening
// the link) lands on the app, which reads the `add` query param and sends a
// friend request to that username once the visitor is logged in.
//
// Uses the configured public web origin so the link is correct even when the
// profile is viewed inside the native app (where window.location.origin is a
// capacitor:// scheme that a phone camera can't open).
const PUBLIC_WEB_URL = import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined;

export const ADD_FRIEND_PARAM = "add";

function publicOrigin(): string {
  const base = PUBLIC_WEB_URL?.trim();
  if (base) return base.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function friendAddUrl(username: string): string {
  return `${publicOrigin()}/?${ADD_FRIEND_PARAM}=${encodeURIComponent(username)}`;
}
