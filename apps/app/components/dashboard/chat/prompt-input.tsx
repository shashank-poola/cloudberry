"use client"

import Image from "next/image"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { ArrowUp, Image as ImageIcon, Paperclip, X } from "lucide-react"
import { type HostedModelId } from "@/api/chat/client"
import {
  CODEX_MODEL_PRESETS,
  CODEX_REASONING_EFFORT,
  type CodexModelId,
} from "@/api/codex/catalog"
import {
  MODELS,
  PLUGINS,
  PromptInputMenu,
  skillName,
  type CodexModelOption,
} from "./prompt-input-menu"
import styles from "./prompt-input.module.css"

export type PromptModelSelection =
  | { provider: "hosted"; model: HostedModelId }
  | {
      provider: "codex"
      model: CodexModelId
      reasoningEffort: typeof CODEX_REASONING_EFFORT
    }

const getEditorPrompt = (editor: HTMLDivElement) =>
  Array.from(editor.childNodes)
    .map((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const skill = (node as HTMLElement).dataset.skill
        if (skill) return `/${skillName(skill)}`
      }
      return node.textContent ?? ""
    })
    .join("")

type Attachment = { id: number; name: string; kind: "image" | "file" }

type PromptInputProps = {
  onSubmitAction?: (prompt: string, selection: PromptModelSelection) => void
  disabled?: boolean
  selectedModel?: HostedModelId
  onModelChangeAction?: (model: HostedModelId) => void
  codexConnected?: boolean
  codexChatEnabled?: boolean
  codexModels?: readonly CodexModelOption[]
  codexModelsLoading?: boolean
  selectedCodexModel?: CodexModelId
  onCodexModelChangeAction?: (model: CodexModelId) => void
  onConnectCodexAction?: () => void
}

