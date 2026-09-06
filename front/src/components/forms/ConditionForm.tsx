import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Transition } from '../../types'
import { useCreateTransition, useUpdateTransition, useDeleteTransition } from '../../api/hooks/useTransitions'
import { Button } from '../ui/Button'
import { FieldError } from './NodeForm'

interface Props {
  nodeId: number
  transitions: Transition[]
  onTransitionChange: () => void
  apiErrors?: Record<string, string[]>
  scenarioId: number
}

export function ConditionForm({
  nodeId,
  transitions,
  onTransitionChange,
  apiErrors,
  scenarioId,
}: Props) {
  const outgoing = transitions
    .filter((t) => t.from_node === nodeId)
    .sort((a, b) => a.priority - b.priority)

  const conditionRules = outgoing.filter((t) => t.trigger === 'condition')
  const fallback = outgoing.find((t) => t.trigger === 'always')

  const createTransition = useCreateTransition(scenarioId)
  const updateTransition = useUpdateTransition(scenarioId)
  const deleteTransition = useDeleteTransition(scenarioId)

  const [exprErrors, setExprErrors] = useState<Record<number, string>>({})

  const addRule = async () => {
    if (scenarioId <= 0) return
    const priority = conditionRules.length
    await createTransition.mutateAsync({
      from_node: nodeId,
      to_node: nodeId,
      trigger: 'condition',
      condition_expr: 'context.var == "value"',
      priority,
    })
    onTransitionChange()
  }

  const addFallback = async () => {
    if (scenarioId <= 0 || fallback) return
    await createTransition.mutateAsync({
      from_node: nodeId,
      to_node: nodeId,
      trigger: 'always',
      priority: 9999,
    })
    onTransitionChange()
  }

  const updateExpr = async (t: Transition, expr: string) => {
    try {
      await updateTransition.mutateAsync({ id: t.id, condition_expr: expr })
      setExprErrors((e) => {
        const next = { ...e }
        delete next[t.id]
        return next
      })
      onTransitionChange()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка валидации'
      setExprErrors((e) => ({ ...e, [t.id]: message }))
    }
  }

  const removeRule = async (id: number) => {
    await deleteTransition.mutateAsync(id)
    onTransitionChange()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Правила проверяются по приоритету. Добавьте fallback «иначе» для случая, когда ни одно условие не выполнилось.
      </p>

      <div className="space-y-3">
        {conditionRules.map((t, i) => (
          <div key={t.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-orange-700">Правило {i + 1}</span>
              <button
                type="button"
                onClick={() => removeRule(t.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              defaultValue={t.condition_expr ?? ''}
              onBlur={(e) => updateExpr(t, e.target.value)}
              placeholder='context.age >= 18'
              className="w-full px-2 py-1.5 text-sm font-mono border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <FieldError
              errors={
                exprErrors[t.id]
                  ? [exprErrors[t.id]]
                  : apiErrors?.condition_expr
                    ? apiErrors.condition_expr
                    : undefined
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Целевой узел: {t.to_node === nodeId ? '— не задан, протяните связь' : `#${t.to_node}`}
            </p>
          </div>
        ))}
      </div>

      <Button variant="secondary" size="sm" onClick={addRule}>
        <Plus className="w-4 h-4" />
        Добавить правило
      </Button>

      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Fallback (иначе)</span>
          {!fallback && (
            <Button variant="ghost" size="sm" onClick={addFallback}>
              <Plus className="w-4 h-4" />
              Добавить
            </Button>
          )}
        </div>
        {fallback ? (
          <p className="text-xs text-gray-500">
            Переход «иначе» → узел #{fallback.to_node === nodeId ? '— не задан' : fallback.to_node}
          </p>
        ) : (
          <p className="text-xs text-amber-600">⚠ Fallback обязателен для публикации</p>
        )}
      </div>
    </div>
  )
}
