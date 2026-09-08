"use client"

import Image from "next/image"
import type { RefObject } from "react"
import {
  Check,
  ChevronRight,
  Image as ImageIcon,
  Paperclip,
  Plug,
  Plus,
} from "lucide-react"
import type { HostedModelId } from "@/api/chat/client"
import { type CodexModelId } from "@/api/codex/catalog"
import styles from "./prompt-input.module.css"

export const MODELS = [
  {
    id: "gpt-oss-120b",
    name: "gpt-oss-120b",
    desc: "Open-source hosted model for grounded company knowledge answers.",
    context: "Cloudberry company context included",
  },
  {
    id: "minimax-m2.7",
    name: "minimax-m2.7",
    desc: "Open-source hosted model for grounded company knowledge answers.",
    context: "Cloudberry company context included",
  },
] as const satisfies readonly {
  id: HostedModelId
  name: string
  desc: string
  context: string
}[]

export const PLUGINS = [
  { id: "slack", name: "Slack", logo: "/plugins/slack.webp" },
  { id: "linear", name: "Linear", logo: "/plugins/linear.webp" },
  { id: "github", name: "GitHub", logo: "/plugins/github.png" },
]

export const skillName = (id: string) =>
  PLUGINS.find((plugin) => plugin.id === id)?.name ?? id

export type CodexModelOption = { id: CodexModelId; name: string }

type PromptInputMenuProps = {
  plusRef: RefObject<HTMLDivElement | null>
  menuOpen: boolean
  skillsOpen: boolean
  codexOpen: boolean
  hoveredModel: string | null
  model: HostedModelId
  codexConnected: boolean
  codexActive: boolean
  codexOptions: readonly CodexModelOption[]
  codexModelsLoading: boolean
  selectedCodexModel: CodexModelId
  onToggleMenu: () => void
  onCloseMenu: () => void
  onSkillsOpenChange: (open: boolean) => void
  onCodexOpenChange: (open: boolean) => void
  onHoveredModelChange: (model: string | null) => void
  onOpenPicker: (kind: "image" | "file") => void
  onAddSkill: (id: string) => void
  onConnectCodex: () => void
  onModelSelect: (model: HostedModelId) => void
  onCodexModelChange: (model: CodexModelId) => void
}

