import { useEffect, useState } from 'react'
import type { DelayConfig, NodeConfig } from '../../types'
import { delayConfigSchema } from '../../utils/nodeConfigSchemas'
import { FieldError } from './NodeForm'

interface Props {
  config: NodeConfig
  onChange: (config: DelayConfig) => void
  errors?: Record<string, string[]>
}

export function DelayForm({ config, onChange, errors }: Props) {
  const c = config as DelayConfig
  const [seconds, setSeconds] = useState(c.seconds ?? 5)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setSeconds(c.seconds ?? 5)
  }, [c.seconds])

  const commit = (val: number) => {
    const result = delayConfigSchema.safeParse({ seconds: val })
    if (!result.success) {
      setLocalError(result.error.issues[0]?.message ?? 'Ошибка')
      return
    }
    setLocalError(null)
    onChange(result.data)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Задержка (секунды)</label>
      <input
        type="number"
        min={1}
        max={86400}
        value={seconds}
        onChange={(e) => setSeconds(parseInt(e.target.value, 10) || 1)}
        onBlur={() => commit(seconds)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <FieldError errors={localError ? [localError] : errors?.seconds} />
    </div>
  )
}
