export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

export function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return DEFAULT_OPENAI_BASE_URL
  }

  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')
  let parsedUrl
  try {
    parsedUrl = new URL(normalizedBaseUrl)
  } catch {
    throw new Error('API Base URL must be a valid URL.')
  }

  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)
  if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && isLocalhost)) {
    throw new Error('API Base URL must use HTTPS, except for localhost testing.')
  }

  return normalizedBaseUrl
}

export function getBaseUrlPermissionOrigin(baseUrl) {
  return `${new URL(normalizeBaseUrl(baseUrl)).origin}/*`
}

export async function fetchAvailableModels(apiKey, baseUrl) {
  const url = `${normalizeBaseUrl(baseUrl)}/models`
  let response

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })
  } catch {
    throw new Error(`Could not reach ${url}. Check the Base URL and extension permissions.`)
  }

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(`Could not detect models: ${response.status} ${message}`)
  }

  return parseModelsPayload(await response.json())
}

export function parseModelsPayload(payload) {
  const models = (payload.data || [])
    .map((model) => model.id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  if (!models.length) {
    throw new Error('No models returned. Enter a model name manually.')
  }

  return models
}

export async function readErrorMessage(response) {
  try {
    const payload = await response.json()
    return payload?.error?.message || response.statusText
  } catch {
    return response.statusText
  }
}
