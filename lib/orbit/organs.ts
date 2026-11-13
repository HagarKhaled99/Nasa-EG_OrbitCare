import type { IndicatorId } from './indicators'
import type { Status } from './health'

export type OrganId = 'brain' | 'eyes' | 'heart' | 'blood' | 'muscles' | 'bones' | 'radiation'

export interface OrganDef {
  id: OrganId
  name: string
  shortName: string
  description: string
  hazard: string
  indicators: IndicatorId[]
  position: { x: number; y: number }
  actions: Record<Status, string[]>
  medicalKit?: string
}

export const ORGANS: OrganDef[] = [
  {
    id: 'brain',
    name: 'Brain & mind',
    shortName: 'Brain',
    description:
      'Controls focus, memory, mood and decision making. On a long mission it is your most important tool and the hardest one to check on your own.',
    hazard: 'Isolation and confinement',
    indicators: ['sleep', 'mood', 'crewPulse'],
    position: { x: 50, y: 6.5 },
    actions: {
      normal: [
        'Keep your fixed sleep window and wind-down routine.',
        'Schedule one personal call or message home this week.',
      ],
      watch: [
        'Follow your sleep and light schedule, and keep your wind-down routine before your sleep window.',
        'Use the light panel as your schedule says to keep your body clock steady.',
        'Book a 15-minute private talk with a crewmate or the ground psychologist.',
      ],
      act: [
        'Tell the crew medical officer today. You do not need to handle this alone.',
        'Pause safety-critical tasks (EVA, docking) until you have been cleared.',
        'Start the behavioral health protocol (approved onboard protocol here).',
      ],
    },
    medicalKit: 'Sleep aids only as directed by the crew medical officer (approved onboard protocol here)',
  },
  {
    id: 'eyes',
    name: 'Eyes',
    shortName: 'Eyes',
    description:
      'Your eyes guide every task on board. Fluid that moves toward the head in low gravity can press on the back of the eye and blur near vision.',
    hazard: 'Gravity fields',
    indicators: ['vision'],
    position: { x: 50, y: 11.8 },
    actions: {
      normal: ['Repeat the near-vision check every 3 days.'],
      watch: [
        'Repeat the vision check tomorrow morning in the same light.',
        'Follow the approved onboard fluid-shift protocol (approved onboard protocol here).',
      ],
      act: [
        'Stop the vision check and tell the crew medical officer now.',
        'Ask the crew medical officer about an onboard eye exam.',
      ],
    },
    medicalKit: 'Adjustable-focus glasses, if available onboard',
  },
  {
    id: 'heart',
    name: 'Heart & circulation',
    shortName: 'Heart',
    description:
      'Pumps blood and oxygen around your body. Without gravity, fluid shifts toward your head and your heart adapts — sometimes too much.',
    hazard: 'Gravity fields',
    indicators: ['heartRate', 'systolic', 'diastolic'],
    position: { x: 54.5, y: 25 },
    actions: {
      normal: [
        'Keep drinking fluids across the day as your hydration guidance says.',
        'Complete your scheduled aerobic session on the cycle ergometer.',
      ],
      watch: [
        'Drink extra fluids as your onboard hydration guidance says.',
        'Do your scheduled aerobic session. Do not skip it.',
        'Re-measure resting heart rate tonight and tomorrow morning.',
        'If it stays high for 2 more days, report the persistent change.',
      ],
      act: [
        'Stop exercise and rest in a seated, strapped position.',
        'Repeat the measurement in 10 min. If still out of range, follow the cardiac protocol.',
        'Use the ECG from the medical kit as the onboard protocol directs (approved onboard protocol here).',
      ],
    },
    medicalKit: 'ECG and rehydration supplies from the medical kit',
  },
  {
    id: 'blood',
    name: 'Blood & immune system',
    shortName: 'Immune',
    description:
      'Fights infection and carries energy to your cells. Radiation and a closed cabin weaken the immune system and make infections spread more easily.',
    hazard: 'Hostile/closed environments',
    indicators: ['glucose', 'temperature'],
    position: { x: 43, y: 34 },
    actions: {
      normal: ['Eat your full meal plan, including fresh-grown greens when available.'],
      watch: [
        'Check that you ate all three meals and drank enough water.',
        'Re-check temperature in 4 hours.',
        'Wash hands and wipe shared surfaces with disinfectant wipes.',
      ],
      act: [
        'Start the onboard fever protocol (approved onboard protocol here).',
        'Wear a mask and use your own sleep station to protect the crew.',
        'Record temperature every 4 hours and attach it to the report packet.',
      ],
    },
    medicalKit: 'Thermometer, glucose meter and disinfectant wipes from the medical kit',
  },
  {
    id: 'muscles',
    name: 'Muscles',
    shortName: 'Muscles',
    description:
      'Hold you up, move you and protect your joints. In low gravity your postural muscles are barely used and start to shrink within weeks.',
    hazard: 'Gravity fields',
    indicators: ['exercise', 'grip', 'muscleMass'],
    position: { x: 34.5, y: 28 },
    actions: {
      normal: ['Keep your resistance training schedule: 3 sessions a week minimum.'],
      watch: [
        'Add one extra resistance session this week (squats, deadlifts, heel raises).',
        'Adjust the load on the resistance device together with your exercise plan.',
        'Repeat the grip test in 3 days.',
      ],
      act: [
        'Tell the crew medical officer and adjust the training plan together.',
        'Daily resistance training until values return to your normal.',
      ],
    },
  },
  {
    id: 'bones',
    name: 'Bones',
    shortName: 'Bones',
    description:
      'Your skeleton keeps you upright and stores calcium. Without weight on it, weight-bearing bones like hips and spine lose mineral every month.',
    hazard: 'Gravity fields',
    indicators: ['boneDensity', 'exercise'],
    position: { x: 41, y: 56 },
    actions: {
      normal: ['Keep your daily resistance exercise and follow your nutrition plan.'],
      watch: [
        'Complete your full daily exercise plan, including the resistance work.',
        'Ask the crew medical officer about calcium and vitamin D (approved onboard protocol here).',
        'Use the Future Slider to see how your plan changes the projection.',
      ],
      act: [
        'Talk to the crew medical officer about bone protection options.',
        'Avoid high-impact tasks until cleared.',
      ],
    },
    medicalKit: 'Supplements only as directed by the crew medical officer',
  },
  {
    id: 'radiation',
    name: 'Whole body · Radiation',
    shortName: 'Radiation',
    description:
      'Every cell in your body is exposed to space radiation. The dose adds up over the mission, so the goal is to keep the total as low as possible.',
    hazard: 'Space radiation',
    indicators: ['radiationDose'],
    position: { x: 59, y: 48 },
    actions: {
      normal: ['Wear your personal dosimeter at all times.'],
      watch: [
        'Sleep in the shielded crew quarters.',
        'Limit time in low-shielding modules and EVAs where possible.',
      ],
      act: [
        'Move to the storm shelter during any solar particle event alert.',
        'Ask ground to review future EVA plans against your remaining dose budget.',
      ],
    },
  },
]

export function getOrgan(id: string) {
  return ORGANS.find((organ) => organ.id === id)
}
