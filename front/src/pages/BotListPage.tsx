import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, ChevronRight, Loader2, AlertCircle, Plus, Trash2, Play, Square } from 'lucide-react'
import { useBots, useDeleteBot, useUpdateBot } from '../api/hooks/useBots'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { AppLayout } from '../components/layout/AppLayout'
import { CreateBotModal } from '../components/bots/CreateBotModal'
import { ApiError } from '../api/client'

export function BotListPage() {
  const { data: bots, isLoading, error } = useBots()
  const deleteBot = useDeleteBot()
  const updateBot = useUpdateBot()
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error) {
    const isAuthError = error instanceof ApiError && (error.status === 401 || error.status === 403)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-gray-600">
          {isAuthError ? 'Требуется авторизация' : 'Не удалось загрузить список ботов'}
        </p>
        {!isAuthError && <p className="text-sm text-gray-400">{(error as Error).message}</p>}
        {isAuthError && (
          <Link to="/login" className="text-indigo-600 text-sm hover:underline">
            Войти
          </Link>
        )}
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Боты</h2>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          Добавить бота
        </Button>
      </div>

      {!bots?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Ботов пока нет</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Добавить первого бота
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Имя
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Статус
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bots.map((bot) => (
                <tr key={bot.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-indigo-600" />
                      </div>
                      <span className="font-medium text-gray-900">{bot.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={bot.is_active ? 'active' : 'inactive'}>
                      {bot.is_active ? 'Активен' : 'Выключен'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/bots/${bot.id}/scenarios`}>
                        <Button variant="secondary" size="sm">
                          Открыть сценарии
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>

                      <Button
                        size="sm"
                        variant={bot.is_active ? 'secondary' : 'primary'}
                        onClick={() => {
                          const newState = !bot.is_active
                          updateBot.mutate({ botId: bot.id, patch: { is_active: newState } })
                        }}
                        disabled={updateBot.isLoading}
                      >
                        {bot.is_active ? (
                          <>
                            <Square className="w-4 h-4 mr-2" /> Остановить
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" /> Запустить
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          // simple confirmation
                          // eslint-disable-next-line no-restricted-globals
                          if (confirm(`Удалить бота "${bot.name}"? Это действие нельзя отменить.`)) {
                            deleteBot.mutate(bot.id)
                          }
                        }}
                        disabled={deleteBot.isLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateBotModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </AppLayout>
  )
}