function ModelIcon({ id }: { id: string }) {
  if (id === "codex") {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m8 5-5 7 5 7" />
        <path d="m16 5 5 7-5 7" />
        <path d="m14 4-4 16" />
      </svg>
    )
  }
  if (id.startsWith("gpt")) {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 320 320"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z" />
      </svg>
    )
  }
  if (id.startsWith("claude")) {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 100 100"
        fill="#d97757"
        aria-hidden="true"
      >
        <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" />
      </svg>
    )
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 8.016A8.522 8.522 0 0 0 8.016 16h-.032A8.521 8.521 0 0 0 0 8.016v-.032A8.521 8.521 0 0 0 7.984 0h.032A8.522 8.522 0 0 0 16 7.984v.032z"
        fill="url(#pi-gemini-grad)"
      />
      <defs>
        <radialGradient
          id="pi-gemini-grad"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(16.1326 5.4553 -43.70045 129.2322 1.588 6.503)"
        >
          <stop offset=".067" stopColor="#9168C0" />
          <stop offset=".343" stopColor="#5684D1" />
          <stop offset=".672" stopColor="#1BA1E3" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export function PromptInputMenu({
  plusRef,
  menuOpen,
  skillsOpen,
  codexOpen,
  hoveredModel,
  model,
  codexConnected,
  codexActive,
  codexOptions,
  codexModelsLoading,
  selectedCodexModel,
  onToggleMenu,
  onCloseMenu,
  onSkillsOpenChange,
  onCodexOpenChange,
  onHoveredModelChange,
  onOpenPicker,
  onAddSkill,
  onConnectCodex,
  onModelSelect,
  onCodexModelChange,
}: PromptInputMenuProps) {
  return (
    <div className={styles.plusWrap} ref={plusRef}>
      <button
        type="button"
        className={[styles.iconBtn, styles.plus].join(" ")}
        data-open={menuOpen || undefined}
        aria-label="Add attachment or switch model"
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
      >
        <span className={styles.plusIcon}>
          <Plus size={14} />
        </span>
      </button>

      {menuOpen && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => onOpenPicker("image")}
          >
            <span className={styles.menuIcon}>
              <ImageIcon size={14} />
            </span>
            <span className={styles.menuName}>Add photos</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => onOpenPicker("file")}
          >
            <span className={styles.menuIcon}>
              <Paperclip size={14} />
            </span>
            <span className={styles.menuName}>Attach files</span>
          </button>
          <div className={styles.menuDivider} />
          <div
            className={styles.menuSub}
            onMouseEnter={() => onSkillsOpenChange(true)}
            onMouseLeave={() => onSkillsOpenChange(false)}
          >
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              aria-haspopup="menu"
              aria-expanded={skillsOpen}
              onClick={() => onSkillsOpenChange(true)}
            >
              <span className={styles.menuIcon}>
                <Plug size={14} />
              </span>
              <span className={styles.menuName}>Plugins</span>
              <span className={styles.menuChevron}>
                <ChevronRight size={14} />
              </span>
            </button>
            {skillsOpen && (
              <div
                className={styles.menuFlyout}
                role="menu"
                aria-label="Plugins"
              >
                <div className={styles.menuFlyoutScroll}>
                  {PLUGINS.map((plugin) => (
                    <button
                      key={plugin.id}
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => onAddSkill(plugin.id)}
                    >
                      <span className={styles.pluginBrand}>
                        <Image
                          src={plugin.logo}
                          alt=""
                          width={14}
                          height={14}
                          className="size-3.5 rounded-[3px] object-contain"
                        />
                      </span>
                      <span className={styles.menuName}>{plugin.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div
            className={styles.menuSub}
            onMouseEnter={() => {
              if (codexActive) onCodexOpenChange(true)
            }}
            onMouseLeave={() => onCodexOpenChange(false)}
          >
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              aria-haspopup={codexActive ? "menu" : undefined}
              aria-expanded={codexActive ? codexOpen : undefined}
              onClick={() => {
                if (!codexConnected) {
                  onCloseMenu()
                  onConnectCodex()
                  return
                }
                if (codexActive) onCodexOpenChange(!codexOpen)
              }}
            >
              <span className={styles.pluginBrand}>
                <Image
                  src="/plugins/codex.png"
                  alt=""
                  width={14}
                  height={14}
                  className="size-3.5 object-contain"
                />
              </span>
              <span className={styles.menuName}>Codex</span>
              {codexConnected ? (
                <>
                  <span className={styles.menuCheck}>
                    <Check size={14} />
                  </span>
                  {codexActive ? (
                    <span className={styles.menuChevron}>
                      <ChevronRight size={14} />
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-[10px] text-zinc-500">Connect</span>
              )}
            </button>
            {codexActive && codexOpen ? (
              <div
                className={`${styles.menuFlyout} ${styles.codexFlyout}`}
                role="menu"
                aria-label="Codex model presets"
              >
                <div className={styles.menuFlyoutScroll}>
                  <div className={styles.menuLabel}>Codex model presets</div>
                  {codexOptions.map((codexModel) => (
                    <button
                      key={codexModel.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedCodexModel === codexModel.id}
                      className={styles.menuItem}
                      onClick={() => {
                        onCodexModelChange(codexModel.id)
                        onCloseMenu()
                      }}
                    >
                      <span className={styles.pluginBrand}>
                        <Image
                          src="/plugins/codex.png"
                          alt=""
                          width={14}
                          height={14}
                          className="size-3.5 object-contain"
                        />
                      </span>
                      <span className={styles.menuName}>
                        {codexModel.name}
                      </span>
                      {selectedCodexModel === codexModel.id ? (
                        <span className={styles.menuCheck}>
                          <Check size={14} />
                        </span>
                      ) : null}
                    </button>
                  ))}
                  <div className={styles.codexNote}>
                    Reasoning effort: <strong>High</strong>
                    <br />
                    Model access follows your connected Codex account.
                    {codexModelsLoading ? (
                      <>
                        <br />
                        Loading live models…
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {!codexConnected ? (
            <>
              <div className={styles.menuDivider} />
              <div className={styles.menuLabel}>Model</div>
              {MODELS.map((modelOption) => (
                <div
                  key={modelOption.id}
                  className={styles.menuSub}
                  onMouseEnter={() => onHoveredModelChange(modelOption.id)}
                  onMouseLeave={() => onHoveredModelChange(null)}
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={model === modelOption.id}
                    className={styles.menuItem}
                    onClick={() => onModelSelect(modelOption.id)}
                  >
                    <span className={styles.menuBrand}>
                      <ModelIcon id={modelOption.id} />
                    </span>
                    <span className={styles.menuName}>{modelOption.name}</span>
                    {model === modelOption.id && (
                      <span className={styles.menuCheck}>
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                  {hoveredModel === modelOption.id && (
                    <div className={styles.menuPopover} role="tooltip">
                      <div className={styles.popoverTitle}>{modelOption.name}</div>
                      <p className={styles.popoverDesc}>{modelOption.desc}</p>
                      <div className={styles.popoverMeta}>
                        {modelOption.context}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
