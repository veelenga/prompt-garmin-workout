import { ERRORS } from '../lib/constants.js'
import { DEFAULT_OPENAI_BASE_URL, normalizeBaseUrl } from './openaiCompatibleApi.js'

const CHAT_COMPLETION_TIMEOUT_MS = 60000
// Compatibility retries drop optional request fields one at a time when a provider rejects them.
// Validation failures return fast, so the cap is sized to fit the popup-side 90s budget
// (a few fast validation rejections plus one real chat-completion call).
const MAX_COMPATIBILITY_RETRIES = 4

/**
 * Generates a workout based on the description.
 * @param {string} apiKey - The OpenAI API key.
 * @param {string} model - The OpenAI model to use.
 * @param {string} description - The workout description.
 * @param {string} baseUrl - The OpenAI-compatible API base URL.
 * @returns {Promise<Object>} - The generated workout object.
 */
export async function generateWorkout(
  apiKey,
  model,
  description,
  baseUrl = DEFAULT_OPENAI_BASE_URL,
) {
  try {
    const prompt = createPrompt(description)
    const response = await createChatCompletion(apiKey, model, prompt, baseUrl)
    const assistantMessage = extractAssistantMessage(response)
    return parseWorkoutResponse(assistantMessage)
  } catch (error) {
    throw new ERRORS.WorkoutGenerationError(error.message)
  }
}

async function createChatCompletion(apiKey, model, prompt, baseUrl) {
  const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`
  const body = createChatCompletionBody(model, prompt)
  let lastError

  for (let attempt = 0; attempt < MAX_COMPATIBILITY_RETRIES; attempt += 1) {
    try {
      return await postChatCompletion(url, apiKey, body)
    } catch (error) {
      lastError = error

      if (isInstructionsRequiredError(error) && !body.instructions) {
        body.instructions = prompt.instructions
        continue
      }

      const unsupportedParameter = getUnsupportedParameter(error)
      if (unsupportedParameter && removeUnsupportedParameter(body, unsupportedParameter)) {
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('API request failed after compatibility retries.')
}

function isInstructionsRequiredError(error) {
  return /instructions.*required/i.test(error.message)
}

function getUnsupportedParameter(error) {
  const match = error.message.match(/unsupported parameter:?\s*['"]?([\w.-]+)['"]?/i)
  return match?.[1]?.toLowerCase() || null
}

function removeUnsupportedParameter(body, parameter) {
  const parameterAliases = {
    max_output_tokens: ['max_tokens', 'max_completion_tokens', 'max_output_tokens'],
    max_completion_tokens: ['max_tokens', 'max_completion_tokens', 'max_output_tokens'],
    max_tokens: ['max_tokens', 'max_completion_tokens', 'max_output_tokens'],
    temperature: ['temperature'],
    top_p: ['top_p'],
    frequency_penalty: ['frequency_penalty'],
    presence_penalty: ['presence_penalty'],
    response_format: ['response_format'],
    instructions: ['instructions'],
  }

  const keys = parameterAliases[parameter] || [parameter]
  let removed = false

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      delete body[key]
      removed = true
    }
  })

  return removed
}

function createChatCompletionBody(model, prompt) {
  return {
    model,
    messages: [
      { role: 'system', content: prompt.instructions },
      { role: 'user', content: prompt.userMessage },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  }
}

async function postChatCompletion(url, apiKey, body) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CHAT_COMPLETION_TIMEOUT_MS)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .catch((error) => {
      if (error.name === 'AbortError') {
        throw new Error('Model request timed out after 60 seconds. Try a faster model.')
      }
      throw error
    })
    .finally(() => clearTimeout(timeoutId))

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload?.error?.message || `API request failed with status ${response.status}`)
  }

  if (payload?.error?.message) {
    throw new Error(payload.error.message)
  }

  return payload
}

function extractAssistantMessage(response) {
  const content = response?.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || part?.content || '')
      .join('')
      .trim()
  }

  throw new Error(
    'API response did not include choices[0].message.content. Check the selected model.',
  )
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    throw new Error('API response was not valid JSON.')
  }
}

function createPrompt(description) {
  const instructions = `
You are a fitness coach.
Given a workout description, create a structured JSON object that represents the workout.
The JSON should be compatible with the makePayload function used for Garmin workouts.

Requirements:
- The output must be valid JSON.
- Use the following structure for the workout object:
{
  "name": "Workout Name",
  "type": "running" | "cycling" | "swimming" | "cardio" | "strength",
  "steps": [
    {
      "stepName": "Step Name",
      "stepDescription": "Description",
      "endConditionType": "time" | "distance", // Either time or distance based
      "stepDuration": duration_in_seconds, // Only used when endConditionType is "time"
      "stepDistance": distance_value, // Only used when endConditionType is "distance"
      "distanceUnit": "m" | "km" | "mile", // Only used when endConditionType is "distance"
      "stepType": "warmup" | "cooldown" | "interval" | "recovery" | "rest" | "repeat",
      "target": {
        "type": "no target" | "pace" | "heart rate" | "power" | "cadence" | "speed",
        "value": [minValue, maxValue] or single_value,
        "unit": "min_per_km" | "bpm" | "watts" | etc.
      },
      "numberOfIterations": number, // Only for repeat steps
      "steps": [ ... ] // Nested steps for repeats
    }
  ]
}

Constraints:
- Be creative on the workout name. It should be understandable and describe the workout. Avoid sport type in the name.
- The "type" should be one of the supported sports.
- When using time-based steps, "stepDuration" should be in seconds.
- When using distance-based steps, include "stepDistance" and "distanceUnit" instead of "stepDuration".
- For distance-based steps, use "m" for meters, "km" for kilometers, and "mile" for miles.
- For pace targets, convert times like "4:30 per km" to minutes per km as a decimal (e.g., 4.5).
- Use "no target" if no specific target is given.
- For repeats, include "numberOfIterations" and "steps".
- Use repeats where possible to avoid repeating steps. For example, use a repeat step for 5x1km intervals.
- Never mix intervals with recovery or rest steps in the same step. Use separate steps for each.
- The step with the slowest target in the repeat should be of type "recovery" or "rest".
- The JSON must be parsable and not include additional explanations. Do not include any formatting or comments in the JSON.
`

  return {
    instructions,
    userMessage: `Workout Description:\n${description}`,
  }
}

function parseWorkoutResponse(responseText) {
  const trimmedText = extractJsonText(responseText)

  try {
    return JSON.parse(trimmedText)
  } catch {
    throw new Error('Invalid JSON response from OpenAI.')
  }
}

function extractJsonText(responseText) {
  const trimmedText = responseText.trim()
  const fencedMatch = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch) {
    return fencedMatch[1].trim()
  }

  const firstBrace = trimmedText.indexOf('{')
  const lastBrace = trimmedText.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmedText.slice(firstBrace, lastBrace + 1)
  }

  return trimmedText
}
