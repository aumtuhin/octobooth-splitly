import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"]
      },
      // Colors are CSS-variable driven so they flip with the `.dark` class.
      // The `<alpha-value>` placeholder keeps opacity modifiers (e.g. bg-ink/10) working.
      colors: {
        shell: "rgb(var(--color-shell) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        surf: "rgb(var(--color-surf) / <alpha-value>)",
        peach: "rgb(var(--color-peach) / <alpha-value>)",
        aqua: "rgb(var(--color-aqua) / <alpha-value>)",
        sage: "rgb(var(--color-sage) / <alpha-value>)"
      },
      boxShadow: {
        panel: "0 10px 40px rgba(16,20,24,0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
