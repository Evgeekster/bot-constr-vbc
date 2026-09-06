import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../client'
import { scenarioKeys } from './useBots'
import type {
  CreateNodePayload,
  Scenario,
  ScenarioNode,
  UpdateNodePayload,
} from '../../types'

export function useCreateNode(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateNodePayload) =>
      apiFetch<ScenarioNode>(`/api/scenarios/${scenarioId}/nodes/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (newNode) => {
      queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), (old) =>
        old ? { ...old, nodes: [...old.nodes, newNode] } : old,
      )
    },
  })
}

export function useUpdateNode(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateNodePayload & { id: number }) =>
      apiFetch<ScenarioNode>(`/api/nodes/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    // Optimistic update: apply the change locally immediately and rollback on error
    onMutate: async ({ id, ...payload }: UpdateNodePayload & { id: number }) => {
      await queryClient.cancelQueries(scenarioKeys.detail(scenarioId))
      const previous = queryClient.getQueryData<Scenario>(scenarioKeys.detail(scenarioId))
      if (previous) {
        const patched = {
          ...previous,
          nodes: previous.nodes.map((n) => (n.id === id ? { ...n, ...payload } : n)),
        }
        queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), patched)
      }
      return { previous }
    },
    onError: (_err, _variables, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(scenarioKeys.detail(scenarioId))
    },
    onSuccess: (updatedNode) => {
      // ensure cache is consistent with server response
      queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), (old) =>
        old
          ? {
              ...old,
              nodes: old.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)),
            }
          : old,
      )
    },
  })
}

export function useDeleteNode(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: number) =>
      apiFetch<void>(`/api/nodes/${nodeId}/`, { method: 'DELETE' }),
    onSuccess: (_, nodeId) => {
      queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), (old) =>
        old
          ? {
              ...old,
              nodes: old.nodes.filter((n) => n.id !== nodeId),
              transitions: old.transitions.filter(
                (t) => t.from_node !== nodeId && t.to_node !== nodeId,
              ),
            }
          : old,
      )
    },
  })
}
