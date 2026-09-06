import { useEffect, useState } from 'react'
import type { SubscenarioConfig, NodeConfig } from '../../types'
import { subscenarioConfigSchema } from '../../utils/nodeConfigSchemas'
import { FieldError } from './NodeForm'

interface Props {
  config: NodeConfig
  onChange: (config: SubscenarioConfig) => void
  errors?: Record<string, string[]>
}

export function SubscenarioForm({ config, onChange, errors }: Props) {
  const c = config as SubscenarioConfig
  const [scenarioId, setScenarioId] = useState(String(c.scenario_id ?? ''))
  const [returnKey, setReturnKey] = useState(c.return_node_key ?? '')

  useEffect(() => {
    setScenarioId(String(c.scenario_id ?? ''))
    setReturnKey(c.return_node_key ?? '')
  }, [c.scenario_id, c.return_node_key])

  const commit = () => {
    const result = subscenarioConfigSchema.safeParse({
      scenario_id: parseInt(scenarioId, 10) || 0,
      return_node_key: returnKey || undefined,
    })
    if (!result.success) return
    onChange(result.data)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ID сценария</label>
        <input
          type="number"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          onBlur={commit}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <FieldError errors={errors?.scenario_id} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ключ узла возврата (опционально)
        </label>
        <input
          value={returnKey}
          onChange={(e) => setReturnKey(e.target.value)}
          onBlur={commit}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="after_sub"
        />
      </div>
    </div>
  )
}
