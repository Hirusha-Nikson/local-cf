export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "local-cf:theme";

/**
 * Runs via <Script strategy="beforeInteractive"> in both root layouts, before
 * React hydrates. Without this the page paints in the wrong scheme for a
 * frame (or, for a user who picked dark against a light OS, stays wrong until
 * the ThemeProvider effect runs).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var m=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",m==="dark");document.documentElement.style.colorScheme=m;}catch(e){}})();`;

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function loadThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}
