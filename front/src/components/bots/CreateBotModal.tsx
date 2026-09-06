import { type FormEvent, useState } from 'react'
import { Bot, Loader2, Plus, X } from 'lucide-react'
import { ApiError } from '../../api/client'
import { useCreateBot } from '../../api/hooks/useBots'
import { Button } from '../ui/Button'

interface CreateBotModalProps {
  open: boolean
  onClose: () => void
}

export function CreateBotModal({ open, onClose }: CreateBotModalProps) {
  const createBot = useCreateBot()
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return null
  }

  function handleClose() {
    if (createBot.isPending) return
    setError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedToken = token.trim()
    if (!trimmedToken) {
      setError('Укажите bot token от @BotFather')
      return
    }

    try {
      await createBot.mutateAsync({
        name: name.trim() || undefined,
        token: trimmedToken,
        is_active: true,
      })
      setName('')
      setToken('')
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось создать бота')
      }
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Новый бот</h2>
              <p className="text-sm text-gray-500">Подключите Telegram-бота по token</p>
            </div>
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
          <div>
            <label htmlFor="bot-name" className="block text-sm font-medium text-gray-700 mb-1">
              Название
            </label>
            <input
              id="bot-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мой бот (необязательно — подставится из Telegram)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="bot-token" className="block text-sm font-medium text-gray-700 mb-1">
              Bot token <span className="text-red-500">*</span>
            </label>
            <input
              id="bot-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:AAH..."
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Token из @BotFather. Проверяется через Telegram API перед сохранением.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
            После создания бот будет активен. Убедитесь, что запущены Redis и{' '}
            <code className="bg-amber-100 px-1 rounded">python manage.py runbot_supervisor</code>.
            Стартовый сценарий опубликуется автоматически.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={createBot.isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={createBot.isPending}>
              {createBot.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Создать и запустить
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
