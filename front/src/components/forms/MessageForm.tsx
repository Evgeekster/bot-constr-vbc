import { useEffect, useState } from 'react'
import type { MessageConfig, NodeConfig } from '../../types'
import { messageConfigSchema } from '../../utils/nodeConfigSchemas'
import { FieldError } from './NodeForm'
import { Button } from '../ui/Button'

interface Props {
  config: NodeConfig
  onChange: (config: MessageConfig) => void
  errors?: Record<string, string[]>
}

export function MessageForm({ config, onChange, errors }: Props) {
  const c = config as MessageConfig
  const [text, setText] = useState(c.text ?? '')
  const [mediaUrl, setMediaUrl] = useState(c.media_url ?? '')
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setText(c.text ?? '')
    setMediaUrl(c.media_url ?? '')
  }, [c.text, c.media_url])

  const commit = (next: MessageConfig) => {
    const result = messageConfigSchema.safeParse(next)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      commit({ text, media_url: mediaUrl || undefined })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Текст сообщения</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit({ text, media_url: mediaUrl || undefined })}
          onKeyDown={handleKeyDown}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Привет! Добро пожаловать..."
        />
        <FieldError errors={errors?.text ? [errors.text.join(', ')] : localErrors.text ? [localErrors.text] : undefined} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL медиа (опционально)</label>
        <input
          type="url"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          onBlur={() => commit({ text, media_url: mediaUrl || undefined })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="https://..."
        />
        <FieldError errors={localErrors.media_url ? [localErrors.media_url] : undefined} />
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => commit({ text, media_url: mediaUrl || undefined })}>
          Сохранить
        </Button>
      </div>
    </div>
  )
}
