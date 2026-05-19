import './index.css'
import { RUNTIME_MESSAGES } from '../lib/constants.js'
import {
  DEFAULT_OPENAI_BASE_URL,
  getBaseUrlPermissionOrigin,
  normalizeBaseUrl,
} from '../lib/openaiCompatibleApi.js'

document.addEventListener('DOMContentLoaded', function () {
  const hiddenKey = '********'

  const apiKeyInput = document.getElementById('apiKey')
  const baseUrlInput = document.getElementById('baseUrl')
  const modelSelect = document.getElementById('modelSelect')
  const customModelInput = document.getElementById('customModel')
  const detectModelsButton = document.getElementById('detectModels')
  const saveButton = document.getElementById('save')
  const clearButton = document.getElementById('clear')
  const statusMessage = document.getElementById('status')

  function checkAndHighlightApiKey() {
    chrome.storage.local.get('openaiApiKey', function (result) {
      if (!result.openaiApiKey) {
        apiKeyInput.classList.add('error')
        apiKeyInput.focus()
      } else {
        apiKeyInput.classList.remove('error')
        apiKeyInput.value = hiddenKey
      }
    })
  }

  checkAndHighlightApiKey()

  chrome.storage.local.get(
    ['openaiModel', 'openaiBaseUrl', 'openaiCustomModel', 'openaiDetectedModels'],
    function (result) {
      baseUrlInput.value = result.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL
      updateModelOptions(result.openaiDetectedModels || [], result.openaiModel)

      if (result.openaiModel) {
        modelSelect.value = result.openaiModel
      }

      if (result.openaiCustomModel) {
        customModelInput.value = result.openaiCustomModel
      }
    },
  )

  saveButton.addEventListener('click', async function () {
    const apiKey = apiKeyInput.value
    const customModel = customModelInput.value.trim()
    const selectedModel = customModel || modelSelect.value
    let baseUrl

    try {
      baseUrl = normalizeBaseUrl(baseUrlInput.value)
    } catch (error) {
      baseUrlInput.classList.add('error')
      statusMessage.textContent = error.message
      return
    }

    try {
      await requestBaseUrlPermission(baseUrl)
    } catch (error) {
      statusMessage.textContent = error.message
      return
    }

    const propsToSave = {
      openaiBaseUrl: baseUrl,
      openaiModel: selectedModel,
      openaiCustomModel: customModel,
    }
    if (apiKey !== hiddenKey) {
      propsToSave.openaiApiKey = apiKey
    }

    chrome.storage.local.set(propsToSave, function () {
      statusMessage.textContent = 'Settings saved!'
      if (apiKey) {
        apiKeyInput.classList.remove('error')
      } else {
        apiKeyInput.classList.add('error')
      }
      setTimeout(() => {
        statusMessage.textContent = ''
      }, 2000)
    })
  })

  clearButton.addEventListener('click', function () {
    chrome.storage.local.remove(
      ['openaiApiKey', 'openaiModel', 'openaiBaseUrl', 'openaiCustomModel', 'openaiDetectedModels'],
      function () {
        apiKeyInput.value = ''
        baseUrlInput.value = DEFAULT_OPENAI_BASE_URL
        updateModelOptions([], 'gpt-4o-mini')
        customModelInput.value = ''
        statusMessage.textContent = 'Settings cleared!'
        checkAndHighlightApiKey()
        setTimeout(() => {
          statusMessage.textContent = ''
        }, 2000)
      },
    )
  })

  detectModelsButton.addEventListener('click', async function () {
    const apiKey = await getApiKeyForRequest(apiKeyInput.value, hiddenKey)
    let baseUrl

    try {
      baseUrl = normalizeBaseUrl(baseUrlInput.value)
    } catch (error) {
      baseUrlInput.classList.add('error')
      statusMessage.textContent = error.message
      return
    }

    if (!apiKey) {
      apiKeyInput.classList.add('error')
      statusMessage.textContent = 'Enter an API key before detecting models.'
      return
    }

    try {
      await requestBaseUrlPermission(baseUrl)
    } catch (error) {
      statusMessage.textContent = error.message
      return
    }

    detectModelsButton.setAttribute('disabled', true)
    statusMessage.textContent = 'Detecting models...'

    try {
      const models = await detectModels(apiKey, baseUrl)
      updateModelOptions(models, models[0])
      chrome.storage.local.set({
        openaiBaseUrl: baseUrl,
        openaiDetectedModels: models,
        openaiModel: modelSelect.value,
        openaiCustomModel: '',
      })
      customModelInput.value = ''
      statusMessage.textContent = `Detected ${models.length} model${models.length === 1 ? '' : 's'}.`
    } catch (error) {
      statusMessage.textContent = error.message
    } finally {
      detectModelsButton.removeAttribute('disabled')
      setTimeout(() => {
        statusMessage.textContent = ''
      }, 3000)
    }
  })

  apiKeyInput.addEventListener('input', function () {
    apiKeyInput.classList.remove('error')
  })

  baseUrlInput.addEventListener('input', function () {
    baseUrlInput.classList.remove('error')
  })
})

function updateModelOptions(detectedModels, selectedModel) {
  const modelSelect = document.getElementById('modelSelect')
  const defaultModels = [
    ['gpt-4o-mini', 'GPT-4o Mini (Recommended)'],
    ['gpt-4o', 'GPT-4o'],
    ['o1-preview', 'O1 Preview'],
    ['o1-mini', 'O1 Mini'],
    ['gpt-3.5-turbo', 'GPT-3.5 Turbo'],
  ]
  const models = detectedModels.length
    ? detectedModels.map((model) => [model, model])
    : defaultModels

  modelSelect.textContent = ''
  models.forEach(([value, label]) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    modelSelect.appendChild(option)
  })

  if (selectedModel && [...modelSelect.options].some((option) => option.value === selectedModel)) {
    modelSelect.value = selectedModel
  }
}

function requestBaseUrlPermission(baseUrl) {
  if (!chrome.permissions) {
    return Promise.resolve()
  }

  const permission = { origins: [getBaseUrlPermissionOrigin(baseUrl)] }
  return new Promise((resolve, reject) => {
    chrome.permissions.contains(permission, (hasPermission) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (hasPermission) {
        resolve()
        return
      }

      chrome.permissions.request(permission, (granted) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (granted) {
          resolve()
        } else {
          reject(new Error(`Permission is required to access ${permission.origins[0]}.`))
        }
      })
    })
  })
}

function getApiKeyForRequest(apiKeyInputValue, hiddenKey) {
  if (apiKeyInputValue && apiKeyInputValue !== hiddenKey) {
    return Promise.resolve(apiKeyInputValue)
  }

  return new Promise((resolve) => {
    chrome.storage.local.get('openaiApiKey', (result) => {
      resolve(result.openaiApiKey || '')
    })
  })
}

function detectModels(apiKey, baseUrl) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: RUNTIME_MESSAGES.detectModels,
        apiKey,
        baseUrl,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        if (response?.type === RUNTIME_MESSAGES.detectModels) {
          resolve(response.models)
          return
        }

        reject(new Error(response?.message || 'Could not detect models.'))
      },
    )
  })
}
