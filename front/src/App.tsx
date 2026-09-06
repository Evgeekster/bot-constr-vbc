import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequireAuth } from './components/auth/RequireAuth'
import { BotListPage } from './pages/BotListPage'
import { LoginPage } from './pages/LoginPage'
import { ScenarioListPage } from './pages/ScenarioListPage'
import { ScenarioEditorPage } from './pages/ScenarioEditorPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<BotListPage />} />
            <Route path="/bots/:botId/scenarios" element={<ScenarioListPage />} />
            <Route path="/scenarios/:scenarioId/edit" element={<ScenarioEditorPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
