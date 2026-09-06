import type { ReactNode } from 'react'
import { Bot, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser, useLogout } from '../../api/hooks/useAuth'
import { Button } from '../ui/Button'

interface AppLayoutProps {
  children: ReactNode
  title?: string
  backLink?: { to: string; label: string }
}

export function AppLayout({ children, title, backLink }: AppLayoutProps) {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            {backLink && (
              <Link
                to={backLink.to}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                {backLink.label}
              </Link>
            )}
            <div className="flex items-center gap-3">
              <Bot className="w-7 h-7 text-indigo-600 shrink-0" />
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {title ?? 'Конструктор Telegram-ботов'}
              </h1>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-gray-500 hidden sm:inline">{user.username}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
                disabled={logout.isPending}
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
