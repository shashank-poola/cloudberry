"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import styles from "./streaming-text.module.css"

type StreamingTextProps = {
  text: string
  renderAction?: (shown: string) => ReactNode
}

export function StreamingText({
  text,
  renderAction,
}: StreamingTextProps) {
  const [shown, setShown] = useState("")

  useEffect(() => {
    let index = 0
    const resetFrame = window.requestAnimationFrame(() => setShown(""))

    if (!text.length) {
      return () => window.cancelAnimationFrame(resetFrame)
    }

    const id = window.setInterval(() => {
      index += 2
      setShown(text.slice(0, index))
      if (index >= text.length) window.clearInterval(id)
    }, 9)

    return () => {
      window.cancelAnimationFrame(resetFrame)
      window.clearInterval(id)
    }
  }, [text])

  const isStreaming = shown.length < text.length

  return (
    <div className={styles.root} aria-busy={isStreaming}>
      {renderAction ? renderAction(shown) : shown}
    </div>
  )
}
