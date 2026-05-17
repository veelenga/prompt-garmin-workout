const addWorkoutEndpoint = 'https://connect.garmin.com/gc-api/workout-service/workout'
const workoutsUrl = 'https://connect.garmin.com/app/workouts'

export const sportTypeMapping = {
  running: { sportTypeId: 1, sportTypeKey: 'running', displayOrder: 1 },
  cycling: { sportTypeId: 2, sportTypeKey: 'cycling', displayOrder: 2 },
  swimming: { sportTypeId: 4, sportTypeKey: 'swimming', displayOrder: 5 },
  strength: { sportTypeId: 5, sportTypeKey: 'strength_training', displayOrder: 9 },
  cardio: { sportTypeId: 6, sportTypeKey: 'cardio_training', displayOrder: 8 },
}

export const stepTypeMapping = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup', displayOrder: 1 },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown', displayOrder: 2 },
  interval: { stepTypeId: 3, stepTypeKey: 'interval', displayOrder: 3 },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery', displayOrder: 4 },
  rest: { stepTypeId: 5, stepTypeKey: 'rest', displayOrder: 5 },
  repeat: { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 6 },
}

export const targetTypeMapping = {
  'no target': { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 1 },
  power: { workoutTargetTypeId: 2, workoutTargetTypeKey: 'power.zone', displayOrder: 2 },
  cadence: { workoutTargetTypeId: 3, workoutTargetTypeKey: 'cadence.zone', displayOrder: 3 },
  'heart rate': {
    workoutTargetTypeId: 4,
    workoutTargetTypeKey: 'heart.rate.zone',
    displayOrder: 4,
  },
  speed: { workoutTargetTypeId: 5, workoutTargetTypeKey: 'speed.zone', displayOrder: 5 },
  pace: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone', displayOrder: 6 },
}

export const distanceUnitMapping = {
  m: { unitId: 2, unitKey: 'm', factor: 1 },
  km: { unitId: 3, unitKey: 'km', factor: 1000 },
  mile: { unitId: 4, unitKey: 'mile', factor: 1609.344 },
}

export const endConditionTypeMapping = {
  time: { conditionTypeId: 2, conditionTypeKey: 'time', displayOrder: 2, displayable: true },
  distance: {
    conditionTypeId: 3,
    conditionTypeKey: 'distance',
    displayOrder: 3,
    displayable: true,
  },
  'lap.button': {
    conditionTypeId: 1,
    conditionTypeKey: 'lap.button',
    displayOrder: 1,
    displayable: true,
  },
  iterations: {
    conditionTypeId: 7,
    conditionTypeKey: 'iterations',
    displayOrder: 7,
    displayable: false,
  },
}

/**
 * Default pace values in seconds per meter for different sport types
 * These are used when estimating duration for distance steps without pace targets
 */
const DEFAULT_PACE = {
  running: 0.36, // ~6:00 min/km or ~9:40 min/mile
  cycling: 0.05, // ~3:00 min/km or ~5:00 min/mile (12 mph)
  swimming: 0.5, // ~8:20 min/100m
  walking: 0.3, // ~5:00 min/km
  strength: 0.36, // Same as running
  cardio: 0.36, // Same as running
}

/**
 * Main function to create the workout payload.
 * @param {Object} workout - The workout object containing workout details and steps.
 * @returns {Object} - The formatted payload ready to be sent to Garmin.
 */
export function makePayload(workout) {
  let stepOrder = 1
  const sportType = getSportType(workout.type)
  const payload = {
    sportType: sportType,
    subSportType: null,
    workoutName: workout.name,
    estimatedDistanceUnit: {
      unitKey: null,
    },
    workoutSegments: [],
    avgTrainingSpeed: null,
    estimatedDurationInSecs: 0,
    estimatedDistanceInMeters: 0,
    estimateType: null,
  }

  const segment = {
    segmentOrder: 1,
    sportType: sportType,
    workoutSteps: [],
  }

  const result = processSteps(workout.steps, stepOrder)
  segment.workoutSteps = result.steps
  stepOrder = result.stepOrder

  payload.workoutSegments.push(segment)
  payload.estimatedDurationInSecs = calculateEstimatedDuration(payload.workoutSegments)

  return payload
}

