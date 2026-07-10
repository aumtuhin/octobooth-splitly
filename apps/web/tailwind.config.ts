import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"]
      },
      colors: {
        shell: "#f6f5f0",
        ink: "#101418",
        surf: "#faf9f5",
        peach: "#f5b487",
        aqua: "#7ec9c3",
        sage: "#91b489"
      },
      boxShadow: {
        panel: "0 10px 40px rgba(16,20,24,0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
