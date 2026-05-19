import { sportTypeMapping, makePayload } from '../garmin'

describe('makePayload Function', () => {
  test('creates payload for a simple running workout without repeats', () => {
    const workout = {
      name: 'Simple Running Workout',
      type: 'running',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Warm up for 10 minutes',
          stepDuration: 600,
          stepType: 'warmup',
        },
        {
          stepName: 'Run',
          stepDescription: 'Run at a steady pace',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'pace',
            value: [5, 6], // min/km
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Cool Down',
          stepDescription: 'Cool down for 5 minutes',
          stepDuration: 300,
          stepType: 'cooldown',
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Simple Running Workout')
    expect(payload.sportType).toEqual(sportTypeMapping.running)
    expect(payload.estimatedDurationInSecs).toBe(2700)
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(3)

    const run = payload.workoutSegments[0].workoutSteps[1]
    expect(run.targetType).toEqual({
      displayOrder: 6,
      workoutTargetTypeId: 6,
      workoutTargetTypeKey: 'pace.zone',
    })
    expect(run.targetValueOne).toBe(3.3333333333333335)
    expect(run.targetValueTwo).toBe(2.7777777777777777)
  })

  test('creates payload for a single target value', () => {
    const workout = {
      name: 'Simple Running Workout',
      type: 'running',
      steps: [
        {
          stepName: 'Run',
          stepDescription: 'Run at a steady pace',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'pace',
            value: 6.5,
            unit: 'min_per_km',
          },
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutSegments[0].workoutSteps.length).toBe(1)
    expect(payload.estimatedDurationInSecs).toBe(1800)

    const run = payload.workoutSegments[0].workoutSteps[0]
    expect(run.targetType).toEqual({
      displayOrder: 6,
      workoutTargetTypeId: 6,
      workoutTargetTypeKey: 'pace.zone',
    })
    expect(run.targetValueOne).toBe(2.6315789473684212)
    expect(run.targetValueTwo).toBe(2.5)
  })

  test('creates payload for a cycling workout with power target', () => {
    const workout = {
      name: 'Cycling Power Workout',
      type: 'cycling',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Warm up for 15 minutes',
          stepDuration: 900,
          stepType: 'warmup',
        },
        {
          stepName: 'Intervals',
          stepDescription: '5x3min at high power',
          stepType: 'repeat',
          numberOfIterations: 5,
          steps: [
            {
              stepName: 'High Power',
              stepDescription: 'Ride hard for 3 minutes',
              stepDuration: 180,
              stepType: 'interval',
              target: {
                type: 'power',
                value: [250, 300], // watts
              },
            },
            {
              stepName: 'Recover',
              stepDescription: 'Recover for 2 minutes',
              stepDuration: 120,
              stepType: 'recovery',
              target: {
                type: 'no target',
              },
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
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Cycling Power Workout')
    expect(payload.sportType).toEqual(sportTypeMapping.cycling)
    expect(payload.estimatedDurationInSecs).toBe(3000)
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(3)
    // Check repeat step
    const repeatStep = payload.workoutSegments[0].workoutSteps[1]
    expect(repeatStep.type).toBe('RepeatGroupDTO')
    expect(repeatStep.numberOfIterations).toBe(5)
    expect(repeatStep.workoutSteps.length).toBe(2)
    // Check target type in interval
    const intervalStep = repeatStep.workoutSteps[0]
    expect(intervalStep.targetType).toEqual({
      displayOrder: 2,
      workoutTargetTypeId: 2,
      workoutTargetTypeKey: 'power.zone',
    })
    expect(intervalStep.targetValueOne).toBe(250)
    expect(intervalStep.targetValueTwo).toBe(300)
  })

  test('handles unknown sport type gracefully', () => {
    const workout = {
      name: 'Unknown Sport Workout',
      type: 'unknown_sport',
      steps: [],
    }

    expect(() => {
      makePayload(workout)
    }).toThrow('Unsupported sport type: unknown_sport')
  })

  test('handles missing step duration', () => {
    const workout = {
      name: 'Workout with Missing Duration',
      type: 'running',
      steps: [
        {
          stepName: 'Step Without Duration',
          stepDescription: 'This step lacks duration',
          stepType: 'interval',
        },
      ],
    }

    expect(() => makePayload(workout)).toThrow()
  })

  test('uses a non-empty instruction fallback when stepDescription is missing', () => {
    const workout = {
      name: 'Instruction Fallback Workout',
      type: 'cycling',
      steps: [
        {
          stepName: 'Warmup',
          stepDuration: 600,
          stepType: 'warmup',
        },
        {
          stepDuration: 1200,
          stepType: 'interval',
          target: {
            type: 'power',
            value: [260, 280],
          },
        },
      ],
    }

    const payload = makePayload(workout)
    const steps = payload.workoutSegments[0].workoutSteps

    expect(steps[0].description).toBe('Warmup')
    expect(steps[1].description).toBe('interval')
  })

  test('creates payload for a workout with nested repeats', () => {
    const workout = {
      name: 'Nested Repeats Workout',
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
          numberOfIterations: 2,
          steps: [
            {
              stepType: 'repeat',
              numberOfIterations: 3,
              steps: [
                {
                  stepName: 'Fast Run',
                  stepDescription: 'Run fast for 1 minute',
                  stepDuration: 60,
                  stepType: 'interval',
                  target: {
                    type: 'pace',
                    value: [3, 4], // min/km
                    unit: 'min_per_km',
                  },
                },
                {
                  stepName: 'Walk',
                  stepDescription: 'Walk for 1 minute',
                  stepDuration: 60,
                  stepType: 'recovery',
                },
              ],
            },
            {
              stepName: 'Rest',
              stepDescription: 'Rest for 5 minutes',
              stepDuration: 300,
              stepType: 'rest',
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
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Nested Repeats Workout')
    expect(payload.sportType).toEqual(sportTypeMapping.running)
    expect(payload.estimatedDurationInSecs).toBe(2520)
    const repeatStep = payload.workoutSegments[0].workoutSteps[1]
    expect(repeatStep.type).toBe('RepeatGroupDTO')
    expect(repeatStep.numberOfIterations).toBe(2)
    expect(repeatStep.workoutSteps[0].type).toBe('RepeatGroupDTO')
    expect(repeatStep.workoutSteps[0].numberOfIterations).toBe(3)
  })

  test('creates payload for a strength workout with custom steps', () => {
    const workout = {
      name: 'Strength Training',
      type: 'strength',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Light cardio for 5 minutes',
          stepDuration: 300,
          stepType: 'warmup',
        },
        {
          stepName: 'Circuit',
          stepDescription: 'Perform circuit exercises',
          stepType: 'repeat',
          numberOfIterations: 4,
          steps: [
            {
              stepName: 'Push-ups',
              stepDescription: 'Do push-ups for 30 seconds',
              stepDuration: 30,
              stepType: 'interval',
              target: {
                type: 'no target',
              },
            },
            {
              stepName: 'Squats',
              stepDescription: 'Do squats for 30 seconds',
              stepDuration: 30,
              stepType: 'interval',
            },
            {
              stepName: 'Rest',
              stepDescription: 'Rest for 1 minute',
              stepDuration: 60,
              stepType: 'rest',
            },
          ],
        },
        {
          stepName: 'Cool Down',
          stepDescription: 'Stretching for 5 minutes',
          stepDuration: 300,
          stepType: 'cooldown',
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Strength Training')
    expect(payload.sportType).toEqual(sportTypeMapping.strength)
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(3)
    const circuitStep = payload.workoutSegments[0].workoutSteps[1]
    expect(circuitStep.type).toBe('RepeatGroupDTO')
    expect(circuitStep.numberOfIterations).toBe(4)
    expect(circuitStep.workoutSteps.length).toBe(3)
  })

  test('handles workout with different target types', () => {
    const workout = {
      name: 'Mixed Targets Workout',
      type: 'running',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Warm up for 10 minutes',
          stepDuration: 600,
          stepType: 'warmup',
          target: {
            type: 'heart rate',
            value: [110, 130], // bpm
          },
        },
        {
          stepName: 'Run',
          stepDescription: 'Run at cadence',
          stepDuration: 1800,
          stepType: 'interval',
          target: {
            type: 'cadence',
            value: [170, 180], // steps per minute
          },
        },
        {
          stepName: 'Cool Down',
          stepDescription: 'Cool down',
          stepDuration: 600,
          stepType: 'cooldown',
          target: {
            type: 'speed',
            value: [2, 3], // m/s
          },
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Mixed Targets Workout')
    expect(payload.sportType).toEqual(sportTypeMapping.running)
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(3)
    const warmUpStep = payload.workoutSegments[0].workoutSteps[0]
    expect(warmUpStep.targetType.workoutTargetTypeKey).toBe('heart.rate.zone')
    const runStep = payload.workoutSegments[0].workoutSteps[1]
    expect(runStep.targetType.workoutTargetTypeKey).toBe('cadence.zone')
    const coolDownStep = payload.workoutSegments[0].workoutSteps[2]
    expect(coolDownStep.targetType.workoutTargetTypeKey).toBe('speed.zone')
  })

  test('handles invalid target type gracefully', () => {
    const workout = {
      name: 'Workout with Invalid Target',
      type: 'running',
      steps: [
        {
          stepName: 'Run',
          stepDescription: 'Run with invalid target',
          stepDuration: 600,
          stepType: 'interval',
          target: {
            type: 'unknown_target',
            value: [100, 200],
          },
        },
      ],
    }

    expect(() => makePayload(workout)).toThrow()
  })

  test('creates payload for swimming workout', () => {
    const workout = {
      name: 'Swimming Workout',
      type: 'swimming',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Swim easy for 200 meters',
          stepDuration: 600, // Assuming 600 seconds
          stepType: 'warmup',
        },
        {
          stepName: 'Main Set',
          stepDescription: 'Swim intervals',
          stepType: 'repeat',
          numberOfIterations: 5,
          steps: [
            {
              stepName: 'Fast Swim',
              stepDescription: 'Swim fast for 100 meters',
              stepDuration: 180, // Assuming 180 seconds
              stepType: 'interval',
            },
            {
              stepName: 'Rest',
              stepDescription: 'Rest for 30 seconds',
              stepDuration: 30,
              stepType: 'rest',
            },
          ],
        },
        {
          stepName: 'Cool Down',
          stepDescription: 'Swim easy for 200 meters',
          stepDuration: 600,
          stepType: 'cooldown',
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Swimming Workout')
    expect(payload.sportType).toEqual(sportTypeMapping.swimming)
    const mainSet = payload.workoutSegments[0].workoutSteps[1]
    expect(mainSet.type).toBe('RepeatGroupDTO')
    expect(mainSet.numberOfIterations).toBe(5)
  })

  test('Handles workout with no steps', () => {
    const workout = {
      name: 'Empty Workout',
      type: 'running',
      steps: [],
    }

    const payload = makePayload(workout)

    expect(payload.workoutSegments[0].workoutSteps.length).toBe(0)
  })

  test('creates payload for a simple distance-based workout', () => {
    const workout = {
      name: 'Distance-based Workout',
      type: 'running',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Easy jog to warm up',
          endConditionType: 'distance',
          stepDistance: 1,
          distanceUnit: 'km',
          stepType: 'warmup',
          target: {
            type: 'heart rate',
            value: [120, 140],
            unit: 'bpm',
          },
        },
        {
          stepName: 'Main Interval',
          stepDescription: 'Fast run at target pace',
          endConditionType: 'distance',
          stepDistance: 5,
          distanceUnit: 'km',
          stepType: 'interval',
          target: {
            type: 'pace',
            value: [4.5, 5],
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Cool Down',
          stepDescription: 'Easy jog to cool down',
          endConditionType: 'distance',
          stepDistance: 1,
          distanceUnit: 'km',
          stepType: 'cooldown',
          target: {
            type: 'no target',
          },
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Distance-based Workout')
    expect(payload.sportType).toEqual(sportTypeMapping.running)
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(3)

    // Check the warmup step with distance-based condition
    const warmupStep = payload.workoutSegments[0].workoutSteps[0]
    expect(warmupStep.endCondition).toEqual({
      conditionTypeId: 3,
      conditionTypeKey: 'distance',
      displayOrder: 3,
      displayable: true,
    })
    expect(warmupStep.endConditionValue).toBe(1000) // 1 km = 1000 meters
    expect(warmupStep.targetType.workoutTargetTypeKey).toBe('heart.rate.zone')

    // Check the main interval with pace target
    const intervalStep = payload.workoutSegments[0].workoutSteps[1]
    expect(intervalStep.endCondition.conditionTypeKey).toBe('distance')
    expect(intervalStep.endConditionValue).toBe(5000) // 5 km = 5000 meters
    expect(intervalStep.targetType.workoutTargetTypeKey).toBe('pace.zone')
  })

  test('creates payload for a workout with different distance units', () => {
    const workout = {
      name: 'Mixed Units Workout',
      type: 'running',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Warm up with easy jogging',
          endConditionType: 'distance',
          stepDistance: 800,
          distanceUnit: 'm',
          stepType: 'warmup',
        },
        {
          stepName: 'Mile Repeat',
          stepDescription: 'Run one mile fast',
          endConditionType: 'distance',
          stepDistance: 1,
          distanceUnit: 'mile',
          stepType: 'interval',
          target: {
            type: 'pace',
            value: [4, 4.5],
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Recovery Jog',
          stepDescription: 'Easy recovery jog',
          endConditionType: 'distance',
          stepDistance: 400,
          distanceUnit: 'm',
          stepType: 'recovery',
        }
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Mixed Units Workout')
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(3)

    // Check meters
    const warmupStep = payload.workoutSegments[0].workoutSteps[0]
    expect(warmupStep.endConditionValue).toBe(800) // 800 meters

    // Check miles
    const intervalStep = payload.workoutSegments[0].workoutSteps[1]
    expect(intervalStep.endConditionValue).toBeCloseTo(1609.344) // 1 mile in meters

    // Check recovery
    const recoveryStep = payload.workoutSegments[0].workoutSteps[2]
    expect(recoveryStep.endConditionValue).toBe(400) // 400 meters
  })

  test('creates payload for a repeating distance-based workout', () => {
    const workout = {
      name: 'Interval Repeats',
      type: 'running',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Warm up with easy jogging',
          endConditionType: 'time',
          stepDuration: 600,
          stepType: 'warmup',
        },
        {
          stepType: 'repeat',
          numberOfIterations: 5,
          steps: [
            {
              stepName: 'Fast 400m',
              stepDescription: 'Sprint 400 meters',
              endConditionType: 'distance',
              stepDistance: 400,
              distanceUnit: 'm',
              stepType: 'interval',
              target: {
                type: 'pace',
                value: [3.5, 4],
                unit: 'min_per_km',
              },
            },
            {
              stepName: 'Recovery Jog',
              stepDescription: 'Easy jog between sprints',
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
          stepDescription: 'Cool down with easy jogging',
          endConditionType: 'time',
          stepDuration: 600,
          stepType: 'cooldown',
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Interval Repeats')
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(3)

    // Check repeat step
    const repeatStep = payload.workoutSegments[0].workoutSteps[1]
    expect(repeatStep.type).toBe('RepeatGroupDTO')
    expect(repeatStep.numberOfIterations).toBe(5)
    expect(repeatStep.workoutSteps.length).toBe(2)

    // Check interval step within repeat
    const intervalStep = repeatStep.workoutSteps[0]
    expect(intervalStep.endCondition.conditionTypeKey).toBe('distance')
    expect(intervalStep.endConditionValue).toBe(400)
    expect(intervalStep.targetType.workoutTargetTypeKey).toBe('pace.zone')

    // Check recovery step within repeat
    const recoveryStep = repeatStep.workoutSteps[1]
    expect(recoveryStep.endCondition.conditionTypeKey).toBe('distance')
    expect(recoveryStep.endConditionValue).toBe(200)
    expect(recoveryStep.targetType.workoutTargetTypeKey).toBe('heart.rate.zone')
  })

  test('creates payload for a mixed workout with both time and distance steps', () => {
    const workout = {
      name: 'Mixed Time and Distance Workout',
      type: 'running',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Time-based warm up',
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
          stepName: 'Run Fast',
          stepDescription: 'Distance-based interval',
          endConditionType: 'distance',
          stepDistance: 3,
          distanceUnit: 'km',
          stepType: 'interval',
          target: {
            type: 'pace',
            value: [4, 4.5],
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Recovery',
          stepDescription: 'Time-based recovery',
          endConditionType: 'time',
          stepDuration: 180,
          stepType: 'recovery',
        },
        {
          stepName: 'Fast Finish',
          stepDescription: 'Distance-based finish',
          endConditionType: 'distance',
          stepDistance: 1,
          distanceUnit: 'mile',
          stepType: 'interval',
          target: {
            type: 'pace',
            value: [3.8, 4.2],
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Cool Down',
          stepDescription: 'Time-based cool down',
          endConditionType: 'time',
          stepDuration: 600,
          stepType: 'cooldown',
        },
      ],
    }

    const payload = makePayload(workout)

    expect(payload.workoutName).toBe('Mixed Time and Distance Workout')
    expect(payload.workoutSegments[0].workoutSteps.length).toBe(5)

    // Check time-based warmup
    const warmupStep = payload.workoutSegments[0].workoutSteps[0]
    expect(warmupStep.endCondition.conditionTypeKey).toBe('time')
    expect(warmupStep.endConditionValue).toBe(600)

    // Check distance-based interval (km)
    const intervalStep = payload.workoutSegments[0].workoutSteps[1]
    expect(intervalStep.endCondition.conditionTypeKey).toBe('distance')
    expect(intervalStep.endConditionValue).toBe(3000) // 3 km = 3000 meters

    // Check time-based recovery
    const recoveryStep = payload.workoutSegments[0].workoutSteps[2]
    expect(recoveryStep.endCondition.conditionTypeKey).toBe('time')
    expect(recoveryStep.endConditionValue).toBe(180)

    // Check distance-based interval (mile)
    const finishStep = payload.workoutSegments[0].workoutSteps[3]
    expect(finishStep.endCondition.conditionTypeKey).toBe('distance')
    expect(finishStep.endConditionValue).toBeCloseTo(1609.344) // 1 mile in meters
  })

  test('handles invalid distance unit gracefully', () => {
    const workout = {
      name: 'Invalid Distance Unit Workout',
      type: 'running',
      steps: [
        {
          stepName: 'Run',
          stepDescription: 'Run with invalid distance unit',
          endConditionType: 'distance',
          stepDistance: 5,
          distanceUnit: 'invalid_unit',
          stepType: 'interval',
        },
      ],
    }

    expect(() => makePayload(workout)).toThrow('Unsupported distance unit: invalid_unit')
  })

  test('calculates duration for distance-based steps', () => {
    const workout = {
      name: 'Distance-based Duration Test',
      type: 'running',
      steps: [
        {
          stepName: 'Run 5km',
          stepDescription: 'Run 5km at target pace',
          endConditionType: 'distance',
          stepDistance: 5,
          distanceUnit: 'km',
          stepType: 'interval',
          target: {
            type: 'pace',
            value: [5, 5.5], // 5-5:30 min/km pace
            unit: 'min_per_km',
          },
        },
      ],
    }

    const payload = makePayload(workout)

    // Expected duration: 5km at ~5:15 min/km = ~26:15 = ~1575 seconds
    // Since pace is converted to m/s and back, we use approximate matching
    expect(payload.estimatedDurationInSecs).toBeGreaterThan(1500)
    expect(payload.estimatedDurationInSecs).toBeLessThan(1650)
  });

  test('calculates duration for mixed time and distance steps', () => {
    const workout = {
      name: 'Mixed Steps Duration Test',
      type: 'running',
      steps: [
        {
          stepName: 'Warm Up',
          stepDescription: 'Warm up for 10 minutes',
          endConditionType: 'time',
          stepDuration: 600,
          stepType: 'warmup',
        },
        {
          stepName: 'Run 2km',
          stepDescription: 'Run 2km at target pace',
          endConditionType: 'distance',
          stepDistance: 2,
          distanceUnit: 'km',
          stepType: 'interval',
          target: {
            type: 'pace',
            value: [4, 4.5], // 4-4:30 min/km pace
            unit: 'min_per_km',
          },
        },
        {
          stepName: 'Cool Down',
          stepDescription: 'Cool down for 5 minutes',
          endConditionType: 'time',
          stepDuration: 300,
          stepType: 'cooldown',
        },
      ],
    }

    const payload = makePayload(workout)

    // Expected: 600s warmup + ~510s run (2km @ ~4:15 min/km) + 300s cooldown = ~1410s
    expect(payload.estimatedDurationInSecs).toBeGreaterThan(1350)
    expect(payload.estimatedDurationInSecs).toBeLessThan(1470)
  });

  test('calculates duration for distance steps with no pace target', () => {
    const workout = {
      name: 'No Target Distance Test',
      type: 'running',
      steps: [
        {
          stepName: 'Run 1 mile',
          stepDescription: 'Run 1 mile',
          endConditionType: 'distance',
          stepDistance: 1,
          distanceUnit: 'mile',
          stepType: 'interval',
          target: {
            type: 'no target',
          },
        },
      ],
    }

    const payload = makePayload(workout)
    
    // Expected: Using default running pace (0.36s/m) for 1609.344m = ~579.4s
    // We're just checking that a reasonable estimate is made using default pace
    expect(payload.estimatedDurationInSecs).toBeGreaterThan(550)
    expect(payload.estimatedDurationInSecs).toBeLessThan(610)
  });

  test('calculates duration for repeat steps with distance-based children', () => {
    const workout = {
      name: 'Repeat Distance Test',
      type: 'running',
      steps: [
        {
          stepType: 'repeat',
          numberOfIterations: 4,
          steps: [
            {
              stepName: 'Run 400m',
              stepDescription: 'Sprint 400 meters',
              endConditionType: 'distance',
              stepDistance: 400,
              distanceUnit: 'm',
              stepType: 'interval',
              target: {
                type: 'pace',
                value: [4, 4], // 4:00 min/km = 1:36 per 400m
                unit: 'min_per_km',
              },
            },
            {
              stepName: 'Rest',
              stepDescription: 'Rest between intervals',
              endConditionType: 'time',
              stepDuration: 60,
              stepType: 'rest',
            },
          ],
        },
      ],
    }

    const payload = makePayload(workout)

    // Expected: 4 repeats × (400m @ 4:00min/km pace + 60s rest)
    // 400m @ 4:00min/km = ~96s per interval
    // Total: 4 × (96s + 60s) = 4 × 156s = 624s
    expect(payload.estimatedDurationInSecs).toBeGreaterThan(600)
    expect(payload.estimatedDurationInSecs).toBeLessThan(650)
  });
})
