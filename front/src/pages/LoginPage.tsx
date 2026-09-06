import { type FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Bot, Loader2, LogIn } from 'lucide-react'
import { ApiError, ensureCsrfCookie } from '../api/client'
import { useCurrentUser, useLogin } from '../api/hooks/useAuth'
import { Button } from '../components/ui/Button'

export function LoginPage() {
  const navigate = useNavigate()
  const { data: user, isLoading: authLoading } = useCurrentUser()
  const login = useLogin()

  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureCsrfCookie().catch(() => {
      // Backend may be offline during dev; login will retry CSRF.
    })
  }, [])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login.mutateAsync({ username, password })
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось войти. Проверьте, что backend запущен.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 mb-4">
            <Bot className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Конструктор ботов</h1>
          <p className="text-gray-500 mt-1">Войдите, чтобы редактировать сценарии</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4"
        >
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Логин
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            Войти
          </Button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Демо:{' '}
          <code className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">demo</code>
          {' / '}
          <code className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">demo1234</code>
          {' · '}
          <code className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">python manage.py seed_demo</code>
        </p>
      </div>
    </div>
  )
}
