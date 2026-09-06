import { create } from 'zustand'
import type { ScenarioNode, Transition } from '../types'

interface EditorState {
  selectedNodeId: number | null
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  showTestChat: boolean
  setSelectedNodeId: (id: number | null) => void
  setDirty: (dirty: boolean) => void
  setSaving: (saving: boolean) => void
  setLastSavedAt: (date: Date | null) => void
  setShowTestChat: (show: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedNodeId: null,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  showTestChat: false,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setSaving: (saving) => set({ isSaving: saving }),
  setLastSavedAt: (date) => set({ lastSavedAt: date }),
  setShowTestChat: (show) => set({ showTestChat: show }),
}))

export interface ChatMessage {
  role: 'bot' | 'user'
  text: string
  buttons?: { text: string; callback: string }[]
}

export interface ChatSimulatorState {
  currentNodeId: number | null
  context: Record<string, unknown>
  messages: ChatMessage[]
  waitingForInput: 'text' | 'callback' | null
  reset: (startNodeId: number) => void
  addBotMessage: (msg: Omit<ChatMessage, 'role'>) => void
  addUserMessage: (text: string) => void
  setContext: (key: string, value: unknown) => void
  setCurrentNode: (nodeId: number | null) => void
  setWaitingForInput: (type: 'text' | 'callback' | null) => void
}

export const useChatSimulator = create<ChatSimulatorState>((set) => ({
  currentNodeId: null,
  context: {},
  messages: [],
  waitingForInput: null,
  reset: (startNodeId) =>
    set({
      currentNodeId: startNodeId,
      context: {},
      messages: [],
      waitingForInput: null,
    }),
  addBotMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, { role: 'bot', ...msg }],
    })),
  addUserMessage: (text) =>
    set((s) => ({
      messages: [...s.messages, { role: 'user', text }],
    })),
  setContext: (key, value) =>
    set((s) => ({ context: { ...s.context, [key]: value } })),
  setCurrentNode: (nodeId) => set({ currentNodeId: nodeId }),
  setWaitingForInput: (type) => set({ waitingForInput: type }),
}))

export function evaluateCondition(
  expr: string,
  context: Record<string, unknown>,
): boolean {
  try {
    const fn = new Function('context', `return (${expr})`)
    return Boolean(fn(context))
  } catch {
    return false
  }
}

export function processNodeStep(
  node: ScenarioNode,
  transitions: Transition[],
  context: Record<string, unknown>,
): {
  messages: Omit<ChatMessage, 'role'>[]
  nextNodeId: number | null
  waitingForInput: 'text' | 'callback' | null
  delayMs?: number
} {
  const config = node.config as Record<string, unknown>

  switch (node.type) {
    case 'message':
      return {
        messages: [{ text: (config.text as string) || '' }],
        nextNodeId: pickDefaultNext(node.id, transitions),
        waitingForInput: null,
      }

    case 'question':
      return {
        messages: [{ text: (config.prompt as string) || '' }],
        nextNodeId: null,
        waitingForInput: 'text',
      }

    case 'menu': {
      const buttons = (config.buttons as { text: string; callback: string }[]) ?? []
      return {
        messages: [
          {
            text: (config.text as string) || '',
            buttons: buttons.map((b) => ({ text: b.text, callback: b.callback })),
          },
        ],
        nextNodeId: null,
        waitingForInput: 'callback',
      }
    }

    case 'condition': {
      const outgoing = transitions
        .filter((t) => t.from_node === node.id)
        .sort((a, b) => a.priority - b.priority)

      for (const t of outgoing) {
        if (t.trigger === 'condition' && t.condition_expr) {
          if (evaluateCondition(t.condition_expr, context)) {
            return { messages: [], nextNodeId: t.to_node, waitingForInput: null }
          }
        }
      }
      const fallback = outgoing.find((t) => t.trigger === 'always')
      return {
        messages: [],
        nextNodeId: fallback?.to_node ?? null,
        waitingForInput: null,
      }
    }

    case 'action':
      return {
        messages: [{ text: `[HTTP ${config.method}] ${config.url}` }],
        nextNodeId: pickDefaultNext(node.id, transitions),
        waitingForInput: null,
      }

    case 'subscenario':
      return {
        messages: [{ text: `[Подсценарий #${config.scenario_id}]` }],
        nextNodeId: pickDefaultNext(node.id, transitions),
        waitingForInput: null,
      }

    case 'delay':
      return {
        messages: [{ text: `⏳ Пауза ${config.seconds} сек.` }],
        nextNodeId: pickDefaultNext(node.id, transitions),
        waitingForInput: null,
        delayMs: ((config.seconds as number) ?? 1) * 1000,
      }

    default:
      return { messages: [], nextNodeId: null, waitingForInput: null }
  }
}

function pickDefaultNext(nodeId: number, transitions: Transition[]): number | null {
  const t = transitions.find((tr) => tr.from_node === nodeId && tr.trigger === 'always')
  if (t) return t.to_node
  const any = transitions.find((tr) => tr.from_node === nodeId)
  return any?.to_node ?? null
}

export function handleUserInput(
  node: ScenarioNode,
  transitions: Transition[],
  input: string,
  inputType: 'text' | 'callback',
): number | null {
  if (inputType === 'callback' && node.type === 'menu') {
    const t = transitions.find(
      (tr) =>
        tr.from_node === node.id &&
        tr.trigger === 'callback' &&
        tr.trigger_value === input,
    )
    return t?.to_node ?? null
  }

  if (inputType === 'text' && node.type === 'question') {
    const t = transitions.find((tr) => tr.from_node === node.id)
    return t?.to_node ?? null
  }

  if (inputType === 'text') {
    const t = transitions.find(
      (tr) =>
        tr.from_node === node.id &&
        tr.trigger === 'text' &&
        tr.trigger_value &&
        new RegExp(tr.trigger_value).test(input),
    )
    return t?.to_node ?? null
  }

  return null
}
