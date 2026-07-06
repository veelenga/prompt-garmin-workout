import { RUNTIME_MESSAGES, ERRORS } from '../lib/constants.js'
import { fetchAvailableModels } from '../lib/openaiCompatibleApi.js'
import { generateWorkout } from '../lib/openai.js'

function getOpenAISettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['openaiApiKey', 'openaiModel', 'openaiBaseUrl'], (result) => {
      if (result.openaiApiKey && result.openaiModel) {
        resolve({
          apiKey: result.openaiApiKey,
          model: result.openaiModel,
          baseUrl: result.openaiBaseUrl,
        })
      } else {
        reject(new ERRORS.MissingOpenAISettingsError())
      }
    })
  })
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === RUNTIME_MESSAGES.generateWorkout) {
    console.log('[OGW] => Attempting to generate workout...')
    getOpenAISettings()
      .then(({ apiKey, model, baseUrl }) => generateWorkout(apiKey, model, request.prompt, baseUrl))
      .then((workout) => sendResponse({ type: RUNTIME_MESSAGES.generateWorkout, workout }))
      .catch((error) => {
        console.error('[OGW] => Error generating workout:', error)

        if (error instanceof ERRORS.MissingOpenAISettingsError) {
          chrome.action.openPopup()
          sendResponse({ type: RUNTIME_MESSAGES.noAPIKey })
        } else if (error instanceof ERRORS.WorkoutGenerationError) {
          sendResponse({ type: RUNTIME_MESSAGES.error, message: `AI generation failed: ${error.message}` })
        } else {
          sendResponse({ type: RUNTIME_MESSAGES.error })
        }
      })
    return true
  }

  if (request.type === RUNTIME_MESSAGES.detectModels) {
    fetchAvailableModels(request.apiKey, request.baseUrl)
      .then((models) => sendResponse({ type: RUNTIME_MESSAGES.detectModels, models }))
      .catch((error) => sendResponse({ type: RUNTIME_MESSAGES.error, message: error.message }))
    return true
  }

  console.error('[OGW] => Unknown message type:', request.type)
})