export function PromptInput({
  onSubmitAction,
  disabled = false,
  selectedModel,
  onModelChangeAction,
  codexConnected = false,
  codexChatEnabled = codexConnected,
  codexModels,
  codexModelsLoading = false,
  selectedCodexModel = CODEX_MODEL_PRESETS[0].id,
  onCodexModelChangeAction,
  onConnectCodexAction,
}: PromptInputProps = {}) {
  // `value` mirrors the editor's prompt text. Skill pills display a branded
  // label but retain their slash-command marker when serialized.
  const [value, setValue] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [codexOpen, setCodexOpen] = useState(false)
  const [hoveredModel, setHoveredModel] = useState<string | null>(null)
  const [localModel, setLocalModel] = useState<HostedModelId>(MODELS[0].id)
  const model = selectedModel ?? localModel
  const [attachments, setAttachments] = useState<Attachment[]>([])
  // ids of chips currently playing their exit animation before removal
  const [exitingAtt, setExitingAtt] = useState<number[]>([])

  // Slash-command palette (typing "/" opens the same skill picker).
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")
  const [slashIndex, setSlashIndex] = useState(0)
  const [slashKeyboard, setSlashKeyboard] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const plusRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedRange = useRef<Range | null>(null)
  const nextId = useRef(1)
  const slashOpenRef = useRef(false)
  const slashIndexRef = useRef(0)
  const slashResultsRef = useRef<typeof PLUGINS>([])
  const slashQueryRef = useRef("")
  const slashTokenRef = useRef<{
    node: Text
    start: number
    end: number
  } | null>(null)
  const ignoreHoverRef = useRef(false)
  const slashKeyLock = useRef(false)

  const hasText = value.trim().length > 0
  const sendActive = hasText && !disabled
  const codexActive = codexConnected && codexChatEnabled
  const codexOptions = codexModels?.length ? codexModels : CODEX_MODEL_PRESETS
  const slashResults = PLUGINS.filter((plugin) =>
    plugin.name.toLowerCase().includes(slashQuery.toLowerCase())
  )

  useEffect(() => {
    slashOpenRef.current = slashOpen
    slashIndexRef.current = slashIndex
    slashResultsRef.current = slashResults
  }, [slashOpen, slashIndex, slashResults])

  const syncFromEditor = () => {
    const editor = editorRef.current
    if (!editor) return
    setValue(getEditorPrompt(editor))
    // Mark pills that sit at the very start (nothing but whitespace before them)
    // so CSS can drop their left margin - :first-child can't see text nodes.
    editor
      .querySelectorAll<HTMLElement>("." + styles.skillPill)
      .forEach((pill) => {
        let atStart = true
        for (let n = pill.previousSibling; n; n = n.previousSibling) {
          if (
            n.nodeType === Node.TEXT_NODE &&
            (n.textContent ?? "").trim() === ""
          )
            continue
          atStart = false
          break
        }
        pill.toggleAttribute("data-start", atStart)
      })
  }

  // Remember the last caret position so the "+" menu can insert at it even
  // after the editor loses focus.
  const saveSelection = () => {
    const editor = editorRef.current
    const sel = window.getSelection()
    if (sel && sel.rangeCount && editor && editor.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const closeSlash = () => {
    setSlashOpen(false)
    setSlashQuery("")
    setSlashIndex(0)
    setSlashKeyboard(false)
    slashQueryRef.current = ""
    slashTokenRef.current = null
    ignoreHoverRef.current = false
  }

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    setSkillsOpen(false)
    setCodexOpen(false)
    setHoveredModel(null)
  }, [])

  // Build a skill pill node (contenteditable=false so it deletes as a unit).
  const buildPill = (id: string) => {
    const plugin = PLUGINS.find((entry) => entry.id === id)
    const name = plugin?.name ?? id
    const el = document.createElement("span")
    el.className = styles.skillPill
    el.setAttribute("contenteditable", "false")
    el.dataset.skill = id

    const brand = document.createElement("span")
    brand.className = styles.skillPillBrand
    brand.setAttribute("aria-hidden", "true")
    if (plugin) {
      const image = document.createElement("img")
      image.src = plugin.logo
      image.alt = ""
      image.width = 12
      image.height = 12
      image.draggable = false
      image.className = styles.skillPillLogo
      brand.append(image)
    }

    const label = document.createElement("span")
    label.className = styles.skillPillLabel
    label.textContent = name

    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = styles.skillPillX
    remove.dataset.remove = "1"
    remove.setAttribute("aria-label", `Remove ${name} plugin`)

    const closeIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    )
    closeIcon.setAttribute("width", "11")
    closeIcon.setAttribute("height", "11")
    closeIcon.setAttribute("viewBox", "0 0 24 24")
    closeIcon.setAttribute("fill", "none")
    closeIcon.setAttribute("stroke", "currentColor")
    closeIcon.setAttribute("stroke-width", "1.5")
    closeIcon.setAttribute("stroke-linecap", "round")
    closeIcon.setAttribute("stroke-linejoin", "round")
    closeIcon.setAttribute("aria-hidden", "true")
    const closePath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    )
    closePath.setAttribute("d", "M18 6 6 18M6 6l12 12")
    closeIcon.append(closePath)
    remove.append(closeIcon)

    el.append(brand, label, remove)
    return el
  }

  // Replace `range` with a pill + trailing space, then park the caret after it.
  const insertPillOverRange = (range: Range, id: string) => {
    const editor = editorRef.current
    if (!editor) return
    range.deleteContents()
    const pill = buildPill(id)
    range.insertNode(pill)
    const space = document.createTextNode("\u00A0")
    pill.after(space)
    const after = document.createRange()
    after.setStartAfter(space)
    after.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(after)
    editor.focus()
    savedRange.current = after.cloneRange()
    syncFromEditor()
  }

  // Insert from the "+" menu: use the current/last caret, else append at end.
  const addSkillFromMenu = (id: string) => {
    const editor = editorRef.current
    if (!editor) return
    const sel = window.getSelection()
    let range: Range | null = null
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0).cloneRange()
    } else if (
      savedRange.current &&
      editor.contains(savedRange.current.startContainer)
    ) {
      range = savedRange.current.cloneRange()
    }
    if (!range) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    insertPillOverRange(range, id)
    closeMenu()
  }

  // Insert from a "/" command: swallow the typed "/query" then drop the pill.
  const applySlash = (id: string) => {
    const editor = editorRef.current
    if (!editor) {
      closeSlash()
      return
    }
    let range: Range | null = null
    const token = slashTokenRef.current
    if (
      token &&
      token.node.isConnected &&
      editor.contains(token.node) &&
      token.end <= (token.node.textContent?.length ?? 0)
    ) {
      range = document.createRange()
      range.setStart(token.node, token.start)
      range.setEnd(token.node, token.end)
    } else {
      const sel = window.getSelection()
      if (sel && sel.rangeCount) {
        const caret = sel.getRangeAt(0)
        range = caret.cloneRange()
        const node = caret.startContainer
        if (node.nodeType === Node.TEXT_NODE && editor.contains(node)) {
          const before = (node.textContent ?? "").slice(0, caret.startOffset)
          const m = before.match(/\/([^\s/]*)$/)
          if (m) {
            range = document.createRange()
            range.setStart(node, caret.startOffset - m[0].length)
            range.setEnd(node, caret.startOffset)
          }
        }
      }
    }
    if (!range) {
      closeSlash()
      return
    }
    insertPillOverRange(range, id)
    closeSlash()
  }

  // Open the palette when the caret sits right after a "/" token.
  const detectSlash = () => {
    const editor = editorRef.current
    const sel = window.getSelection()
    if (!editor || !sel || !sel.rangeCount || !sel.isCollapsed)
      return closeSlash()
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node))
      return closeSlash()
    const before = (node.textContent ?? "").slice(0, range.startOffset)
    const m = before.match(/(?:^|\s)\/([^\s/]*)$/)
    if (!m) return closeSlash()
    const q = m[1]
    const slashStart = before.length - m[1].length - 1
    slashTokenRef.current = {
      node: node as Text,
      start: slashStart,
      end: range.startOffset,
    }
    if (q !== slashQueryRef.current) {
      slashQueryRef.current = q
      setSlashIndex(0)
    }
    setSlashQuery(q)
    setSlashOpen(true)
  }

  const onEditorInput = () => {
    syncFromEditor()
    detectSlash()
  }

  const moveSlash = (delta: number) => {
    const results = slashResultsRef.current
    if (!results.length) return
    ignoreHoverRef.current = true
    setSlashKeyboard(true)
    setSlashIndex((i) => (i + delta + results.length * 10) % results.length)
  }

  const handleSlashKey = (e: {
    key: string
    preventDefault: () => void
    stopPropagation?: () => void
  }) => {
    const results = slashResultsRef.current
    if (!slashOpenRef.current || !results.length) return false
    if (
      e.key !== "ArrowDown" &&
      e.key !== "ArrowUp" &&
      e.key !== "Enter" &&
      e.key !== "Tab" &&
      e.key !== "Escape"
    ) {
      return false
    }
    e.preventDefault()
    e.stopPropagation?.()
    if (slashKeyLock.current) return true
    slashKeyLock.current = true
    queueMicrotask(() => {
      slashKeyLock.current = false
    })
    if (e.key === "ArrowDown") {
      moveSlash(1)
      return true
    }
    if (e.key === "ArrowUp") {
      moveSlash(-1)
      return true
    }
    if (e.key === "Enter" || e.key === "Tab") {
      applySlash((results[slashIndexRef.current] ?? results[0]).id)
      return true
    }
    if (e.key === "Escape") {
      closeSlash()
      return true
    }
    return false
  }

  const onEditorKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (handleSlashKey(e)) return
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const onEditorClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const remove = (e.target as HTMLElement).closest("[data-remove]")
    if (remove) {
      e.preventDefault()
      const pill = remove.closest<HTMLElement>("[data-skill]")
      if (pill) {
        // the separator space we inserted right after the pill - drop it too
        // on removal so leftover spaces can't accumulate and shift the next
        // pill out of alignment.
        const sep = pill.nextSibling
        // collapse the pill's footprint (width + margins + padding) in sync with
        // the fade so following text slides in smoothly instead of snapping.
        const w = pill.getBoundingClientRect().width
        pill.style.maxWidth = `${w}px`
        pill.style.overflow = "hidden"
        pill.style.whiteSpace = "nowrap"
        void pill.offsetWidth
        pill.style.transition =
          "max-width 180ms cubic-bezier(0.22,1,0.36,1), margin 180ms cubic-bezier(0.22,1,0.36,1), padding 180ms cubic-bezier(0.22,1,0.36,1)"
        // leave the same soft way the enhance pill arrives, then drop the node
        pill.setAttribute("data-exit", "")
        pill.style.maxWidth = "0px"
        pill.style.marginLeft = "0px"
        pill.style.marginRight = "0px"
        pill.style.paddingLeft = "0px"
        pill.style.paddingRight = "0px"
        let done = false
        const finish = () => {
          if (done) return
          done = true
          if (
            sep &&
            sep.nodeType === Node.TEXT_NODE &&
            sep.textContent?.startsWith("\u00A0")
          ) {
            const rest = sep.textContent.slice(1)
            if (rest) sep.textContent = rest
            else sep.parentNode?.removeChild(sep)
          }
          pill.remove()
          syncFromEditor()
          editorRef.current?.focus()
        }
        pill.addEventListener("animationend", finish, { once: true })
        setTimeout(finish, 220)
      }
      return
    }
    saveSelection()
  }

  // Dismiss the "+" menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (!plusRef.current?.contains(e.target as Node)) closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu()
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen, closeMenu])

  const send = () => {
    if (!sendActive) return
    const prompt = value.trim()
    if (!prompt) return

    onSubmitAction?.(
      prompt,
      codexActive
        ? {
            provider: "codex",
            model: selectedCodexModel,
            reasoningEffort: CODEX_REASONING_EFFORT,
          }
        : { provider: "hosted", model }
    )

    const editor = editorRef.current
    if (editor) editor.innerHTML = ""
    setValue("")
    setAttachments([])
    setExitingAtt([])
    closeSlash()
    requestAnimationFrame(() => editorRef.current?.focus())
  }

  // Play the same soft fade/scale exit as the skill pills, then drop the chip.
  const removeAttachment = (id: number) => {
    setExitingAtt((e) => (e.includes(id) ? e : [...e, id]))
    window.setTimeout(() => {
      setAttachments((a) => a.filter((x) => x.id !== id))
      setExitingAtt((e) => e.filter((x) => x !== id))
    }, 200)
  }

  const openPicker = (kind: Attachment["kind"]) => {
    const input = fileRef.current
    if (!input) return
    input.accept = kind === "image" ? "image/*" : ""
    input.value = ""
    input.dataset.kind = kind
    input.click()
    closeMenu()
  }

  const selectModel = (nextModel: HostedModelId) => {
    if (selectedModel === undefined) setLocalModel(nextModel)
    onModelChangeAction?.(nextModel)
    closeMenu()
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (!files.length) return
          const fallback =
            (e.target.dataset.kind as Attachment["kind"]) ?? "file"
          setAttachments((a) => [
            ...a,
            ...files.map((f) => ({
              id: nextId.current++,
              name: f.name,
              kind: f.type.startsWith("image/") ? ("image" as const) : fallback,
            })),
          ])
          e.target.value = ""
          requestAnimationFrame(() => editorRef.current?.focus())
        }}
      />

      <div ref={frameRef} className={styles.frame}>
        {attachments.length > 0 && (
          <div className={styles.chips}>
            {attachments.map((att) => (
              <span
                key={att.id}
                className={styles.chip}
                data-exit={exitingAtt.includes(att.id) || undefined}
              >
                <span className={styles.chipIcon}>
                  {att.kind === "image" ? (
                    <ImageIcon size={13} />
                  ) : (
                    <Paperclip size={13} />
                  )}
                </span>
                <span className={styles.chipName}>{att.name}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={"Remove " + att.name}
                  onClick={() => removeAttachment(att.id)}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.editorWrap}>
          <div
            ref={editorRef}
            className={styles.field}
            contentEditable={!disabled}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Ask Cloudberry anything..."
            aria-disabled={disabled}
            data-empty={!hasText || undefined}
            data-placeholder="Ask Cloudberry anything..."
            onInput={onEditorInput}
            onKeyDown={onEditorKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onBlur={saveSelection}
            onClick={onEditorClick}
          />

          {slashOpen && !disabled && (
            <div
              className={styles.slashMenu}
              role="listbox"
              aria-label="Plugins"
              data-keyboard={slashKeyboard || undefined}
              onMouseMove={() => {
                ignoreHoverRef.current = false
                if (slashKeyboard) setSlashKeyboard(false)
              }}
            >
              <div className={styles.slashLabel}>Plugins</div>
              {slashResults.length ? (
                slashResults.map((sk, i) => (
                  <button
                    key={sk.id}
                    type="button"
                    role="option"
                    aria-selected={i === slashIndex}
                    className={[
                      styles.menuItem,
                      i === slashIndex && styles.menuItemActive,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => {
                      if (ignoreHoverRef.current) return
                      setSlashIndex(i)
                    }}
                    onClick={() => applySlash(sk.id)}
                  >
                    <span className={styles.pluginBrand}>
                      <Image
                        src={sk.logo}
                        alt=""
                        width={14}
                        height={14}
                        className="size-3.5 rounded-[3px] object-contain"
                      />
                    </span>
                    <span className={styles.menuName}>{sk.name}</span>
                  </button>
                ))
              ) : (
                <div className={styles.slashEmpty}>No matching plugins</div>
              )}
            </div>
          )}
        </div>

        <div className={styles.row}>
          <PromptInputMenu
            plusRef={plusRef}
            menuOpen={menuOpen}
            skillsOpen={skillsOpen}
            codexOpen={codexOpen}
            hoveredModel={hoveredModel}
            model={model}
            codexConnected={codexConnected}
            codexActive={codexActive}
            codexOptions={codexOptions}
            codexModelsLoading={codexModelsLoading}
            selectedCodexModel={selectedCodexModel}
            onToggleMenu={() => {
              if (menuOpen) closeMenu()
              else setMenuOpen(true)
            }}
            onCloseMenu={closeMenu}
            onSkillsOpenChange={setSkillsOpen}
            onCodexOpenChange={setCodexOpen}
            onHoveredModelChange={setHoveredModel}
            onOpenPicker={openPicker}
            onAddSkill={addSkillFromMenu}
            onConnectCodex={() => onConnectCodexAction?.()}
            onModelSelect={selectModel}
            onCodexModelChange={(nextModel) =>
              onCodexModelChangeAction?.(nextModel)
            }
          />

          <div className={styles.right}>
            <button
              type="button"
              className={[
                styles.iconBtn,
                styles.send,
                sendActive && styles.sendActive,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Send"
              disabled={!sendActive}
              onClick={send}
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
