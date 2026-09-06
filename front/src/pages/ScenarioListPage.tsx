import { Link, useParams, useNavigate } from 'react-router-dom'
import { FileText, Loader2, AlertCircle, Edit3 } from 'lucide-react'
import { useBotScenarios, useCreateScenario } from '../api/hooks/useBots'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { AppLayout } from '../components/layout/AppLayout'

export function ScenarioListPage() {
  const { botId } = useParams<{ botId: string }>()
  const id = parseInt(botId ?? '0', 10)
  const { data: scenarios, isLoading, error } = useBotScenarios(id)
  const createScenario = useCreateScenario(id)
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-gray-600">Не удалось загрузить сценарии</p>
        <Link to="/" className="text-indigo-600 text-sm hover:underline">
          ← К списку ботов
        </Link>
      </div>
    )
  }

  return (
    <AppLayout
      title={`Сценарии бота #${id}`}
      backLink={{ to: '/', label: '← Все боты' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div />
        <Button
          size="sm"
          onClick={() => {
            const name = prompt('Имя нового сценария', 'Новый сценарий')
            if (!name) return
            createScenario.mutate(
              { name },
              {
                onSuccess: (data) => {
                  // navigate to editor for the newly created scenario
                  navigate(`/scenarios/${data.id}/edit`)
                },
              },
            )
          }}
        >
          Создать сценарий
        </Button>
      </div>

        {!scenarios?.length ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Сценариев пока нет</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <FileText className="w-8 h-8 text-indigo-500" />
                  <Badge variant={scenario.is_published ? 'published' : 'draft'}>
                    {scenario.is_published ? 'Опубликован' : 'Черновик'}
                  </Badge>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{scenario.name}</h3>
                <p className="text-sm text-gray-400 mb-4">Версия {scenario.version}</p>
                <Link to={`/scenarios/${scenario.id}/edit`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    <Edit3 className="w-4 h-4" />
                    Редактировать
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
    </AppLayout>
  )
}
