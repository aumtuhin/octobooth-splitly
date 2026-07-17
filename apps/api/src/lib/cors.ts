import type { CorsOptions } from "cors";

// Production browser origins are provided via CORS_ALLOWED_ORIGINS
// (comma-separated). Local dev and the Capacitor mobile webviews are
// always allowed so those don't need to be configured per environment.
const explicitOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (explicitOrigins.includes(origin)) return true;
  // Local development on any localhost port (Vite dev server, previews).
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  // Capacitor native webviews: iOS uses capacitor://localhost, Android
  // defaults to https://localhost (already covered above).
  if (origin === "capacitor://localhost") return true;
  return false;
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Requests with no Origin header (native apps, curl, server-to-server,
    // health checks) are not subject to browser CORS — allow them through.
    if (!origin) return callback(null, true);
    // Allowed browser origins get CORS headers; anything else simply doesn't,
    // so the browser blocks it without us throwing a 500.
    return callback(null, isAllowedOrigin(origin));
  }
};
