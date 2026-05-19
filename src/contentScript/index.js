import { requestWorkout } from '../lib/actions'
import { EVENTS } from '../lib/constants'
import { initGenerateWithAIButton } from '../lib/elements'
import './elements.css'

let cleanupFunction = null
let observer = null
let mountTimer = null

function setupListeners() {
  document.addEventListener(EVENTS.indexPageReady, handleIndexPageReady)
  document.addEventListener(EVENTS.newPromptFired, handleNewPromptFired)
}

function removeListeners() {
  document.removeEventListener(EVENTS.indexPageReady, handleIndexPageReady)
  document.removeEventListener(EVENTS.newPromptFired, handleNewPromptFired)
}

function handleIndexPageReady() {
  if (!isWorkoutsPage()) {
    return
  }

  if (cleanupFunction) {
    console.debug('[OGW] => Cleanup listeners')
    cleanupFunction()
  }
  cleanupFunction = initGenerateWithAIButton()
}

function handleNewPromptFired(event) {
  requestWorkout(event.detail)
}

export function waitPageLoaded() {
  let MutationObserver = window.MutationObserver || window.WebKitMutationObserver
  observer = new MutationObserver(scheduleMount)

  observer.observe(document.getElementsByTagName('body')[0], {
    childList: true,
    subtree: true,
    attributes: true,
  })

  scheduleMount()
}

function scheduleMount() {
  clearTimeout(mountTimer)
  mountTimer = setTimeout(() => {
    if (isWorkoutsPage()) {
      document.dispatchEvent(new Event(EVENTS.indexPageReady))
    }
  }, 300)
}

function isWorkoutsPage() {
  return window.location.pathname.includes('/workouts')
}

function cleanup() {
  if (cleanupFunction) {
    cleanupFunction()
  }
  if (observer) {
    observer.disconnect()
  }
  clearTimeout(mountTimer)
  removeListeners()
}

window.addEventListener('unload', cleanup)

setupListeners()
waitPageLoaded()
