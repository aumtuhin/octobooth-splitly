import { avatarDataUri } from "../lib/avatar";
import { cn } from "../lib/utils";

type Props = {
  style?: string | null;
  seed?: string | null;
  name?: string;
  size?: number;
  className?: string;
};

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ style, seed, name, size = 40, className }: Props) {
  const dimension = { width: size, height: size };

  if (style && seed) {
    return (
      <img
        src={avatarDataUri(style, seed)}
        alt={name ? `${name}'s avatar` : "avatar"}
        style={dimension}
        className={cn("rounded-full bg-surf object-cover", className)}
      />
    );
  }

  // Fallback: initials on an accent circle for users without a chosen avatar.
  return (
    <span
      style={{ ...dimension, fontSize: size * 0.4 }}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-aqua font-semibold text-ink",
        className
      )}
      aria-label={name ? `${name}'s avatar` : "avatar"}
    >
      {initials(name)}
    </span>
  );
}
