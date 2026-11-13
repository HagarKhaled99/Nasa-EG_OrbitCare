import type { MeasuredIndicatorId } from './indicators'

export interface CrewVote {
  fromId: string
  seemsLikeThemselves: boolean
}

export interface Astronaut {
  id: string
  name: string
  role: string
  initials: string
  figure: 'female' | 'male'
  lastCheckIn: string
  seed: number
  streak: number
  baseline: Record<MeasuredIndicatorId, number>
  drift: Partial<Record<MeasuredIndicatorId, { pct: number; days: number }>>
  today: Partial<Record<MeasuredIndicatorId, number>>
  crewVotes: CrewVote[]
  pulseTargetId: string
}

export const MISSION_DAY = 214
export const MISSION_NAME = 'ARES-IV'
export const HISTORY_DAYS = 30
export const EXERCISE_PLAN_MINUTES = 150

export const CREW: Astronaut[] = [
  {
    id: 'sara',
    name: 'Sara Haddad',
    role: 'Mission Specialist',
    initials: 'SH',
    lastCheckIn: 'Yesterday 08:04',
    figure: 'female',
    seed: 3.1,
    streak: 12,
    baseline: {
      heartRate: 62,
      spo2: 98,
      systolic: 116,
      diastolic: 75,
      glucose: 92,
      temperature: 36.7,
      sleep: 7.5,
      mood: 4,
      exercise: 150,
      grip: 38,
      vision: 10,
    },
    drift: {
      heartRate: { pct: 0.18, days: 4 },
      sleep: { pct: -0.17, days: 5 },
    },
    today: { heartRate: 73, sleep: 6.2, mood: 4 },
    crewVotes: [
      { fromId: 'ahmed', seemsLikeThemselves: false },
      { fromId: 'lena', seemsLikeThemselves: false },
      { fromId: 'omar', seemsLikeThemselves: true },
    ],
    pulseTargetId: 'ahmed',
  },
  {
    id: 'ahmed',
    name: 'Ahmed Nasser',
    role: 'Flight Engineer',
    initials: 'AN',
    lastCheckIn: 'Today 07:41',
    figure: 'male',
    seed: 7.4,
    streak: 21,
    baseline: {
      heartRate: 58,
      spo2: 97,
      systolic: 121,
      diastolic: 78,
      glucose: 95,
      temperature: 36.6,
      sleep: 7,
      mood: 4,
      exercise: 150,
      grip: 46,
      vision: 10,
    },
    drift: {},
    today: { mood: 4 },
    crewVotes: [
      { fromId: 'sara', seemsLikeThemselves: true },
      { fromId: 'lena', seemsLikeThemselves: true },
      { fromId: 'omar', seemsLikeThemselves: true },
    ],
    pulseTargetId: 'lena',
  },
  {
    id: 'lena',
    name: 'Lena Fischer',
    role: 'Crew Medical Officer',
    initials: 'LF',
    lastCheckIn: 'Today 07:12',
    figure: 'female',
    seed: 11.9,
    streak: 34,
    baseline: {
      heartRate: 65,
      spo2: 98,
      systolic: 112,
      diastolic: 72,
      glucose: 88,
      temperature: 36.6,
      sleep: 7.5,
      mood: 5,
      exercise: 150,
      grip: 32,
      vision: 10,
    },
    drift: {},
    today: { mood: 5 },
    crewVotes: [
      { fromId: 'sara', seemsLikeThemselves: true },
      { fromId: 'ahmed', seemsLikeThemselves: false },
      { fromId: 'omar', seemsLikeThemselves: true },
    ],
    pulseTargetId: 'omar',
  },
  {
    id: 'omar',
    name: 'Omar Rahimi',
    role: 'Commander',
    initials: 'OR',
    lastCheckIn: 'Yesterday 08:20',
    figure: 'male',
    seed: 5.6,
    streak: 8,
    baseline: {
      heartRate: 60,
      spo2: 97,
      systolic: 124,
      diastolic: 80,
      glucose: 97,
      temperature: 36.8,
      sleep: 6.5,
      mood: 4,
      exercise: 150,
      grip: 49,
      vision: 10,
    },
    drift: {},
    today: { mood: 4 },
    crewVotes: [
      { fromId: 'sara', seemsLikeThemselves: true },
      { fromId: 'ahmed', seemsLikeThemselves: true },
      { fromId: 'lena', seemsLikeThemselves: true },
    ],
    pulseTargetId: 'sara',
  },
]

export function getAstronaut(id: string) {
  return CREW.find((member) => member.id === id) ?? CREW[0]
}
