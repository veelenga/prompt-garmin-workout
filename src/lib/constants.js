export const EVENTS = {
  indexPageReady: 'GarminWorkoutIndexPageReady',
  newPromptFired: 'NewPromptFired',
}

export const RUNTIME_MESSAGES = {
  generateWorkout: 'GenerateWorkout',
  detectModels: 'DetectModels',
  noAPIKey: 'NoAPIKey',
  error: 'Error',
}

export const SELECTORS = {
  garminConnect: {
    createWorkoutButton: 'button.create-workout, button, a[role="button"]',
  },
  plugin: {
    generateWithAIButton: '#ogw-create-workout',
    spinner: '.ogw-spinner',
    modal: '#ogw-modal',
    workoutPromptInput: '#ogw-modal-textarea',
    submitPromptBtn: '#ogw-modal-submit-button',
    errorMessage: '#ogw-error-message',
    examplePrompt: '.ogw-example-item',
  },
}

class MissingOpenAISettingsError extends Error {
  constructor(message = 'API Key or model not found') {
    super(message)
    this.name = 'MissingOpenAISettings'
  }
}

class WorkoutGenerationError extends Error {
  constructor(message = 'Workout generation failed') {
    super(message)
    this.name = 'WorkoutGenerationError'
  }
}

export const ERRORS = {
  MissingOpenAISettingsError,
  WorkoutGenerationError,
}