function getStepDescription(step) {
  const description = step.stepDescription || step.stepName || step.stepType || 'Workout step'
  return String(description).trim() || 'Workout step'
}

/**
 * Retrieves the sport type object from the mapping.
 * @param {string} sportTypeKey - The sport type key (e.g., 'running').
 * @returns {Object} - The sport type object.
 */
function getSportType(sportTypeKey) {
  const sportType = sportTypeMapping[sportTypeKey.toLowerCase()]
  if (!sportType) {
    throw new Error(`Unsupported sport type: ${sportTypeKey}`)
  }
  return sportType
}

/**
 * Recursively processes an array of steps.
 * @param {Array} stepsArray - The array of steps to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the array of formatted steps and updated stepOrder.
 */
function processSteps(stepsArray, stepOrder) {
  const steps = []

  stepsArray.forEach((step) => {
    const result = processStep(step, stepOrder)
    steps.push(result.step)
    stepOrder = result.stepOrder
  })

  return { steps, stepOrder }
}

/**
 * Processes an individual step (regular or repeat).
 * @param {Object} step - The step object to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the formatted step and updated stepOrder.
 */
function processStep(step, stepOrder) {
  // Handle both stepType and endConditionType for identifying repeat steps
  if (
    step.numberOfIterations &&
    step.steps &&
    (step.stepType === 'repeat' || step.endConditionType === 'repeat')
  ) {
    return processRepeatStep(step, stepOrder)
  } else if (!step.stepType) {
    throw new Error(`Missing stepType for step: ${step.stepName || 'Unnamed Step'}`)
  } else {
    return processRegularStep(step, stepOrder)
  }
}

/**
 * Processes a regular executable step.
 * @param {Object} step - The step object to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the formatted executable step and updated stepOrder.
 */
function processRegularStep(step, stepOrder) {
  const stepType = stepTypeMapping[step.stepType.toLowerCase()] || stepTypeMapping['interval']

  const workoutStep = {
    stepId: stepOrder,
    stepOrder: stepOrder,
    stepType: stepType,
    type: 'ExecutableStepDTO',
    description: getStepDescription(step),
    stepAudioNote: null,
  }

  // Process end condition (time or distance)
  if (step.endConditionType === 'distance' && step.stepDistance && step.distanceUnit) {
    const distanceUnit = distanceUnitMapping[step.distanceUnit.toLowerCase()]
    if (!distanceUnit) {
      throw new Error(`Unsupported distance unit: ${step.distanceUnit}`)
    }

    workoutStep.endCondition = endConditionTypeMapping.distance
    workoutStep.endConditionValue = step.stepDistance * distanceUnit.factor // Convert to meters

    // When using km for distances >= 1000m, or miles for imperial, make sure
    // the input value is preserved in the native unit rather than being converted
    if (distanceUnit.unitKey === 'km' && workoutStep.endConditionValue >= 1000) {
      workoutStep.endConditionValue = Math.round(workoutStep.endConditionValue)
    } else if (distanceUnit.unitKey === 'mile') {
      // For miles, preserve the exact conversion factor
      workoutStep.endConditionValue = step.stepDistance * 1609.344
    }
  } else {
    // Default to time-based
    if (typeof step.stepDuration !== 'number' || step.stepDuration <= 0) {
      throw new Error(
        `Invalid or missing stepDuration for step: ${step.stepName || 'Unnamed Step'}`,
      )
    }

    workoutStep.endCondition = endConditionTypeMapping.time
    workoutStep.endConditionValue = step.stepDuration // Duration in seconds
  }

  if (step.target) {
    processTarget(workoutStep, step)
  } else {
    workoutStep.targetType = targetTypeMapping['no target']
  }

  // Explicitly set targetValueUnit to null as seen in the valid payload
  if (workoutStep.targetType && workoutStep.targetType.workoutTargetTypeKey !== 'no.target') {
    workoutStep.targetValueUnit = null
  }

  stepOrder += 1
  return { step: workoutStep, stepOrder }
}

