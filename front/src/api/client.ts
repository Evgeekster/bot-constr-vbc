const BASE_URL = import.meta.env.VITE_API_URL ?? ''

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText
  let fieldErrors: Record<string, string[]> | undefined

  try {
    const data = await res.json()
    if (typeof data === 'string') {
      message = data
    } else if (data.detail) {
      message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } else if (data.non_field_errors) {
      message = data.non_field_errors.join(', ')
    } else {
      fieldErrors = data as Record<string, string[]>
      const firstKey = Object.keys(data)[0]
      if (firstKey && Array.isArray(data[firstKey])) {
        message = `${firstKey}: ${data[firstKey].join(', ')}`
      }
    }
  } catch {
    // ignore parse errors
  }

  return new ApiError(res.status, message, fieldErrors)
}

export async function ensureCsrfCookie(): Promise<void> {
  await apiFetch<{ detail: string }>('/api/auth/csrf/')
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (MUTATING_METHODS.has(method)) {
    const csrf = getCsrfToken()
    if (csrf) {
      headers['X-CSRFToken'] = csrf
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    throw await parseError(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}
