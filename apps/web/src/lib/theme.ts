import { useCallback, useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "splitly_theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Theme state persisted via Capacitor Preferences (localStorage on web).
 * Applies the resolved theme to <html> and follows system changes when set to "system".
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  // Load the stored preference on mount.
  useEffect(() => {
    Preferences.get({ key: THEME_KEY }).then(({ value }) => {
      const stored = (value as Theme) ?? "system";
      setThemeState(stored);
      applyTheme(stored);
    });
  }, []);

  // React to OS theme changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    void Preferences.set({ key: THEME_KEY, value: next });
  }, []);

  return { theme, setTheme };
}