/**
 * Processes a repeat step and its child steps.
 * @param {Object} step - The repeat step object to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the formatted repeat step and updated stepOrder.
 */
function processRepeatStep(step, stepOrder) {
  if (typeof step.numberOfIterations !== 'number' || step.numberOfIterations <= 0) {
    throw new Error(`Invalid or missing numberOfIterations for repeat step.`)
  }

  const repeatStep = {
    stepId: stepOrder,
    stepOrder: stepOrder,
    stepType: stepTypeMapping['repeat'],
    numberOfIterations: step.numberOfIterations || 1,
    smartRepeat: false,
    endCondition: {
      conditionTypeId: 7,
      conditionTypeKey: 'iterations',
      displayOrder: 7,
      displayable: false,
    },
    type: 'RepeatGroupDTO',
  }

  stepOrder += 1

  // Recursively process child steps
  const result = processSteps(step.steps, stepOrder)
  repeatStep.workoutSteps = result.steps
  stepOrder = result.stepOrder

  return { step: repeatStep, stepOrder }
}

/**
 * Processes the target information for a workout step.
 * @param {Object} workoutStep - The workout step object to update.
 * @param {Object} step - The original step object containing target information.
 */
function processTarget(workoutStep, step) {
  const targetTypeKey = step.target.type.toLowerCase()
  const targetType = targetTypeMapping[targetTypeKey]

  if (!targetType) {
    throw new Error(`Unsupported target type: ${step.target.type}`)
  }

  workoutStep.targetType = targetType

  if (step.target.value) {
    const { targetValueOne, targetValueTwo } = convertTargetValues(step, targetTypeKey)
    workoutStep.targetValueOne = targetValueOne
    workoutStep.targetValueTwo = targetValueTwo
  }
}

/**
 * Converts target values based on the target type and units.
 * @param {Object} step - The step object containing target values and units.
 * @param {string} targetTypeKey - The target type key (e.g., 'pace').
 * @returns {Object} - An object containing converted target values.
 */
function convertTargetValues(step, targetTypeKey) {
  const [minValue, maxValue] = Array.isArray(step.target.value)
    ? step.target.value
    : calculateValueRange(step.target.value, targetTypeKey)

  const targetValueOne = convertValueToUnit(minValue, step.target.unit)
  const targetValueTwo = convertValueToUnit(maxValue, step.target.unit)

  return { targetValueOne, targetValueTwo }
}

/**
 * Calculates the value range for a target based on the target type.
 * @param {number} value - The target value.
 * @param {string} targetTypeKey - The target type key (e.g., 'pace').
 * @returns {Array} - An array containing the min and max values for the target range.
 */
function calculateValueRange(value, targetTypeKey) {
  if (targetTypeKey === 'pace') {
    return calculatePaceRange(value)
  }
  return [value * 0.95, value * 1.05]
}

/**
 * Calculates the pace range based on the target pace.
 * @param {number} pace - The target pace in min/km.
 * @returns {Array} - An array containing the min and max pace values.
 */
function calculatePaceRange(pace) {
  const tenSecondsInMinutes = 10 / 60

  const minPace = pace - tenSecondsInMinutes
  const maxPace = pace + tenSecondsInMinutes

  return [minPace, maxPace]
}

/**
 * Converts a value to a specific unit.
 * @param {number} value - The value to convert.
 * @param {string} unit - The unit to convert to.
 * @returns {number} - The converted value.
 */
function convertValueToUnit(value, unit) {
  switch (unit) {
    case 'min_per_km':
      return 1000 / (value * 60)
    default:
      return value
  }
}

/**
 * Calculates the estimated duration of a workout based on its segments and steps.
 * @param {Array} workoutSegments - The array of workout segments to calculate the duration for.
 * @returns {number} - The estimated duration of the workout in seconds.
 */
