import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../client'
import type { Bot, CreateBotPayload, Scenario, ScenarioSummary } from '../../types'

export const botKeys = {
  all: ['bots'] as const,
  detail: (id: number) => ['bots', id] as const,
  scenarios: (botId: number) => ['bots', botId, 'scenarios'] as const,
}

export const scenarioKeys = {
  all: ['scenarios'] as const,
  detail: (id: number) => ['scenarios', id] as const,
}

export function useBots() {
  return useQuery({
    queryKey: botKeys.all,
    // DRF returns paginated responses like { results: [...] } — unwrap if present
    queryFn: async () => {
      const data = await apiFetch<Bot[] | { results: Bot[] }>('/api/bots/')
      // If backend used pagination, return the results array, otherwise return the array directly
      return Array.isArray(data) ? data : data.results
    },
  })
}

export function useCreateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBotPayload) =>
      apiFetch<Bot>('/api/bots/', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botKeys.all })
    },
  })
}

export function useDeleteBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (botId: number) =>
      apiFetch<void>(`/api/bots/${botId}/`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botKeys.all })
    },
  })
}

export function useUpdateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, patch }: { botId: number; patch: Partial<Bot> }) =>
      apiFetch<Bot>(`/api/bots/${botId}/`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botKeys.all })
    },
  })
}

export function useBotScenarios(botId: number) {
  return useQuery({
    queryKey: botKeys.scenarios(botId),
    queryFn: async () => {
      const data = await apiFetch<ScenarioSummary[] | { results: ScenarioSummary[] }>(
        `/api/bots/${botId}/scenarios/`,
      )
      return Array.isArray(data) ? data : data.results
    },
    enabled: botId > 0,
  })
}

export function useScenario(scenarioId: number) {
  return useQuery({
    queryKey: scenarioKeys.detail(scenarioId),
    queryFn: () => apiFetch<Scenario>(`/api/scenarios/${scenarioId}/`),
    enabled: scenarioId > 0,
  })
}

export function useUpdateScenarioDraft(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { nodes?: Scenario['nodes']; transitions?: Scenario['transitions'] }) =>
      apiFetch<Scenario>(`/api/scenarios/${scenarioId}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(scenarioKeys.detail(scenarioId), data)
    },
  })
}

export function usePublishScenario(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<Scenario>(`/api/scenarios/${scenarioId}/publish/`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(scenarioKeys.detail(scenarioId), data)
      queryClient.invalidateQueries({ queryKey: botKeys.all })
    },
  })
}

export function useCreateScenario(botId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string }) =>
      apiFetch<Scenario>(`/api/bots/${botId}/scenarios/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      // refresh scenarios for this bot
      queryClient.invalidateQueries({ queryKey: botKeys.scenarios(botId) })
    },
  })
}
