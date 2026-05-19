import nock from 'nock'
import { generateWorkout } from '../openai'

describe('generateWorkout', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  test('generates a new workout', async () => {
    const description = `
      Long Run.

      30min at pace 6:00
      30min at pace 5:30
      30min at pace 5:00
      30min at pace 4:45
      30min at pace 4:15
    `

    const mockedResponse = {
      id: 'chatcmpl-mocked',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `{
  "name": "Long Run",
  "type": "running",
  "steps": [
    {
      "stepName": "Segment 1",
      "stepDescription": "Run for 30 minutes at pace 6.0 min/km",
      "stepDuration": 1800,
      "stepType": "interval",
      "target": {
        "type": "pace",
        "value": 6.0,
        "unit": "min_per_km"
      }
    },
    {
      "stepName": "Segment 2",
      "stepDescription": "Run for 30 minutes at pace 5.5 min/km",
      "stepDuration": 1800,
      "stepType": "interval",
      "target": {
        "type": "pace",
        "value": 5.5,
        "unit": "min_per_km"
      }
    },
    {
      "stepName": "Segment 3",
      "stepDescription": "Run for 30 minutes at pace 5.0 min/km",
      "stepDuration": 1800,
      "stepType": "interval",
      "target": {
        "type": "pace",
        "value": 5.0,
        "unit": "min_per_km"
      }
    },
    {
      "stepName": "Segment 4",
      "stepDescription": "Run for 30 minutes at pace 4.75 min/km",
      "stepDuration": 1800,
      "stepType": "interval",
      "target": {
        "type": "pace",
        "value": 4.75,
        "unit": "min_per_km"
      }
    },
    {
      "stepName": "Segment 5",
      "stepDescription": "Run for 30 minutes at pace 4.25 min/km",
      "stepDuration": 1800,
      "stepType": "interval",
      "target": {
        "type": "pace",
        "value": 4.25,
        "unit": "min_per_km"
      }
    }
  ]
}`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 500,
        total_tokens: 600,
      },
    }

    nock('https://api.openai.com')
      .post('/v1/chat/completions', (body) => {
        expect(body.model).toBe('gpt-4')
        expect(body.messages[0].role).toBe('system')
        expect(body.messages[1].content).toContain('Long Run.')
        return true
      })
      .reply(200, mockedResponse)
    const workout = await generateWorkout('test-api-key', 'gpt-4', description)

    expect(workout).toEqual({
      name: 'Long Run',
      type: 'running',
      steps: [
        {
          stepName: 'Segment 1',
          stepDescription: 'Run for 30 minutes at pace 6.0 min/km',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'pace',
            value: 6.0,
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Segment 2',
          stepDescription: 'Run for 30 minutes at pace 5.5 min/km',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'pace',
            value: 5.5,
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Segment 3',
          stepDescription: 'Run for 30 minutes at pace 5.0 min/km',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'pace',
            value: 5.0,
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Segment 4',
          stepDescription: 'Run for 30 minutes at pace 4.75 min/km',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'pace',
            value: 4.75,
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Segment 5',
          stepDescription: 'Run for 30 minutes at pace 4.25 min/km',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'pace',
            value: 4.25,
            unit: 'min_per_km',
          },
        },
      ],
    })
  })

  test('handles OpenAI API errors gracefully', async () => {
    const description = 'Some workout description'

    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(500, {
        error: {
          message: 'Internal server error',
          type: 'server_error',
        },
      })

    await expect(generateWorkout('test-api-key', 'gpt-4', description)).rejects.toThrow()
  })

  test('throws error when response is invalid JSON', async () => {
    const description = 'Some workout description'

    const mockedResponse = {
      id: 'chatcmpl-mocked',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `This is not valid JSON.`,
          },
          finish_reason: 'stop',
        },
      ],
    }

    nock('https://api.openai.com').post('/v1/chat/completions').reply(200, mockedResponse)

    await expect(generateWorkout('test-api-key', 'gpt-4', description)).rejects.toThrow(
      'Invalid JSON response from OpenAI.',
    )
  })

  test('uses a custom OpenAI-compatible base URL', async () => {
    const description = '30 minutes easy'
    const mockedResponse = {
      id: 'chatcmpl-mocked',
      object: 'chat.completion',
      created: 1234567890,
      model: 'custom-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              name: 'Easy Spin',
              type: 'cycling',
              steps: [
                {
                  stepName: 'Easy',
                  stepDescription: 'Ride easy',
                  stepDuration: 1800,
                  stepType: 'interval',
                  target: { type: 'no target' },
                },
              ],
            }),
          },
          finish_reason: 'stop',
        },
      ],
    }

    nock('https://relay.example.com').post('/v1/chat/completions').reply(200, mockedResponse)

    const workout = await generateWorkout(
      'relay-api-key',
      'custom-model',
      description,
      'https://relay.example.com/v1/',
    )

    expect(workout.name).toBe('Easy Spin')
  })

  test('throws a clear error when the API response has no chat completion content', async () => {
    const description = '30 minutes easy'

    nock('https://relay.example.com').post('/v1/chat/completions').reply(200, {
      object: 'list',
      data: [],
    })

    await expect(
      generateWorkout('relay-api-key', 'bad-model', description, 'https://relay.example.com/v1'),
    ).rejects.toThrow('API response did not include choices[0].message.content')
  })

  test('rejects non-HTTPS remote base URLs', async () => {
    await expect(
      generateWorkout(
        'relay-api-key',
        'custom-model',
        '30 minutes easy',
        'http://relay.example.com/v1',
      ),
    ).rejects.toThrow('API Base URL must use HTTPS')
  })

  test('allows localhost HTTP base URLs for local testing', async () => {
    nock('http://localhost:8787')
      .post('/v1/chat/completions')
      .reply(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Local Easy',
                type: 'running',
                steps: [{ stepDuration: 1800, stepType: 'interval' }],
              }),
            },
          },
        ],
      })

    const workout = await generateWorkout(
      'relay-api-key',
      'custom-model',
      '30 minutes easy',
      'http://localhost:8787/v1',
    )

    expect(workout.name).toBe('Local Easy')
  })

  test('retries with a top-level instructions field when the relay requires it', async () => {
    nock('https://relay.example.com')
      .post('/v1/chat/completions', (body) => !body.instructions)
      .reply(400, { error: { message: 'Instructions are required' } })
      .post('/v1/chat/completions', (body) => {
        expect(body.instructions).toContain('You are a fitness coach')
        expect(body.messages[0].role).toBe('system')
        return true
      })
      .reply(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Instruction Relay',
                type: 'cycling',
                steps: [{ stepDuration: 600, stepType: 'warmup' }],
              }),
            },
          },
        ],
      })

    const workout = await generateWorkout(
      'relay-api-key',
      'custom-model',
      '10 min warmup',
      'https://relay.example.com/v1',
    )

    expect(workout.name).toBe('Instruction Relay')
  })

  test('retries without token limits when the relay rejects max token parameters', async () => {
    nock('https://relay.example.com')
      .post('/v1/chat/completions', (body) => body.max_tokens === 2000)
      .reply(400, { error: { message: 'Unsupported parameter: max_output_tokens' } })
      .post('/v1/chat/completions', (body) => body.max_tokens === undefined)
      .reply(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'No Token Limit',
                type: 'cycling',
                steps: [{ stepDuration: 600, stepType: 'warmup' }],
              }),
            },
          },
        ],
      })

    const workout = await generateWorkout(
      'relay-api-key',
      'custom-model',
      '10 min warmup',
      'https://relay.example.com/v1',
    )

    expect(workout.name).toBe('No Token Limit')
  })

  test('retries without temperature when the relay rejects it', async () => {
    nock('https://relay.example.com')
      .post('/v1/chat/completions', (body) => body.temperature === 0.2)
      .reply(400, { error: { message: 'Unsupported parameter: temperature' } })
      .post('/v1/chat/completions', (body) => body.temperature === undefined)
      .reply(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'No Temperature',
                type: 'cycling',
                steps: [{ stepDuration: 600, stepType: 'warmup' }],
              }),
            },
          },
        ],
      })

    const workout = await generateWorkout(
      'relay-api-key',
      'custom-model',
      '10 min warmup',
      'https://relay.example.com/v1',
    )

    expect(workout.name).toBe('No Temperature')
  })

  test('can combine token-limit and instructions compatibility retries', async () => {
    nock('https://relay.example.com')
      .post('/v1/chat/completions', (body) => body.max_tokens === 2000 && !body.instructions)
      .reply(400, { error: { message: 'Unsupported parameter: max_output_tokens' } })
      .post('/v1/chat/completions', (body) => body.max_tokens === undefined && !body.instructions)
      .reply(400, { error: { message: 'Instructions are required' } })
      .post('/v1/chat/completions', (body) => {
        expect(body.max_tokens).toBeUndefined()
        expect(body.instructions).toContain('You are a fitness coach')
        return true
      })
      .reply(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Compatible Relay',
                type: 'cycling',
                steps: [{ stepDuration: 600, stepType: 'warmup' }],
              }),
            },
          },
        ],
      })

    const workout = await generateWorkout(
      'relay-api-key',
      'custom-model',
      '10 min warmup',
      'https://relay.example.com/v1',
    )

    expect(workout.name).toBe('Compatible Relay')
  })

  test('extracts JSON wrapped in a ```json fenced code block', async () => {
    const workoutJson = JSON.stringify({
      name: 'Fenced Workout',
      type: 'running',
      steps: [{ stepDuration: 600, stepType: 'warmup' }],
    })

    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, {
        choices: [
          {
            message: {
              content: '```json\n' + workoutJson + '\n```',
            },
          },
        ],
      })

    const workout = await generateWorkout('test-api-key', 'gpt-4', '10 min warmup')
    expect(workout.name).toBe('Fenced Workout')
  })

  test('extracts JSON wrapped in a generic fenced code block', async () => {
    const workoutJson = JSON.stringify({
      name: 'Fenced Generic',
      type: 'cycling',
      steps: [{ stepDuration: 600, stepType: 'warmup' }],
    })

    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, {
        choices: [
          {
            message: {
              content: '```\n' + workoutJson + '\n```',
            },
          },
        ],
      })

    const workout = await generateWorkout('test-api-key', 'gpt-4', '10 min warmup')
    expect(workout.name).toBe('Fenced Generic')
  })

  test('extracts JSON when the model adds prose before and after braces', async () => {
    const workoutJson = JSON.stringify({
      name: 'Prose Wrapped',
      type: 'running',
      steps: [{ stepDuration: 600, stepType: 'warmup' }],
    })

    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, {
        choices: [
          {
            message: {
              content: `Here is the workout you requested:\n\n${workoutJson}\n\nLet me know if you want to tweak anything.`,
            },
          },
        ],
      })

    const workout = await generateWorkout('test-api-key', 'gpt-4', '10 min warmup')
    expect(workout.name).toBe('Prose Wrapped')
  })
})
