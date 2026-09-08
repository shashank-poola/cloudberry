import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { StreamingText } from "./streaming-text"
import styles from "./message-markdown.module.css"

type MessageMarkdownProps = {
  children?: string
  isStreaming?: boolean
}

const markdownComponents: Components = {
  a: (props) => {
    const {
      node,
      children: linkChildren,
      href,
      ...linkProps
    } = props
    void node
    const isExternal = /^https?:\/\//i.test(href ?? "")

    return (
      <a
        {...linkProps}
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
      >
        {linkChildren}
      </a>
    )
  },
  table: ({ children: tableChildren }) => (
    <div className={styles.tableWrapper}>
      <table>{tableChildren}</table>
    </div>
  ),
}

function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {children}
    </ReactMarkdown>
  )
}

export function MessageMarkdown({
  children = "",
  isStreaming = false,
}: MessageMarkdownProps) {
  if (isStreaming) {
    return (
      <StreamingText
        text={children}
        renderAction={(shown) => (
          <div className={styles.prose}>
            <MarkdownContent>{shown}</MarkdownContent>
          </div>
        )}
      />
    )
  }

  return (
    <div className={styles.prose}>
      <MarkdownContent>{children}</MarkdownContent>
    </div>
  )
}
