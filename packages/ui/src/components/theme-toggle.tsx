"use client";

import { useTheme } from "../theme-context";
import type { ThemePreference } from "../theme";
import { cx } from "./primitives";

const OPTIONS: { id: ThemePreference; label: string; path: string }[] = [
  {
    id: "light",
    label: "Light",
    path: "M8 1.5v2M8 12.5v2M2.6 2.6l1.4 1.4M12 12l1.4 1.4M1.5 8h2M12.5 8h2M2.6 13.4l1.4-1.4M12 4l1.4-1.4M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  },
  { id: "system", label: "System", path: "M2 3h12v8H2zM6 13.5h4M8 11v2.5" },
  { id: "dark", label: "Dark", path: "M13.5 9.5A6 6 0 1 1 6.5 2.5a5 5 0 0 0 7 7Z" },
];

/** Three-way light/system/dark control, shared by the site nav and the studio chrome. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex items-center gap-0.5 rounded-md border p-0.5 hairline">
      {OPTIONS.map((option) => {
        const active = option.id === preference;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            onClick={() => setPreference(option.id)}
            className={cx(
              "rounded p-1 transition-colors",
              active
                ? "bg-orange-500 text-white"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            )}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-3.5"
            >
              <path d={option.path} />
            </svg>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
