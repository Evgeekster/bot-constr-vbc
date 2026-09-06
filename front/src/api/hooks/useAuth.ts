import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch, ensureCsrfCookie } from '../client'
import type { AuthUser } from '../../types'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>('/api/auth/me/')
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null
    }
    throw error
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      await ensureCsrfCookie()
      return apiFetch<AuthUser>('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/auth/logout/', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me, null)
      queryClient.clear()
    },
  })
}
