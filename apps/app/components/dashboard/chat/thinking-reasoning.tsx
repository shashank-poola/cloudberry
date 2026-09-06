"use client"

import styles from "./thinking-reasoning.module.css"

export function ThinkingReasoning() {
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <span className={styles.label}>Thinking…</span>
    </div>
  )
}