function calculateEstimatedDuration(workoutSegments) {
  let duration = 0
  const sportType = workoutSegments[0]?.sportType?.sportTypeKey || 'running'

  workoutSegments.forEach((segment) => {
    segment.workoutSteps.forEach((step) => {
      if (step.type === 'ExecutableStepDTO') {
        if (step.endCondition.conditionTypeKey === 'distance') {
          // For distance-based steps, estimate duration based on pace
          duration += estimateStepDuration(step, sportType)
        } else {
          // For time-based steps, use the step duration directly
          duration += step.endConditionValue
        }
      } else if (step.type === 'RepeatGroupDTO') {
        // Create a fake segment containing just the child steps of the repeat
        const childStepsDuration = calculateStepsDuration(step.workoutSteps, sportType)
        duration += step.numberOfIterations * childStepsDuration
      }
    })
  })
  return duration
}

/**
 * Calculates the duration for an array of steps.
 * @param {Array} steps - The array of steps to calculate the duration for.
 * @param {string} sportType - The sport type key (e.g., 'running').
 * @returns {number} - The estimated duration in seconds.
 */
function calculateStepsDuration(steps, sportType) {
  let duration = 0

  steps.forEach((step) => {
    if (step.type === 'ExecutableStepDTO') {
      if (step.endCondition.conditionTypeKey === 'distance') {
        duration += estimateStepDuration(step, sportType)
      } else {
        duration += step.endConditionValue
      }
    } else if (step.type === 'RepeatGroupDTO') {
      const childStepsDuration = calculateStepsDuration(step.workoutSteps, sportType)
      duration += step.numberOfIterations * childStepsDuration
    }
  })

  return duration
}

/**
 * Estimates the duration of a distance-based step.
 * @param {Object} step - The step to estimate duration for.
 * @param {string} sportType - The sport type key (e.g., 'running').
 * @returns {number} - The estimated duration in seconds.
 */
function estimateStepDuration(step, sportType) {
  const distance = step.endConditionValue // distance in meters
  let pacePerMeter

  // Check if the step has a pace target
  if (
    step.targetType &&
    step.targetType.workoutTargetTypeKey === 'pace.zone' &&
    step.targetValueOne &&
    step.targetValueTwo
  ) {
    // Use the average of min and max pace values
    // targetValueOne and targetValueTwo are in m/s, so we convert to seconds per meter
    pacePerMeter = 2 / (step.targetValueOne + step.targetValueTwo)
  } else if (
    step.targetType &&
    step.targetType.workoutTargetTypeKey === 'speed.zone' &&
    step.targetValueOne &&
    step.targetValueTwo
  ) {
    // If speed target, use the average speed in m/s
    const avgSpeed = (step.targetValueOne + step.targetValueTwo) / 2
    pacePerMeter = 1 / avgSpeed
  } else {
    // Use default pace value based on sport type
    pacePerMeter = DEFAULT_PACE[sportType.toLowerCase()] || DEFAULT_PACE.running
  }

  // Calculate estimated duration
  return distance * pacePerMeter
}

export function createWorkout(workout, callback, errorCallback = () => {}) {
  let garminVersion = document.getElementById('garmin-connect-version')
  let xhr = new XMLHttpRequest()
  xhr.timeout = 30000

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) {
      return
    }

    if (this.status >= 200 && this.status < 300) {
      try {
        callback(JSON.parse(xhr.response))
      } catch {
        errorCallback(new Error('Garmin returned an invalid JSON response.'))
      }
      return
    }

    errorCallback(new Error(formatGarminUploadError(this.status, xhr.responseText)))
  }

  xhr.onerror = function () {
    errorCallback(new Error('Garmin upload failed due to a network error.'))
  }

  xhr.ontimeout = function () {
    errorCallback(new Error('Garmin upload timed out after 30 seconds.'))
  }

  let token = getGarminAccessToken()
  let payload
  try {
    payload = makePayload(workout)
  } catch (error) {
    errorCallback(new Error(`Could not prepare Garmin workout: ${error.message}`))
    return
  }

  console.debug('[OGW] Payload:', JSON.stringify(payload))

  xhr.open('POST', addWorkoutEndpoint, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01')

  const csrfToken = getGarminCsrfToken()
  if (csrfToken) {
    xhr.setRequestHeader('connect-csrf-token', csrfToken)
  }

  xhr.setRequestHeader('x-app-ver', garminVersion?.innerText || '4.27.1.0')
  xhr.setRequestHeader('x-requested-with', 'XMLHttpRequest')
  xhr.setRequestHeader('x-lang', 'it-IT')
  xhr.setRequestHeader('nk', 'NT')
  xhr.setRequestHeader('Di-Backend', 'connectapi.garmin.com')
  if (token) {
    xhr.setRequestHeader('authorization', 'Bearer ' + token)
  }
  xhr.withCredentials = true

  xhr.send(JSON.stringify(payload))
}

