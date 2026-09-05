import { useState } from "react"
import {
  Activity01Icon,
  ArrowUpRight01Icon,
  CpuIcon,
  Database01Icon,
  LaptopMinimalIcon,
  ServerStack01Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

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

const recentActivity = [
  { time: "18:42", label: "Updated Cloudpedia" },
  { time: "18:41", label: "Read #engineering" },
  { time: "18:38", label: "Created Linear issue" },
  { time: "17:54", label: "Indexed 12 new messages" },
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
      <p className="mt-2 text-xs text-zinc-500">
        Cloudberry is running headless. A live desktop preview can be connected
        with noVNC later.
      </p>
    </div>
  )
}

function TerminalPanel() {
  return (
    <div className="min-h-72 bg-[#090909] px-5 py-5 font-mono text-xs leading-7 text-zinc-400 sm:min-h-80 sm:px-7 sm:py-6">
      <p className="text-zinc-300">$ cloudberry-agent</p>
      <p className="mt-2">
        <span className="text-emerald-400">✓</span> Slack connected
      </p>
      <p>
        <span className="text-emerald-400">✓</span> Linear connected
      </p>
      <p className="mt-2 text-zinc-500">18:41&nbsp; received Slack event</p>
      <p className="text-zinc-500">18:41&nbsp; updating Cloudpedia</p>
      <p className="text-zinc-500">
        18:42&nbsp; linked discussion → Authentication V2
      </p>
      <p className="mt-2 text-zinc-300">$ waiting for work...</p>
      <span className="mt-1 inline-block h-4 w-1.5 animate-pulse bg-zinc-500 align-middle" />
    </div>
  )
}

function ActivityPanel() {
  return (
    <div className="min-h-72 bg-[#090909] px-5 py-5 sm:min-h-80 sm:px-7 sm:py-6">
      <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-zinc-600 uppercase">
        Recent activity
      </p>
      <div className="divide-y divide-white/[0.06]">
        {recentActivity.map((item) => (
          <div
            key={`${item.time}-${item.label}`}
            className="flex items-center gap-5 py-2.5 font-mono text-xs"
          >
            <time className="text-zinc-600">{item.time}</time>
            <span className="text-zinc-300">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComputerPanel({ activeTab }: { activeTab: ComputerTab }) {
  if (activeTab === "screen") return <ScreenPanel />
  if (activeTab === "activity") return <ActivityPanel />
  return <TerminalPanel />
}

type MachineStatProps = {
  label: string
  value: string
  icon: typeof CpuIcon
}

function MachineStat({ label, value, icon }: MachineStatProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3">
      <div className="flex items-center gap-2 text-zinc-600">
        <HugeiconsIcon
          icon={icon}
          size={15}
          color="currentColor"
          strokeWidth={1.4}
        />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  )
}

export function ComputerView() {
  const [activeTab, setActiveTab] = useState<ComputerTab>("terminal")

  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-10 lg:py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
              Computer
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Cloudberry&apos;s always-on computer
            </p>
            <p className="mt-1 text-xs text-zinc-600">Running for 2d 14h</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Online
          </div>
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
            <p className="text-sm font-semibold text-zinc-100">cloudberry-01</p>
            <p className="mt-1 text-xs text-zinc-500">
              Ubuntu 24.04 · 2 vCPU · 4 GB RAM · 50 GB storage · Singapore
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400">
            Ubuntu
          </span>
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-600 uppercase">
                Current task
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Cloudberry is caught up.
              </div>
              <p className="mt-1 pl-3.5 text-xs text-zinc-600">
                Last activity 4 minutes ago
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-auto"
            >
              View activity
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-zinc-200">Machine stats</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MachineStat label="CPU" value="14%" icon={CpuIcon} />
            <MachineStat
              label="Memory"
              value="2.1 / 4 GB"
              icon={ServerStack01Icon}
            />
            <MachineStat
              label="Storage"
              value="18 / 50 GB"
              icon={Database01Icon}
            />
            <MachineStat label="Uptime" value="2d 14h" icon={Activity01Icon} />
            <MachineStat
              label="Region"
              value="Singapore"
              icon={LaptopMinimalIcon}
            />
          </div>
        </div>

        <div className="mt-8 pb-8">
          <h3 className="text-sm font-semibold text-zinc-200">
            Recent activity
          </h3>
          <div className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.08]">
            {recentActivity.map((item) => (
              <div
                key={`summary-${item.time}-${item.label}`}
                className="flex items-center gap-5 py-3 text-sm"
              >
                <time className="w-12 shrink-0 font-mono text-xs text-zinc-600">
                  {item.time}
                </time>
                <span className="text-zinc-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
