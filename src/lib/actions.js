import { createWorkout, goToWorkout } from './garmin'
import { RUNTIME_MESSAGES, SELECTORS } from './constants'

const trustedUrls = {
  'openai-api': {
    pattern: 'https://platform.openai.com/account/api-keys',
    text: 'OpenAI dashboard',
  },
  support: {
    pattern:
      'https://chromewebstore.google.com/detail/prompt-garmin-workout/bgphnlbjnkghcliepjibelgkglbjmmma/support',
    text: 'Support page',
  },
}

const GENERATION_RESPONSE_TIMEOUT_MS = 90000

export function requestWorkout(prompt) {
  const generateButton = document.querySelector(SELECTORS.plugin.submitPromptBtn)
  const errorElement = document.querySelector(SELECTORS.plugin.errorMessage)
  let isDone = false
  const timeoutId = setTimeout(() => {
    if (isDone) {
      return
    }

    isDone = true
    showError(
      errorElement,
      'Generation timed out after 90 seconds. Try a faster model or shorter prompt.',
    )
    setButtonLoading(generateButton, false)
  }, GENERATION_RESPONSE_TIMEOUT_MS)

  hideError(errorElement)
  setButtonLoading(generateButton, true)

  chrome.runtime.sendMessage(
    { type: RUNTIME_MESSAGES.generateWorkout, prompt },
    async (response) => {
      if (isDone) {
        return
      }

      isDone = true
      clearTimeout(timeoutId)

      switch (response?.type) {
        case RUNTIME_MESSAGES.generateWorkout:
          try {
            return createWorkout(
              response.workout,
              (response) => goToWorkout(response.workoutId),
              (error) => {
                showError(errorElement, error.message)
                setButtonLoading(generateButton, false)
              },
            )
          } catch (error) {
            showError(errorElement, error.message)
            setButtonLoading(generateButton, false)
            return
          }
        case RUNTIME_MESSAGES.noAPIKey:
          showError(errorElement, 'Set up your OpenAI API key in extension settings to continue.')
          break
        case RUNTIME_MESSAGES.error:
          showError(errorElement, response.message)
          break
        default:
          showError(
            errorElement,
            `Something went wrong. Try rephrasing the prompt or report this issue at ${trustedUrls.support.pattern}.`,
          )
      }
      setButtonLoading(generateButton, false)
    },
  )
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.setAttribute('disabled', true)
    if (!button.querySelector(SELECTORS.plugin.spinner)) {
      const spinner = document.createElement('span')
      spinner.classList.add(SELECTORS.plugin.spinner.slice(1).replace('.', ''))
      button.appendChild(spinner)
    }
  } else {
    button.removeAttribute('disabled')
    const spinner = button.querySelector(SELECTORS.plugin.spinner)
    if (spinner) spinner.remove()
  }
}

function showError(element, message) {
  if (!element) {
    return
  }

  const safeMessage = String(message || 'Something went wrong.')
  element.textContent = ''

  const trustedUrl = Object.values(trustedUrls).find(({ pattern }) => safeMessage.includes(pattern))
  if (!trustedUrl) {
    element.textContent = safeMessage
    element.style.display = 'block'
    return
  }

  const parts = safeMessage.split(trustedUrl.pattern)
  parts.forEach((part, index) => {
    if (part) {
      element.appendChild(document.createTextNode(part))
    }

    if (index < parts.length - 1) {
      const link = document.createElement('a')
      link.href = trustedUrl.pattern
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.className = 'ogw-error-link'
      link.textContent = trustedUrl.text
      element.appendChild(link)
    }
  })
  element.style.display = 'block'
}

function hideError(element) {
  element.textContent = ''
  element.style.display = 'none'
}