function formatGarminUploadError(status, responseText) {
  const details = parseGarminErrorMessage(responseText)
  return `Garmin upload failed (${status}): ${details}`
}

function parseGarminErrorMessage(responseText) {
  if (!responseText) {
    return 'No response body returned.'
  }

  try {
    const payload = JSON.parse(responseText)
    return (
      payload?.message ||
      payload?.error?.message ||
      payload?.errorMessage ||
      payload?.errors?.[0]?.message ||
      responseText
    )
  } catch {
    return responseText
  }
}

function getGarminCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null
}

function getGarminAccessToken() {
  const localStoredToken = window.localStorage.getItem('token')
  if (!localStoredToken) {
    return null
  }

  try {
    return JSON.parse(localStoredToken)?.access_token || null
  } catch {
    return null
  }
}

export function goToWorkout() {
  window.location.assign(workoutsUrl)
}

export const workoutExamples = {
  simpleRun: {
    name: 'Example Workout',
    type: 'running',
    steps: [
      {
        stepName: 'Warm Up',
        stepDescription: 'Warm up for 10 minutes',
        stepDuration: 600,
        stepType: 'warmup',
        target: {
          type: 'heart rate',
          value: [120, 140],
          unit: 'bpm',
        },
      },
      {
        stepName: 'Run Interval',
        stepDescription: 'Run at target pace',
        stepDuration: 1800,
        stepType: 'interval',
        target: {
          type: 'pace',
          value: [4.5, 5.5],
          unit: 'min_per_km',
        },
      },
      {
        stepName: 'Cool Down',
        stepDescription: 'Cool down for 10 minutes',
        stepDuration: 600,
        stepType: 'cooldown',
        target: {
          type: 'no target',
        },
      },
    ],
  },

  simpleCycling: {
    name: 'Cycling Workout',
    type: 'cycling',
    steps: [
      {
        stepName: 'Warm Up',
        stepDescription: 'Warm up for 15 minutes',
        stepDuration: 900,
        stepType: 'warmup',
        target: {
          type: 'power',
          value: [100, 150],
          unit: 'watts',
        },
      },
      {
        stepName: 'Main Interval',
        stepDescription: 'Ride at target power',
        stepDuration: 1800,
        stepType: 'interval',
        target: {
          type: 'power',
          value: [200, 250],
          unit: 'watts',
        },
      },
      {
        stepName: 'Cool Down',
        stepDescription: 'Cool down for 10 minutes',
        stepDuration: 600,
        stepType: 'cooldown',
        target: {
          type: 'no target',
        },
      },
    ],
  },

  internalRunning: {
    name: 'Interval Workout with Repeats',
    type: 'running',
    steps: [
      {
        stepName: 'Warm Up',
        stepDescription: 'Warm up for 10 minutes',
        stepDuration: 600,
        stepType: 'warmup',
      },
      {
        stepType: 'repeat',
        numberOfIterations: 3,
        steps: [
          {
            stepName: 'Run Hard',
            stepDescription: 'Run hard for 5 minutes',
            stepDuration: 300,
            stepType: 'interval',
            target: {
              type: 'pace',
              value: [4, 5], // min/km
            },
          },
          {
            stepName: 'Recover',
            stepDescription: 'Recover for 2 minutes',
            stepDuration: 120,
            stepType: 'recovery',
          },
        ],
      },
      {
        stepName: 'Cool Down',
        stepDescription: 'Cool down for 10 minutes',
        stepDuration: 600,
        stepType: 'cooldown',
      },
    ],
  },

  singleValue: {
    name: 'Tempo Running Workout',
    type: 'running',
    steps: [
      {
        stepName: '5 min Tempo Run at 6:30 min/km pace',
        stepDescription: 'Warmup',
        stepDuration: 300,
        stepType: 'warmup',
        target: {
          type: 'pace',
          value: 6.5,
          unit: 'min_per_km',
        },
      },
      {
        stepName: '10 min Tempo Run at 5:00 min/km pace',
        stepDescription: 'Interval',
        stepDuration: 600,
        stepType: 'interval',
        target: {
          type: 'pace',
          value: 5,
          unit: 'min_per_km',
        },
      },
      {
        stepName: '45 min Tempo Run at 4:30 min/km pace',
        stepDescription: 'Interval',
        stepDuration: 2700,
        stepType: 'interval',
        target: {
          type: 'pace',
          value: 4.5,
          unit: 'min_per_km',
        },
      },
    ],
  },

  distanceBasedWorkout: {
    name: 'Distance-based Interval Workout',
    type: 'running',
    steps: [
      {
        stepName: 'Warm Up',
        stepDescription: 'Warm up with easy jogging',
        endConditionType: 'distance',
        stepDistance: 1,
        distanceUnit: 'km',
        stepType: 'warmup',
        target: {
          type: 'no target',
        },
      },
      {
        stepType: 'repeat',
        numberOfIterations: 5,
        steps: [
          {
            stepName: 'Fast 400m',
            stepDescription: 'Run fast for 400 meters',
            endConditionType: 'distance',
            stepDistance: 400,
            distanceUnit: 'm',
            stepType: 'interval',
            target: {
              type: 'pace',
              value: [4, 4.5],
              unit: 'min_per_km',
            },
          },
          {
            stepName: 'Recovery',
            stepDescription: 'Easy jog for recovery',
            endConditionType: 'distance',
            stepDistance: 200,
            distanceUnit: 'm',
            stepType: 'recovery',
            target: {
              type: 'heart rate',
              value: [120, 130],
              unit: 'bpm',
            },
          },
        ],
      },
      {
        stepName: 'Cool Down',
        stepDescription: 'Slow jog to cool down',
        endConditionType: 'distance',
        stepDistance: 1,
        distanceUnit: 'km',
        stepType: 'cooldown',
        target: {
          type: 'no target',
        },
      },
    ],
  },

  mixedWorkout: {
    name: 'Mixed Time and Distance Workout',
    type: 'running',
    steps: [
      {
        stepName: 'Warm Up',
        stepDescription: 'Warm up with easy jogging',
        endConditionType: 'time',
        stepDuration: 600,
        stepType: 'warmup',
        target: {
          type: 'heart rate',
          value: [120, 130],
          unit: 'bpm',
        },
      },
      {
        stepType: 'repeat',
        numberOfIterations: 3,
        steps: [
          {
            stepName: 'Mile Repeat',
            stepDescription: 'Run one mile at target pace',
            endConditionType: 'distance',
            stepDistance: 1,
            distanceUnit: 'mile',
            stepType: 'interval',
            target: {
              type: 'pace',
              value: [4.5, 5],
              unit: 'min_per_km',
            },
          },
          {
            stepName: 'Recovery',
            stepDescription: 'Recovery period',
            endConditionType: 'time',
            stepDuration: 180,
            stepType: 'recovery',
            target: {
              type: 'heart rate',
              value: [120, 130],
              unit: 'bpm',
            },
          },
        ],
      },
      {
        stepName: 'Cool Down',
        stepDescription: 'Slow jog to cool down',
        endConditionType: 'time',
        stepDuration: 600,
        stepType: 'cooldown',
        target: {
          type: 'no target',
        },
      },
    ],
  },
}
