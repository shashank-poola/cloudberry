/**
 * Temporary display fallbacks while the authenticated Codex model/list request
 * is loading. The server validates the selected model against that account's
 * live catalog before it executes a turn.
 */
export const CODEX_MODEL_PRESETS = [
  { id: "gpt-6-astra", name: "GPT-6-Astra" },
  { id: "gpt-5.6-sol", name: "GPT-5.6-Sol" },
  { id: "gpt-5.6-terra", name: "GPT-5.6-Terra" },
  { id: "gpt-5.6-luna", name: "GPT-5.6-Luna" },
  { id: "gpt-5.5", name: "GPT-5.5" },
  { id: "gpt-5.4-mini", name: "GPT-5.4-Mini" },
] as const

export type CodexModelId = string
export const CODEX_REASONING_EFFORT = "high" as const
