import nock from 'nock'
import {
  DEFAULT_OPENAI_BASE_URL,
  fetchAvailableModels,
  getBaseUrlPermissionOrigin,
  normalizeBaseUrl,
  parseModelsPayload,
} from '../openaiCompatibleApi'

describe('normalizeBaseUrl', () => {
  test('returns the default base URL when input is empty', () => {
    expect(normalizeBaseUrl('')).toBe(DEFAULT_OPENAI_BASE_URL)
    expect(normalizeBaseUrl(undefined)).toBe(DEFAULT_OPENAI_BASE_URL)
  })

  test('strips trailing slashes and whitespace', () => {
    expect(normalizeBaseUrl('  https://api.openai.com/v1///  ')).toBe('https://api.openai.com/v1')
  })

  test('rejects HTTP base URLs for remote hosts', () => {
    expect(() => normalizeBaseUrl('http://relay.example.com/v1')).toThrow(/HTTPS/)
  })

  test('allows HTTP base URLs for localhost variants', () => {
    expect(normalizeBaseUrl('http://localhost:8787/v1')).toBe('http://localhost:8787/v1')
    expect(normalizeBaseUrl('http://127.0.0.1:8787/v1')).toBe('http://127.0.0.1:8787/v1')
    expect(normalizeBaseUrl('http://[::1]:8787/v1')).toBe('http://[::1]:8787/v1')
  })

  test('throws when the value is not a valid URL', () => {
    expect(() => normalizeBaseUrl('not a url')).toThrow(/valid URL/)
  })
})

describe('getBaseUrlPermissionOrigin', () => {
  test('returns the wildcard origin pattern for the base URL', () => {
    expect(getBaseUrlPermissionOrigin('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/*',
    )
    expect(getBaseUrlPermissionOrigin('https://relay.example.com/v1/path/')).toBe(
      'https://relay.example.com/*',
    )
  })
})

describe('parseModelsPayload', () => {
  test('returns sorted, deduplicated model ids', () => {
    const payload = {
      data: [
        { id: 'gpt-4o' },
        { id: 'gpt-3.5-turbo' },
        { id: 'gpt-4o-mini' },
        { id: null },
        { id: '' },
      ],
    }

    expect(parseModelsPayload(payload)).toEqual(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'])
  })

  test('throws a helpful error when the list is empty', () => {
    expect(() => parseModelsPayload({ data: [] })).toThrow(/No models returned/)
    expect(() => parseModelsPayload({})).toThrow(/No models returned/)
  })
})

describe('fetchAvailableModels', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  test('returns parsed model ids on success', async () => {
    nock('https://api.openai.com')
      .get('/v1/models')
      .matchHeader('authorization', 'Bearer test-key')
      .reply(200, {
        data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }],
      })

    const models = await fetchAvailableModels('test-key', 'https://api.openai.com/v1')
    expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4o'])
  })

  test('throws a useful error when the upstream returns a non-2xx', async () => {
    nock('https://api.openai.com')
      .get('/v1/models')
      .reply(401, { error: { message: 'Invalid API key' } })

    await expect(
      fetchAvailableModels('bad-key', 'https://api.openai.com/v1'),
    ).rejects.toThrow(/401.*Invalid API key/)
  })

  test('throws when the response has no models', async () => {
    nock('https://api.openai.com').get('/v1/models').reply(200, { data: [] })

    await expect(
      fetchAvailableModels('test-key', 'https://api.openai.com/v1'),
    ).rejects.toThrow(/No models returned/)
  })
})
