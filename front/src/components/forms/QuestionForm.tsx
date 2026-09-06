import { useEffect, useState } from 'react'
import type { QuestionConfig, NodeConfig } from '../../types'
import { questionConfigSchema } from '../../utils/nodeConfigSchemas'
import { FieldError } from './NodeForm'

interface Props {
  config: NodeConfig
  onChange: (config: QuestionConfig) => void
  errors?: Record<string, string[]>
}

export function QuestionForm({ config, onChange }: Props) {
  const c = config as QuestionConfig
  const [prompt, setPrompt] = useState(c.prompt ?? '')
  const [varName, setVarName] = useState(c.var_name ?? '')
  const [validation, setValidation] = useState<'any' | 'number' | 'phone' | 'email'>(c.validation ?? 'any')
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setPrompt(c.prompt ?? '')
    setVarName(c.var_name ?? '')
    setValidation(c.validation ?? 'any')
  }, [c.prompt, c.var_name, c.validation])

  const commit = (next: QuestionConfig) => {
    const result = questionConfigSchema.safeParse(next)
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
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Текст вопроса</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => commit({ prompt, var_name: varName, validation })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <FieldError errors={localErrors.prompt ? [localErrors.prompt] : undefined} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Имя переменной</label>
        <input
          value={varName}
          onChange={(e) => setVarName(e.target.value)}
          onBlur={() => commit({ prompt, var_name: varName, validation })}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="user_name"
        />
        <FieldError errors={localErrors.var_name ? [localErrors.var_name] : undefined} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Валидация</label>
        <select
          value={validation}
          onChange={(e) => {
            const v = e.target.value as 'any' | 'number' | 'phone' | 'email'
            setValidation(v)
            commit({ prompt, var_name: varName, validation: v })
          }}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="any">Любой текст</option>
          <option value="number">Число</option>
          <option value="phone">Телефон</option>
          <option value="email">Email</option>
        </select>
      </div>
    </div>
  )
}
