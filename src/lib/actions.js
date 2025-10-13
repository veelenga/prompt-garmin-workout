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

export function requestWorkout(prompt) {
  const generateButton = document.querySelector(SELECTORS.plugin.submitPromptBtn)
  const errorElement = document.querySelector(SELECTORS.plugin.errorMessage)

  hideError(errorElement)
  setButtonLoading(generateButton, true)

  chrome.runtime.sendMessage(
    { type: RUNTIME_MESSAGES.generateWorkout, prompt },
    async (response) => {
      switch (response?.type) {
        case RUNTIME_MESSAGES.generateWorkout:
          return createWorkout(response.workout, (response) => goToWorkout(response.workoutId))
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
  let htmlMessage = message
  Object.values(trustedUrls).forEach(({ pattern, text }) => {
    if (message.includes(pattern)) {
      htmlMessage = message.replace(
        pattern,
        `<a href="${pattern}" target="_blank" rel="noopener noreferrer" class="ogw-error-link">${text}</a>`,
      )
    }
  })

  element.innerHTML = htmlMessage
  element.style.display = 'block'
}

function hideError(element) {
  element.textContent = ''
  element.style.display = 'none'
}
