import { useEffect, useState } from 'react'
import type { ActionConfig, NodeConfig } from '../../types'
import { actionConfigSchema } from '../../utils/nodeConfigSchemas'
import { FieldError } from './NodeForm'

interface Props {
  config: NodeConfig
  onChange: (config: ActionConfig) => void
  errors?: Record<string, string[]>
}

export function ActionForm({ config, onChange, errors }: Props) {
  const c = config as ActionConfig
  const [url, setUrl] = useState(c.url ?? '')
  const [method, setMethod] = useState<'GET' | 'POST'>(c.method ?? 'GET')
  const [bodyTemplate, setBodyTemplate] = useState(
    JSON.stringify(c.body_template ?? {}, null, 2),
  )
  const [resultMapping, setResultMapping] = useState(
    JSON.stringify(c.result_mapping ?? {}, null, 2),
  )
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    setUrl(c.url ?? '')
    setMethod(c.method ?? 'GET')
    setBodyTemplate(JSON.stringify(c.body_template ?? {}, null, 2))
    setResultMapping(JSON.stringify(c.result_mapping ?? {}, null, 2))
  }, [c.url, c.method, c.body_template, c.result_mapping])

  const commit = () => {
    let body: Record<string, unknown> | undefined
    let mapping: Record<string, string>

    try {
      body = method === 'POST' ? JSON.parse(bodyTemplate) : undefined
      mapping = JSON.parse(resultMapping)
      setJsonError(null)
    } catch {
      setJsonError('Некорректный JSON')
      return
    }

    const result = actionConfigSchema.safeParse({
      url,
      method,
      body_template: body,
      result_mapping: mapping,
    })
    if (!result.success) return
    onChange(result.data)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={commit}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="https://api.example.com/webhook"
        />
        <FieldError errors={errors?.url} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Метод</label>
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as 'GET' | 'POST')
            setTimeout(commit, 0)
          }}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </div>
      {method === 'POST' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Body template
            <span className="text-xs text-gray-400 ml-1">{'{{context.var}}'}</span>
          </label>
          <textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            onBlur={commit}
            rows={5}
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Result mapping (JSON)</label>
        <textarea
          value={resultMapping}
          onChange={(e) => setResultMapping(e.target.value)}
          onBlur={commit}
          rows={4}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder='{"response.name": "user_name"}'
        />
      </div>
      {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
    </div>
  )
}
