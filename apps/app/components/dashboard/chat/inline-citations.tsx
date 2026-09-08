import type { ChatCitation } from "@/api/chat/client"
import styles from "./inline-citations.module.css"

type InlineCitationsProps = {
  citations: ChatCitation[]
}

function citationTypeLabel(type: string) {
  return (
    type
      .split(/[._-]+/g)
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
      .join(" ") || "Company source"
  )
}

function shortId(value: string) {
  if (value.length <= 20) return value
  return `${value.slice(0, 8)}…${value.slice(-8)}`
}

function citationDescription(citation: ChatCitation) {
  return `${citationTypeLabel(citation.type)} · result ID ${citation.resultId} · source event ID ${citation.sourceEventId}`
}

export function InlineCitations({ citations }: InlineCitationsProps) {
  if (!citations.length) return null

  return (
    <div className={styles.citeProse}>
      <p className={styles.summary}>
        Grounded in {citations.length} company knowledge{" "}
        {citations.length === 1 ? "source" : "sources"}.
      </p>
      <div className={styles.citeFooter} aria-label="Sources">
        {citations.map((citation, index) => {
          const description = citationDescription(citation)
          return (
            <div className={styles.citeRef} key={`${citation.sourceEventId}:${citation.resultId}`}>
              <span
                className={styles.citeTip}
                tabIndex={0}
                aria-label={`Source ${index + 1}: ${description}`}
              >
                <span className={styles.citeMark} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.citeTipBox} role="tooltip">
                  {description}
                </span>
              </span>
              <span className={styles.citeRefLabel}>
                {citationTypeLabel(citation.type)}
              </span>
              <span className={styles.citeSep} aria-hidden="true">
                ·
              </span>
              <span
                className={styles.citeRefId}
                title={`Result ID: ${citation.resultId}`}
              >
                {shortId(citation.resultId)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
