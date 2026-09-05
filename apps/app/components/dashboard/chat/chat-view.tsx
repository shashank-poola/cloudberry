"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { PromptInput } from "./prompt-input"
import styles from "./chat-view.module.css"

type ChatViewProps = {
  displayName: string
}

function getFirstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "there"
}

function getLocalGreeting() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      ...(timeZone ? { timeZone } : {}),
    })
      .formatToParts(new Date())
      .find((part) => part.type === "hour")?.value
  )

  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function ChatView({ displayName }: ChatViewProps) {
  const [greeting, setGreeting] = useState("Hello")

  useEffect(() => {
    // Resolve after hydration so the greeting follows the viewer's timezone.
    const frame = window.requestAnimationFrame(() => {
      setGreeting(getLocalGreeting())
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-4xl flex-1 -translate-y-14 flex-col items-center justify-center px-5 py-16 sm:-translate-y-16 sm:px-8">
        <div className="mb-7 flex flex-col items-center text-center sm:mb-8">
          <Image
            src="/white_cloudberry_logo.png"
            alt=""
            width={52}
            height={52}
            className="mb-5 size-12 object-contain opacity-90"
            priority
          />
          <h2 className="text-[clamp(2rem,4vw,3rem)] leading-none font-medium tracking-[-0.055em] text-zinc-100">
            {greeting}, {getFirstName(displayName)}!
          </h2>
        </div>

        <div
          data-theme="dark"
          className={`${styles.composer} w-full max-w-160`}
        >
          <PromptInput />
        </div>
      </div>
    </section>
  )
}
