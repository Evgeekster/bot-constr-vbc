import { type FormEvent, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { ApiError } from '../../api/client'
import { useCreateNode } from '../../api/hooks/useNodes'
import { Button } from '../ui/Button'
import { getDefaultConfig, getConfigSchema } from '../../utils/nodeConfigSchemas'
import type { NodeType } from '../../types'

interface CreateNodeModalProps {
  open: boolean
  onClose: () => void
  scenarioId: number
  type: NodeType
  keyName: string
  position: { x: number; y: number }
  onCreated?: () => void
}

export function CreateNodeModal({ open, onClose, scenarioId, type, keyName, position, onCreated }: CreateNodeModalProps) {
  const createNode = useCreateNode(scenarioId)
  const [config, setConfig] = useState<Record<string, any>>(getDefaultConfig(type))
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [varDirty, setVarDirty] = useState(false)

  // auto-populate var_name while user types prompt, unless they've edited var_name themselves
  function generateVarNameFromPrompt(promptVal: string) {
    let guess = promptVal
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
    if (!guess || /^[0-9]/.test(guess)) guess = `v_${guess}`
    return guess.slice(0, 30)
  }

  if (!open) return null

  function handleClose() {
    if (createNode.isPending) return
    setError(null)
    setFieldErrors({})
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // validate using zod schema for this type
    try {
      // If question var_name is empty, attempt to auto-generate a valid var_name from prompt
      if (type === 'question') {
        const promptVal = (config.prompt as string) ?? ''
        const varVal = (config.var_name as string) ?? ''
        if (!varVal && promptVal) {
          // make ascii-lower, replace non-alnum/underscore with underscore
          let guess = promptVal
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
          // if starts with digit or empty, prefix 'v'
          if (!guess || /^[0-9]/.test(guess)) guess = `v_${guess}`
          // limit length
          guess = guess.slice(0, 30)
          config = { ...config, var_name: guess }
        }
      }

      const schema = getConfigSchema(type)
      const r = schema.safeParse(config)
      if (!r.success) {
        const z = r.error
        const fe: Record<string, string> = {}
        for (const issue of z.issues) {
          if (issue.path && issue.path.length > 0) {
            fe[issue.path.join('.')] = issue.message
          } else {
            fe._ = issue.message
          }
        }
        setFieldErrors(fe)
        return
      }
    } catch (err) {
      // schema not defined or other error — fall through
    }

    try {
      await createNode.mutateAsync({ key: keyName, type, config, position })
      onClose()
      if (onCreated) onCreated()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось создать узел')
      }
    }
  }

  // Render simple form fields for common config props based on type
  function renderFields() {
    switch (type) {
      case 'message':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Текст</label>
            <textarea
              value={(config.text as string) ?? ''}
              onChange={(e) => setConfig({ ...config, text: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={4}
            />
            {fieldErrors.text && (
              <p className="text-sm text-red-600 mt-1">{fieldErrors.text}</p>
            )}
          </div>
        )
      case 'question':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Вопрос (prompt)</label>
              <input
                type="text"
                value={(config.prompt as string) ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setConfig({ ...config, prompt: v })
                  if (!varDirty && type === 'question') {
                    setConfig((c) => ({ ...c, var_name: generateVarNameFromPrompt(v) }))
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {fieldErrors.prompt && (
                <p className="text-sm text-red-600 mt-1">{fieldErrors.prompt}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Имя переменной (var_name)</label>
              <input
                type="text"
                value={(config.var_name as string) ?? ''}
                onChange={(e) => {
                  setVarDirty(true)
                  setConfig({ ...config, var_name: e.target.value })
                }}
                placeholder="answer_var"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {fieldErrors.var_name && (
                <p className="text-sm text-red-600 mt-1">{fieldErrors.var_name}</p>
              )}
            </div>
          </>
        )
      case 'menu':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Текст меню</label>
            <input
              type="text"
              value={(config.text as string) ?? ''}
              onChange={(e) => setConfig({ ...config, text: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {fieldErrors.text && <p className="text-sm text-red-600 mt-1">{fieldErrors.text}</p>}
          </div>
        )
      default:
        return <div className="text-sm text-gray-500">Нет дополнительных полей для этого типа.</div>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        aria-label="Закрыть"
      />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Новый узел — {type}</h2>
            <p className="text-sm text-gray-500">Ключ узла: {keyName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {renderFields()}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={createNode.isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={createNode.isPending}>
              {createNode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
