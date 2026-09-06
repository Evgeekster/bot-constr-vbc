import { useRef, useEffect } from 'react'
import { Send, RotateCcw } from 'lucide-react'
import type { ScenarioNode, Transition } from '../../types'
import {
  useChatSimulator,
  processNodeStep,
  handleUserInput,
} from '../../store/editorStore'
import { START_NODE_KEY } from '../../utils/graphUtils'
import { Button } from '../ui/Button'

interface Props {
  nodes: ScenarioNode[]
  transitions: Transition[]
}

export function TestChatPanel({ nodes, transitions }: Props) {
  const {
    messages,
    waitingForInput,
    reset,
    addBotMessage,
    addUserMessage,
    setContext,
    setCurrentNode,
    setWaitingForInput,
    currentNodeId,
  } = useChatSimulator()

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const startNode = nodes.find((n) => n.key === START_NODE_KEY)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const runFromNode = async (nodeId: number) => {
    let currentId: number | null = nodeId

    while (currentId !== null) {
      const node = nodes.find((n) => n.id === currentId)
      if (!node) break

      setCurrentNode(currentId)
      const step = processNodeStep(node, transitions, useChatSimulator.getState().context)

      for (const msg of step.messages) {
        addBotMessage(msg)
      }

      if (step.waitingForInput) {
        setWaitingForInput(step.waitingForInput)
        return
      }

      if (step.delayMs) {
        await new Promise((r) => setTimeout(r, Math.min(step.delayMs!, 3000)))
      }

      currentId = step.nextNodeId
    }

    setWaitingForInput(null)
    setCurrentNode(null)
  }

  const handleStart = () => {
    if (!startNode) return
    reset(startNode.id)
    runFromNode(startNode.id)
  }

  const handleUserSend = (text: string, type: 'text' | 'callback' = 'text') => {
    if (!currentNodeId) return
    const node = nodes.find((n) => n.id === currentNodeId)
    if (!node) return

    addUserMessage(type === 'callback' ? `[${text}]` : text)

    if (node.type === 'question' && type === 'text') {
      const config = node.config as { var_name?: string }
      if (config.var_name) {
        setContext(config.var_name, text)
      }
    }

    const nextId = handleUserInput(node, transitions, text, type)
    setWaitingForInput(null)

    if (nextId) {
      runFromNode(nextId)
    } else {
      addBotMessage({ text: '⚠ Нет подходящего перехода' })
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">Тестовый прогон</h3>
        <Button variant="ghost" size="sm" onClick={handleStart} disabled={!startNode}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Нажмите ↺ чтобы начать прогон с start
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.text}
              {msg.buttons && (
                <div className="mt-2 space-y-1">
                  {msg.buttons.map((btn) => (
                    <button
                      key={btn.callback}
                      type="button"
                      disabled={waitingForInput !== 'callback'}
                      onClick={() => handleUserSend(btn.callback, 'callback')}
                      className="block w-full text-left px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-800 text-xs hover:bg-gray-50 disabled:opacity-50"
                    >
                      {btn.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {waitingForInput === 'text' && (
        <form
          className="p-3 border-t border-gray-200 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const val = inputRef.current?.value.trim()
            if (val) {
              handleUserSend(val, 'text')
              if (inputRef.current) inputRef.current.value = ''
            }
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Введите ответ..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <Button type="submit" size="sm">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}
    </div>
  )
}
