"use client"

import { useState } from "react"
import {
  Activity01Icon,
  ArrowUpRight01Icon,
  LaptopMinimalIcon,
  TerminalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerStatus } from "./computer-status"

type ComputerTab = "screen" | "terminal" | "activity"

type Tab = {
  id: ComputerTab
  label: string
  icon: typeof LaptopMinimalIcon
}

const tabs: Tab[] = [
  { id: "screen", label: "Screen", icon: LaptopMinimalIcon },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "activity", label: "Activity", icon: Activity01Icon },
]

function ScreenPanel() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center sm:min-h-80">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.05] text-zinc-400">
        <HugeiconsIcon
          icon={LaptopMinimalIcon}
          size={25}
          color="currentColor"
          strokeWidth={1.4}
        />
      </span>
      <h3 className="mt-5 text-sm font-semibold text-zinc-200">
        Desktop preview unavailable
      </h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">
        Cloudberry runs Codex headlessly on the company computer. A live desktop
        preview can be connected later.
      </p>
    </div>
  )
}

function TerminalPanel() {
  return (
    <div className="min-h-72 bg-[#090909] px-5 py-5 font-mono text-xs leading-7 text-zinc-400 sm:min-h-80 sm:px-7 sm:py-6">
      <p className="text-zinc-300">$ codex</p>
      <p className="mt-2">
        <span className="text-emerald-400">✓</span> Prized.dev computer
        connected
      </p>
      <p>
        <span className="text-emerald-400">✓</span> Cloudberry knowledge
        available
      </p>
      <p className="mt-2 text-zinc-500">
        Ask a question from Chat to start a Codex session.
      </p>
      <p className="mt-2 text-zinc-300">$ waiting for work...</p>
      <span className="mt-1 inline-block h-4 w-1.5 animate-pulse bg-zinc-500 align-middle" />
    </div>
  )
}

function ActivityPanel() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center bg-[#090909] px-5 py-5 text-center sm:min-h-80 sm:px-7 sm:py-6">
      <p className="text-sm font-semibold text-zinc-300">No recent activity</p>
      <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">
        Codex session activity will appear here after you send a prompt.
      </p>
    </div>
  )
}

function ComputerPanel({ activeTab }: { activeTab: ComputerTab }) {
  if (activeTab === "screen") return <ScreenPanel />
  if (activeTab === "activity") return <ActivityPanel />
  return <TerminalPanel />
}

export function ComputerView() {
  const [activeTab, setActiveTab] = useState<ComputerTab>("terminal")

  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-10 lg:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
              Computer
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Your company&apos;s Prized.dev computer for Codex
            </p>
          </div>
          <ComputerStatus />
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.025]">
          <div className="flex items-center gap-1 border-b border-white/[0.08] px-2 py-2 sm:px-3">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
                    isActive
                      ? "bg-white/[0.1] text-zinc-100"
                      : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                  }`}
                >
                  <HugeiconsIcon
                    icon={tab.icon}
                    size={15}
                    color="currentColor"
                    strokeWidth={1.4}
                  />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <ComputerPanel activeTab={activeTab} />
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:px-5">
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              Prized.dev company computer
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Persistent Ubuntu environment with Codex CLI preinstalled. Your
              Codex authentication remains on the computer.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400">
            Codex
          </span>
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-600 uppercase">
                Next step
              </p>
              <p className="mt-3 text-sm font-medium text-zinc-200">
                Ask Cloudberry a question to start Codex.
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Cloudberry adds organization-scoped knowledge context before the
                prompt reaches your company computer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("terminal")}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-auto"
            >
              Open terminal
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
