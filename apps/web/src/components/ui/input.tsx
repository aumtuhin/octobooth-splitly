import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-ink/20 bg-surf px-3 text-sm text-ink outline-none transition focus:border-ink/60",
        props.className
      )}
    />
  );
}
