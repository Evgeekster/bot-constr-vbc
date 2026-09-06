import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../client'
import { scenarioKeys } from './useBots'
import type {
  CreateTransitionPayload,
  Scenario,
  Transition,
  UpdateTransitionPayload,
} from '../../types'

export function useCreateTransition(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTransitionPayload) =>
      apiFetch<Transition>(`/api/scenarios/${scenarioId}/transitions/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (newTransition) => {
      queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), (old) =>
        old ? { ...old, transitions: [...old.transitions, newTransition] } : old,
      )
    },
  })
}

export function useUpdateTransition(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateTransitionPayload & { id: number }) =>
      apiFetch<Transition>(`/api/transitions/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), (old) =>
        old
          ? {
              ...old,
              transitions: old.transitions.map((t) =>
                t.id === updated.id ? updated : t,
              ),
            }
          : old,
      )
    },
  })
}

export function useDeleteTransition(scenarioId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (transitionId: number) =>
      apiFetch<void>(`/api/transitions/${transitionId}/`, { method: 'DELETE' }),
    onSuccess: (_, transitionId) => {
      queryClient.setQueryData<Scenario>(scenarioKeys.detail(scenarioId), (old) =>
        old
          ? {
              ...old,
              transitions: old.transitions.filter((t) => t.id !== transitionId),
            }
          : old,
      )
    },
  })
}
