export type EnvironmentId =
  | 'iss'
  | 'lunar-orbit'
  | 'moon-base'
  | 'mars-transit'
  | 'mars-base'
  | 'mars-rover'

export interface MissionEnvironment {
  id: EnvironmentId
  name: string
  kind: 'Station' | 'Spacecraft' | 'Surface base' | 'Rover'
  gravity: number
  gravityLabel: string
  radiationPerDay: number
  delaySeconds: number
  source: string
}

export const ENVIRONMENTS: MissionEnvironment[] = [
  {
    id: 'iss',
    name: 'ISS · Low Earth orbit',
    kind: 'Station',
    gravity: 0,
    gravityLabel: 'Microgravity',
    radiationPerDay: 0.5,
    delaySeconds: 0.5,
    source: 'NASA HRP – ISS dosimetry',
  },
  {
    id: 'lunar-orbit',
    name: 'Gateway · Lunar orbit',
    kind: 'Spacecraft',
    gravity: 0,
    gravityLabel: 'Microgravity',
    radiationPerDay: 1.4,
    delaySeconds: 1.3,
    source: 'NASA Artemis radiation estimates',
  },
  {
    id: 'moon-base',
    name: 'Artemis base · Moon',
    kind: 'Surface base',
    gravity: 0.166,
    gravityLabel: '0.17 g',
    radiationPerDay: 1.37,
    delaySeconds: 1.3,
    source: "Chang'e-4 LND surface measurement",
  },
  {
    id: 'mars-transit',
    name: 'Mars transit',
    kind: 'Spacecraft',
    gravity: 0,
    gravityLabel: 'Microgravity',
    radiationPerDay: 1.84,
    delaySeconds: 18 * 60,
    source: 'Curiosity RAD cruise measurement',
  },
  {
    id: 'mars-base',
    name: 'Mars surface base',
    kind: 'Surface base',
    gravity: 0.38,
    gravityLabel: '0.38 g',
    radiationPerDay: 0.64,
    delaySeconds: 12 * 60,
    source: 'Curiosity RAD surface measurement',
  },
  {
    id: 'mars-rover',
    name: 'Pressurized rover · Mars',
    kind: 'Rover',
    gravity: 0.38,
    gravityLabel: '0.38 g',
    radiationPerDay: 0.7,
    delaySeconds: 12 * 60,
    source: 'Curiosity RAD surface measurement',
  },
]

export function getEnvironment(id: EnvironmentId): MissionEnvironment {
  return ENVIRONMENTS.find((env) => env.id === id) ?? ENVIRONMENTS[0]
}

export function isDeepSpace(env: MissionEnvironment) {
  return env.delaySeconds > 60
}

export function formatDelay(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds / 60)} min`
}

export function gravityFactor(env: MissionEnvironment) {
  return 1 - env.gravity
}
