"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "../theme-context";
import type { ThemePreference } from "../theme";
import { cx } from "./primitives";

const OPTIONS: { id: ThemePreference; label: string; icon: LucideIcon }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
];

/** Three-way light/system/dark control, shared by the site nav and the studio chrome. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    // Outer radius = inner radius + padding, so the corners stay concentric.
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-lg p-0.5 ring ring-line"
    >
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
              "rounded-md p-1.5",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active ? "bg-tint text-fg-strong" : "text-fg-subtle hover:bg-tint hover:text-fg",
            )}
          >
            <option.icon aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
