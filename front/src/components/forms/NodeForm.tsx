import { useState } from 'react'
import type { ScenarioNode, NodeConfig } from '../../types'
import { MessageForm } from './MessageForm'
import { QuestionForm } from './QuestionForm'
import { MenuForm } from './MenuForm'
import { ConditionForm } from './ConditionForm'
import { ActionForm } from './ActionForm'
import { SubscenarioForm } from './SubscenarioForm'
import { DelayForm } from './DelayForm'
import { NODE_TYPE_META, START_NODE_KEY } from '../../utils/graphUtils'
import { getConfigSchema } from '../../utils/nodeConfigSchemas'
import type { Transition } from '../../types'
import { Button } from '../ui/Button'
import { Trash2 } from 'lucide-react'

interface NodeFormProps {
  node: ScenarioNode
  transitions: Transition[]
  scenarioId: number
  onUpdate: (config: NodeConfig, key?: string) => void
  onDelete: () => void
  onTransitionChange: () => void
  apiErrors?: Record<string, string[]>
}

export function NodeForm({
  node,
  transitions,
  scenarioId,
  onUpdate,
  onDelete,
  onTransitionChange,
  apiErrors,
}: NodeFormProps) {
  const [nodeKey, setNodeKey] = useState(node.key)
  const meta = NODE_TYPE_META[node.type]
  const isStart = node.key === START_NODE_KEY

  const handleKeyBlur = () => {
    if (nodeKey !== node.key && nodeKey.trim()) {
      onUpdate(node.config, nodeKey.trim())
    }
  }

  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>({})

  // Debounce config updates coming from child forms so we don't call the API on every keystroke
  const debouncedOnUpdate = (() => {
    // simple debounce using setTimeout inside closure
    let timeout: ReturnType<typeof setTimeout> | null = null
    return (config: NodeConfig, key?: string) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        // client-side validate before calling backend
        try {
          const schema = getConfigSchema(node.type)
          const r = schema.safeParse(config)
          if (!r.success) {
            const fe: Record<string, string> = {}
            for (const issue of r.error.issues) {
              if (issue.path && issue.path.length > 0) {
                fe[issue.path.join('.')] = issue.message
              } else {
                fe._ = issue.message
              }
            }
            setLocalFieldErrors(fe)
            return
          }
        } catch (e) {
          // no schema — proceed
        }

        setLocalFieldErrors({})
        onUpdate(config, key)
      }, 600)
    }
  })()

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className={`text-xs font-semibold uppercase ${meta.color}`}>{meta.label}</div>
        <div className="mt-2">
          <label className="block text-xs text-gray-500 mb-1">Ключ узла</label>
          <input
            type="text"
            value={nodeKey}
            onChange={(e) => setNodeKey(e.target.value)}
            onBlur={handleKeyBlur}
            disabled={isStart}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
          />
          {isStart && (
            <p className="text-xs text-gray-400 mt-1">Стартовый узел нельзя переименовать</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {node.type === 'message' && (
          <MessageForm
            config={node.config}
            onChange={(config) => debouncedOnUpdate(config)}
            errors={{ ...apiErrors, ...localFieldErrors }}
          />
        )}
        {node.type === 'question' && (
          <QuestionForm
            config={node.config}
            onChange={(config) => debouncedOnUpdate(config)}
            errors={{ ...apiErrors, ...localFieldErrors }}
          />
        )}
        {node.type === 'menu' && (
          <MenuForm
            nodeId={node.id}
            scenarioId={scenarioId}
            config={node.config}
            transitions={transitions}
            onChange={(config) => debouncedOnUpdate(config)}
            onTransitionChange={onTransitionChange}
            errors={apiErrors}
          />
        )}
        {node.type === 'condition' && (
          <ConditionForm
            nodeId={node.id}
            scenarioId={scenarioId}
            transitions={transitions}
            onTransitionChange={onTransitionChange}
            apiErrors={apiErrors}
          />
        )}
        {node.type === 'action' && (
          <ActionForm
            config={node.config}
            onChange={(config) => debouncedOnUpdate(config)}
            errors={apiErrors}
          />
        )}
        {node.type === 'subscenario' && (
          <SubscenarioForm
            config={node.config}
            onChange={(config) => debouncedOnUpdate(config)}
            errors={apiErrors}
          />
        )}
        {node.type === 'delay' && (
          <DelayForm
            config={node.config}
            onChange={(config) => debouncedOnUpdate(config)}
            errors={apiErrors}
          />
        )}
      </div>

      {!isStart && (
        <div className="p-4 border-t border-gray-200">
          <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
            Удалить узел
          </Button>
        </div>
      )}
    </div>
  )
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <p className="text-xs text-red-600 mt-1">{errors.join(', ')}</p>
}

export { FieldError }
