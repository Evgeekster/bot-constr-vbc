import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { MenuConfig, MenuButton, NodeConfig, Transition } from '../../types'
import { menuConfigSchema } from '../../utils/nodeConfigSchemas'
import { useDeleteTransition } from '../../api/hooks/useTransitions'
import { FieldError } from './NodeForm'
import { Button } from '../ui/Button'

interface Props {
  nodeId: number
  config: NodeConfig
  transitions: Transition[]
  onChange: (config: MenuConfig) => void
  onTransitionChange: () => void
  errors?: Record<string, string[]>
  scenarioId: number
}

export function MenuForm({
  nodeId,
  config,
  transitions,
  onChange,
  onTransitionChange,
  scenarioId,
}: Props) {
  const c = config as MenuConfig
  const [text, setText] = useState(c.text ?? '')
  const [buttons, setButtons] = useState<MenuButton[]>(c.buttons ?? [])
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  const deleteTransition = useDeleteTransition(scenarioId)

  useEffect(() => {
    setText(c.text ?? '')
    setButtons(c.buttons ?? [])
  }, [c.text, c.buttons])

  const commit = async (next: MenuConfig) => {
    const result = menuConfigSchema.safeParse(next)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.issues.forEach((i) => {
        errs[i.path.join('.')] = i.message
      })
      setLocalErrors(errs)
      return
    }
    setLocalErrors({})
    onChange(result.data)

    const outgoing = transitions.filter((t) => t.from_node === nodeId && t.trigger === 'callback')
    const newCallbacks = new Set(result.data.buttons.map((b) => b.callback))

    for (const btn of result.data.buttons) {
      const exists = outgoing.find((t) => t.trigger_value === btn.callback)
      if (!exists && scenarioId > 0) {
        // Transition without target — user will connect on canvas
        // Only create placeholder if we have a default target from renaming
      }
    }

    for (const t of outgoing) {
      if (t.trigger_value && !newCallbacks.has(t.trigger_value)) {
        if (scenarioId > 0) {
          await deleteTransition.mutateAsync(t.id)
          onTransitionChange()
        }
      }
    }
  }

  const updateButton = (index: number, field: keyof MenuButton, value: string) => {
    const next = buttons.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    setButtons(next)
  }

  const addButton = () => {
    const next = [...buttons, { text: `Кнопка ${buttons.length + 1}`, callback: `btn_${buttons.length + 1}` }]
    setButtons(next)
    commit({ text, buttons: next })
  }

  const removeButton = (index: number) => {
    const next = buttons.filter((_, i) => i !== index)
    setButtons(next)
    commit({ text, buttons: next })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Текст меню</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit({ text, buttons })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Кнопки</label>
          <Button variant="ghost" size="sm" onClick={addButton}>
            <Plus className="w-4 h-4" />
            Добавить
          </Button>
        </div>
        <div className="space-y-3">
          {buttons.map((btn, i) => {
            const hasTransition = transitions.some(
              (t) =>
                t.from_node === nodeId &&
                t.trigger === 'callback' &&
                t.trigger_value === btn.callback,
            )
            return (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <input
                  value={btn.text}
                  onChange={(e) => updateButton(i, 'text', e.target.value)}
                  onBlur={() => commit({ text, buttons })}
                  placeholder="Текст кнопки"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  value={btn.callback}
                  onChange={(e) => updateButton(i, 'callback', e.target.value)}
                  onBlur={() => commit({ text, buttons })}
                  placeholder="callback_data"
                  className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {!hasTransition && (
                  <p className="text-xs text-amber-600">⚠ Нет исходящего перехода — протяните связь с канваса</p>
                )}
                <button
                  type="button"
                  onClick={() => removeButton(i)}
                  className="text-xs text-red-600 flex items-center gap-1 hover:text-red-800"
                >
                  <Trash2 className="w-3 h-3" />
                  Удалить
                </button>
              </div>
            )
          })}
        </div>
        <FieldError errors={localErrors.buttons ? [localErrors.buttons] : undefined} />
      </div>
    </div>
  )
}
