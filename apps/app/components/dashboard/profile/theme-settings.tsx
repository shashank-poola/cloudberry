"use client"

import {
  IconMoon,
  IconSun,
  IconSunMoon,
  type TablerIcon,
} from "@tabler/icons-react"
import {
  useTheme,
  type ThemePreference,
} from "@/components/dashboard/theme-provider"

type ThemeOption = {
  value: ThemePreference
  label: string
  description: string
  icon: TablerIcon
}

const themeOptions: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright appearance",
    icon: IconSun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Low-light appearance",
    icon: IconMoon,
  },
  {
    value: "system",
    label: "System",
    description: "Follow your device",
    icon: IconSunMoon,
  },
]

export function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="mt-10 border-t border-white/[0.08] pt-8">
      <h3 className="text-sm font-semibold text-zinc-200">Appearance</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        Choose how Cloudberry looks in this browser.
      </p>
      <div
        className="mt-5 grid max-w-xl grid-cols-3 gap-1 rounded-xl border border-white/[0.1] bg-white/[0.025] p-1"
        role="radiogroup"
        aria-label="Theme preference"
      >
        {themeOptions.map((option) => {
          const isSelected = option.value === theme
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(option.value)}
              className={`flex min-w-0 flex-col items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
                isSelected
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
              }`}
            >
              <Icon size={18} stroke={2} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">
                  {option.label}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-current opacity-70">
                  {option.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
